import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = {
  "@": path.resolve(import.meta.dirname, "client"),
  "@shared": path.resolve(import.meta.dirname, "shared"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    env: {
      VITEST: "true",
      JWT_SECRET: "test-secret",
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "node",
          include: ["api/**/*.test.ts", "client/**/*.spec.ts", "shared/**/*.spec.ts"],
          environment: "node",
          env: { VITEST: "true", JWT_SECRET: "test-secret" },
          fileParallelism: false,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "jsdom",
          include: ["client/**/*.spec.tsx"],
          environment: "jsdom",
          setupFiles: ["client/test/setup.ts"],
          env: { VITEST: "true", JWT_SECRET: "test-secret" },
        },
      },
    ],
  },
});
