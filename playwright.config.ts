import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (fs.existsSync("/usr/bin/chromium-browser")
    ? "/usr/bin/chromium-browser"
    : fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined);

export default defineConfig({
  testDir: "./client/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.VITE_API_URL || "http://localhost:5174",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: chromiumExecutablePath,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        }
      }
    }
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
});

