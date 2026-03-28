import { describe, expect, it, vi } from "vitest";

import { wrap } from "../src/http/wrap.ts";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("wrap", () => {
  it("passes synchronous throws to next", async () => {
    const error = new Error("sync failure");
    const next = vi.fn();
    const wrapped = wrap(() => {
      throw error;
    });

    wrapped({} as never, {} as never, next);
    await flushMicrotasks();

    expect(next).toHaveBeenCalledWith(error);
  });

  it("passes async rejections to next", async () => {
    const error = new Error("async failure");
    const next = vi.fn();
    const wrapped = wrap(async () => {
      throw error;
    });

    wrapped({} as never, {} as never, next);
    await flushMicrotasks();

    expect(next).toHaveBeenCalledWith(error);
  });

  it("invokes the handler with request, response, and next", async () => {
    const next = vi.fn();
    const handler = vi.fn();
    const wrapped = wrap(handler);
    const request = {} as never;
    const response = {} as never;

    wrapped(request, response, next);
    await flushMicrotasks();

    expect(handler).toHaveBeenCalledWith(request, response, next);
    expect(next).not.toHaveBeenCalled();
  });
});
