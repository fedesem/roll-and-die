import type { ZodType } from "zod";
import { ZodError } from "zod";

import { HttpError } from "./errors.js";

export function parseWithSchema<T>(schema: ZodType<T>, value: unknown, fallbackMessage = "Invalid request payload.") {
  try {
    return schema.parse(value);
  } catch (error) {
    throw toValidationError(error, fallbackMessage);
  }
}

export function toValidationError(error: unknown, fallbackMessage = "Invalid request payload.") {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];

    if (!issue) {
      return new HttpError(400, fallbackMessage);
    }

    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return new HttpError(400, `${path}${issue.message}`);
  }

  if (error instanceof Error) {
    return new HttpError(400, error.message);
  }

  return new HttpError(400, fallbackMessage);
}

export function requireRouteParam(value: string | string[] | undefined, label: string) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }

  throw new HttpError(400, `Route param ${label} is required.`);
}
