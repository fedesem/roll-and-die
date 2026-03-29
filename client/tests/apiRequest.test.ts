import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";

const server = setupServer(
  http.get("http://localhost/api/ping", () =>
    HttpResponse.json({
      ok: true
    })
  )
);

beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error"
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("apiRequest", () => {
  it("parses successful responses with the provided zod schema", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost/api");

    const { apiRequest } = await import("../src/api.ts");
    const response = await apiRequest("/ping", {
      responseSchema: z.object({
        ok: z.literal(true)
      })
    });

    expect(response).toEqual({
      ok: true
    });
  });

  it("surfaces API error payloads as thrown messages", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost/api");

    server.use(
      http.get("http://localhost/api/ping", () =>
        HttpResponse.json(
          {
            error: "Boom."
          },
          { status: 500 }
        )
      )
    );

    const { apiRequest } = await import("../src/api.ts");
    await expect(apiRequest("/ping")).rejects.toThrow("Boom.");
  });
});
