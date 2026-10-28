// Thin fetch wrapper. Errors are normalised into ApiRequestError so callers can tell
// network failures (retryable, answers kept) apart from server-side rejections.

import type { ApiError } from "../../shared/types";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiRequestError(0, "network", "We couldn't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(res.status, err.error ?? "http_error", err.message ?? `Request failed (${res.status}).`, err.fields);
  }
  return data as T;
}
