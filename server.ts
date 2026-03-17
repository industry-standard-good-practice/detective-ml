
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import selfsigned from "selfsigned";

const CERTS_DIR = path.join(process.cwd(), ".certs");
const CERT_FILE = path.join(CERTS_DIR, "cert.pem");
const KEY_FILE = path.join(CERTS_DIR, "key.pem");

async function getOrCreateCerts() {
  // Reuse existing certs if they exist
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log("  → Reusing existing self-signed certificate from .certs/");
    return {
      cert: fs.readFileSync(CERT_FILE, "utf-8"),
      key: fs.readFileSync(KEY_FILE, "utf-8"),
    };
  }

  console.log("  → Generating new self-signed certificate...");
  const attrs = [{ name: "commonName", value: "Detective ML Dev" }];
  const pems = await (selfsigned as any).generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      { name: "subjectAltName", altNames: [
        { type: 2, value: "localhost" },   // DNS
        { type: 7, ip: "127.0.0.1" },      // IP
        { type: 7, ip: "0.0.0.0" },        // IP
      ]}
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

  // HTTP server
  app.listen(HTTP_PORT, "0.0.0.0", () => {
    console.log(`HTTP  server running on http://0.0.0.0:${HTTP_PORT}`);
  });

  // HTTPS server (needed for iOS Safari microphone access)
  try {
    const certs = await getOrCreateCerts();
    https.createServer({ key: certs.key, cert: certs.cert }, app).listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`HTTPS server running on https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`\n  📱 iOS Safari: Open https://<YOUR_LAN_IP>:${HTTPS_PORT}`);
      console.log(`     Then trust the certificate in Settings → General → About → Certificate Trust Settings`);
    });
  } catch (e) {
    console.warn("⚠️  HTTPS server failed to start:", e);
    console.warn("   Microphone/speech won't work on iOS Safari over HTTP.");
  }
}

startServer();
