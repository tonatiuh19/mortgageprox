import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import http from "node:http";
import { createServer } from "./api/index";

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
    async configureServer() {
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
