import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createServer, renderSpaDocument } from "./api/index";

const API_PORT = 8081;

export default defineConfig(() => ({
  envPrefix: ["VITE_", "PUBLIC_"],
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: [".", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
  },
  build: {
    outDir: "dist",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

const devApi = globalThis as typeof globalThis & { __mpDevApiServer?: http.Server };

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = req.url || "/";
        const pathOnly = url.split("?")[0];
        const accept = String(req.headers.accept || "");
        if (
          req.method !== "GET"
          || pathOnly.startsWith("/api")
          || pathOnly.startsWith("/@")
          || pathOnly.startsWith("/node_modules")
          || pathOnly.startsWith("/src")
          || pathOnly.startsWith("/client")
          || pathOnly.startsWith("/__")
          || /\.[a-z0-9]+$/i.test(pathOnly)
          || (accept && !accept.includes("text/html"))
        ) {
          next();
          return;
        }
        try {
          const template = await vite.transformIndexHtml(url, fs.readFileSync(path.resolve("index.html"), "utf8"));
          const host = String(req.headers.host || "localhost:8080");
          const html = await renderSpaDocument({
            html: template,
            path: url,
            host,
            language: String(req.headers["accept-language"] || ""),
            origin: `http://${host}`,
          });
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "private, no-cache");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
      const prev = devApi.__mpDevApiServer;
      if (prev?.listening) {
        await new Promise<void>((resolve) => {
          prev.close(() => resolve());
          prev.closeAllConnections?.();
        });
      }
      const server = http.createServer(createServer());
      devApi.__mpDevApiServer = server;
      server.on("error", (error) => console.error(`Express API failed on :${API_PORT}:`, error.message));
      server.listen(API_PORT, () => {
        console.log(`Express API → http://localhost:${API_PORT}`);
      });
    },
  };
}
