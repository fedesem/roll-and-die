import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "DnD 2024 Board",
        short_name: "DnD Board",
        description: "Dungeon and Dragons 5e 2024 collaborative campaign board.",
        theme_color: "#121212",
        background_color: "#121212",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared")
    }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4000",
      "/ws": {
        target: "http://localhost:4000",
        ws: true
      }
    }
  }
});
