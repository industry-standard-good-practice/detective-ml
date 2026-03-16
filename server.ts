
import express from "express";
import https from "https";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import selfsigned from "selfsigned";

async function startServer() {
  const app = express();
  const PORT = 3000;
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server running on http://0.0.0.0:${PORT}`);
  });

  // HTTPS server with self-signed cert (for PWA installability on mobile over LAN)
  try {
    const attrs = [{ name: "commonName", value: "localhost" }];
    const notAfter = new Date();
    notAfter.setFullYear(notAfter.getFullYear() + 1);

    const pems = await selfsigned.generate(attrs, {
      algorithm: "sha256",
      keySize: 2048,
      notAfterDate: notAfter,
      extensions: [
        { name: "subjectAltName", altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ]}
      ]
    });

    const httpsServer = https.createServer(
      { key: pems.private, cert: pems.cert },
      app
    );

    httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`HTTPS server running on https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`  → Open https://<your-lan-ip>:${HTTPS_PORT} on your phone for PWA install`);
    });
  } catch (err) {
    console.warn("Could not start HTTPS server:", err);
  }
}

startServer();
