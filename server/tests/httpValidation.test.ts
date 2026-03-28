import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HttpError } from "../src/http/errors.ts";
import { parseWithSchema, requireRouteParam, toValidationError } from "../src/http/validation.ts";

describe("parseWithSchema", () => {
  it("returns parsed values when the payload matches the schema", () => {
    const schema = z.object({
      campaignId: z.string().uuid(),
      pageSize: z.number().int().positive()
    });

    const parsed = parseWithSchema(schema, {
      campaignId: "8c9455da-e8c5-4c17-a6f5-6b8945174d5b",
      pageSize: 25
    });

    expect(parsed).toEqual({
      campaignId: "8c9455da-e8c5-4c17-a6f5-6b8945174d5b",
      pageSize: 25
    });
  });

  it("converts zod issues into HttpError messages with the failing path", () => {
    const schema = z.object({
      actor: z.object({
        name: z.string().min(1, "Name is required.")
      })
    });

    let thrown: unknown;

    try {
      parseWithSchema(schema, {
        actor: {
          name: ""
        }
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect(thrown).toMatchObject({
      statusCode: 400,
      message: "actor.name: Name is required."
    });
  });
});

describe("toValidationError", () => {
  it("returns HttpError instances unchanged", () => {
    const original = new HttpError(403, "Forbidden.");

    expect(toValidationError(original)).toBe(original);
  });

  it("uses the original error message for generic errors", () => {
    const converted = toValidationError(new Error("Broken payload."));

    expect(converted).toMatchObject({
      statusCode: 400,
      message: "Broken payload."
    });
  });
});

describe("requireRouteParam", () => {
  it("accepts populated arrays from Express params", () => {
    expect(requireRouteParam(["campaign-123"], "campaignId")).toBe("campaign-123");
  });

  it("throws when the param is missing or empty", () => {
    expect(() => requireRouteParam(undefined, "campaignId")).toThrowError("Route param campaignId is required.");
    expect(() => requireRouteParam("", "campaignId")).toThrowError("Route param campaignId is required.");
  });
});
