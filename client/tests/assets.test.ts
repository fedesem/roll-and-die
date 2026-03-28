import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAssetUrl } from "../src/lib/assets.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveAssetUrl", () => {
  it("returns an empty string for blank input", () => {
    expect(resolveAssetUrl("   ")).toBe("");
  });

  it("preserves absolute, data, and blob URLs", () => {
    expect(resolveAssetUrl("https://example.com/token.png")).toBe("https://example.com/token.png");
    expect(resolveAssetUrl("data:image/png;base64,abc123")).toBe("data:image/png;base64,abc123");
    expect(resolveAssetUrl("blob:http://localhost/123")).toBe("blob:http://localhost/123");
  });

  it("resolves upload paths against VITE_ASSET_URL first", () => {
    vi.stubEnv("VITE_ASSET_URL", "https://cdn.example.com/static/");
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");

    expect(resolveAssetUrl("/uploads/maps/castle.png")).toBe("https://cdn.example.com/uploads/maps/castle.png");
  });

  it("falls back to VITE_API_URL when no asset base is configured", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/base/");

    expect(resolveAssetUrl("/uploads/tokens/goblin.png")).toBe("https://api.example.com/uploads/tokens/goblin.png");
  });

  it("returns the trimmed original path when no matching base URL exists", () => {
    vi.stubEnv("VITE_API_URL", "/relative-api");

    expect(resolveAssetUrl("  /uploads/notes/image.png  ")).toBe("/uploads/notes/image.png");
    expect(resolveAssetUrl("relative/path.png")).toBe("relative/path.png");
  });
});
