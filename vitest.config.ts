import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "shared")
    }
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["client/tests/**/*.{test,spec}.{ts,tsx}", "jsdom"]],
    include: ["client/tests/**/*.{test,spec}.{ts,tsx}", "server/tests/**/*.test.ts"]
  }
});
