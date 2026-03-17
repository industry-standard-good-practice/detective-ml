
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import selfsigned from "selfsigned";

import os from "os";

const CERTS_DIR = path.join(process.cwd(), ".certs");
const CERT_FILE = path.join(CERTS_DIR, "cert.pem");
const KEY_FILE = path.join(CERTS_DIR, "key.pem");

function getLocalIPs(): string[] {
  const ips: string[] = ["127.0.0.1", "0.0.0.0"];
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips;
}

async function getOrCreateCerts() {
  // Reuse existing certs if they exist
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log("  → Reusing existing self-signed certificate from .certs/");
    return {
      cert: fs.readFileSync(CERT_FILE, "utf-8"),
      key: fs.readFileSync(KEY_FILE, "utf-8"),
    };
  }

  const localIPs = getLocalIPs();
  console.log("  → Generating new self-signed certificate...");
  console.log("    SANs:", ["localhost", ...localIPs].join(", "));

  const attrs = [{ name: "commonName", value: "Detective ML Dev" }];
  const altNames: any[] = [
    { type: 2, value: "localhost" },  // DNS
    ...localIPs.map(ip => ({ type: 7, ip })),  // All local IPs
  ];

  const pems = await (selfsigned as any).generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "subjectAltName", altNames }
    ],
  });

  // Save for reuse
  fs.mkdirSync(CERTS_DIR, { recursive: true });
  fs.writeFileSync(CERT_FILE, pems.cert);
  fs.writeFileSync(KEY_FILE, pems.private);
  console.log("  → Certificate saved to .certs/");

  return { cert: pems.cert, key: pems.private };
}

async function startServer() {
  const app = express();
  const HTTP_PORT = 3000;
  const HTTPS_PORT = 3443;

  // Proxy endpoint to bypass CORS
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch image");
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/png";
      const base64 = Buffer.from(buffer).toString("base64");

      res.json({
        base64: `data:${contentType};base64,${base64}`,
        contentType
      });
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Server-side audio transcription via Gemini
  // Offloads heavy processing from iOS Safari to prevent memory crashes
  app.post("/api/transcribe", express.raw({ type: "audio/*", limit: "2mb" }), async (req, res) => {
    try {
      // Read API key from .env.local
      const envPath = path.join(process.cwd(), ".env.local");
      let apiKey = "";
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
      }
      if (!apiKey) {
        return res.status(500).json({ error: "No GEMINI_API_KEY in .env.local" });
      }

      const audioBuffer = req.body as Buffer;
      if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(400).json({ error: "No audio data received" });
      }

      const base64Audio = audioBuffer.toString("base64");
      const mimeType = (req.headers["content-type"] || "audio/mp4").split(";")[0];

      // Call Gemini REST API directly (avoids importing the SDK on the server)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64Audio } },
              { text: "Transcribe the speech in this audio clip into text. Return ONLY the transcribed text, nothing else. No quotes, no labels, no explanations. If you cannot hear any speech or the audio is empty/silent, return exactly: [EMPTY]" }
            ]
          }]
        })
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini transcription error:", geminiRes.status, errText);
        return res.status(500).json({ error: "Transcription failed" });
      }

      const data = await geminiRes.json() as any;
      const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (transcript && transcript !== "[EMPTY]") {
        res.json({ transcript });
      } else {
        res.json({ transcript: "" });
      }
    } catch (err) {
      console.error("Transcription endpoint error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // Get or create certs early so the download endpoint works
  let certs: { cert: string; key: string } | null = null;
  try {
    certs = await getOrCreateCerts();
  } catch (e) {
    console.warn("⚠️  Failed to generate certificates:", e);
  }

  // Serve the certificate for iOS installation (must be before Vite middleware)
  app.get("/install-cert", (req, res) => {
    if (!certs) {
      return res.status(500).send("No certificate available");
    }
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", "attachment; filename=detective-ml-dev.crt");
    res.send(certs.cert);
  });

  // Create HTTPS server BEFORE Vite so we can attach HMR WebSocket to it
  let httpsServer: ReturnType<typeof https.createServer> | null = null;
  if (certs) {
    httpsServer = https.createServer({ key: certs.key, cert: certs.cert }, app);
    httpsServer.on("error", (e: any) => {
      if (e.code === "EADDRINUSE") {
        console.warn(`⚠️  HTTPS port ${HTTPS_PORT} already in use — skipping.`);
      } else {
        console.warn("⚠️  HTTPS server error:", e);
      }
    });
  }

  // Vite middleware for development — attach HMR to HTTPS server so hot reload works on :3443
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: httpsServer ? { server: httpsServer } : true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  const localIPs = getLocalIPs().filter(ip => ip !== "127.0.0.1" && ip !== "0.0.0.0");
  const lanIP = localIPs[0] || "<YOUR_LAN_IP>";

  // HTTP server
  app.listen(HTTP_PORT, "0.0.0.0", () => {
    console.log(`HTTP  server running on http://0.0.0.0:${HTTP_PORT}`);
  });

  // Start HTTPS server
  if (httpsServer) {
    httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`HTTPS server running on https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`\n  📱 iOS Safari Setup:`);
      console.log(`     1. Open http://${lanIP}:${HTTP_PORT}/install-cert → Install the profile`);
      console.log(`     2. Settings → General → VPN & Device Management → Trust the profile`);
      console.log(`     3. Settings → General → About → Certificate Trust Settings → Enable full trust`);
      console.log(`     4. Open https://${lanIP}:${HTTPS_PORT}`);
    });
  }
}

startServer();
