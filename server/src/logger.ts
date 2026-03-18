import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import pino, { type Logger } from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const existing = request.header("x-request-id");
  const requestId =
    typeof existing === "string" && existing.trim().length > 0
      ? existing
      : `req_${randomUUID().slice(0, 8)}`;

  response.setHeader("x-request-id", requestId);

  const requestLogger = logger.child({
    requestId,
    method: request.method,
    path: request.originalUrl
  });
  request.log = requestLogger as Logger;

  const startedAt = Date.now();
  request.log.info(
    {
      event: "request.start",
      remoteAddress: request.ip
    },
    "request.start"
  );

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const level =
      response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";

    request.log[level](
      {
        event: "request.complete",
        statusCode: response.statusCode,
        durationMs
      },
      "request.complete"
    );
  });

  next();
}
