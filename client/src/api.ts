import type { ZodType } from "zod";

const apiBase = import.meta.env.VITE_API_URL ?? "/api";

interface RequestOptions<TResponse> {
  method?: string;
  token?: string | null;
  body?: unknown;
  bodySchema?: ZodType;
  responseSchema?: ZodType<TResponse>;
  contentType?: string;
  headers?: Record<string, string>;
}

function isBinaryRequestBody(value: unknown): value is BodyInit {
  return value instanceof FormData || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

export async function apiRequest<TResponse = unknown>(path: string, options: RequestOptions<TResponse> = {}): Promise<TResponse> {
  const requestBody = options.bodySchema ? options.bodySchema.parse(options.body) : options.body;
  const binaryRequestBody = isBinaryRequestBody(requestBody);
  const requestHeaders =
    requestBody instanceof FormData
      ? (options.headers ?? {})
      : {
          ...(options.contentType
            ? { "Content-Type": options.contentType }
            : binaryRequestBody
              ? {}
              : { "Content-Type": "application/json" }),
          ...(options.headers ?? {})
        };
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...requestHeaders
    },
    body: requestBody === undefined ? undefined : binaryRequestBody ? requestBody : JSON.stringify(requestBody)
  });

  const raw = await response.text();
  const payload = raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return options.responseSchema ? options.responseSchema.parse(payload) : (payload as TResponse);
}
