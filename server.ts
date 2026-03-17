
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

  // Get or create certs early so the download endpoint works
  let certs: { cert: string; key: string } | null = null;
  try {
    certs = await getOrCreateCerts();
  } catch (e) {
    console.warn("⚠️  Failed to generate certificates:", e);
  }

  // Serve the certificate for iOS installation (must be before Vite middleware)
  // Navigate to http://<LAN_IP>:3000/install-cert on iOS Safari to install
  app.get("/install-cert", (req, res) => {
    if (!certs) {
      return res.status(500).send("No certificate available");
    }
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", "attachment; filename=detective-ml-dev.crt");
    res.send(certs.cert);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
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

  // HTTPS server (needed for iOS Safari microphone access)
  if (certs) {
    const httpsServer = https.createServer({ key: certs.key, cert: certs.cert }, app);
    httpsServer.on("error", (e: any) => {
      if (e.code === "EADDRINUSE") {
        console.warn(`⚠️  HTTPS port ${HTTPS_PORT} already in use — skipping HTTPS server.`);
        console.warn(`   Kill the old process or use a different port.`);
      } else {
        console.warn("⚠️  HTTPS server error:", e);
      }
    });
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
