import type { NextFunction, Request, Response } from "express";

export function wrap(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => handler(request, response, next))
      .catch(next);
  };
}
