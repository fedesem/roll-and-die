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
    projects: [
      {
        resolve: {
          alias: {
            "@shared": path.resolve(rootDir, "shared")
          }
        },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/tests/**/*.{test,spec}.{ts,tsx}"]
        }
      },
      {
        resolve: {
          alias: {
            "@shared": path.resolve(rootDir, "shared")
          }
        },
        test: {
          name: "server",
          environment: "node",
          include: ["server/tests/**/*.test.ts"]
        }
      }
    ]
  }
});
