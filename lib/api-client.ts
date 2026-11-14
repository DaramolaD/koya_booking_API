// Server-side client for the booking API. Keeps API_KEY out of the browser bundle.
import "server-only";

import type { Booking, NewBooking, SlotWithAvailability } from "./types";

export type ApiFailure = {
  ok: false;
  status: number; // 0 = no response
  code: string;
  message: string;
  retryAfterSeconds?: number;
};

export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure;

function codeFor(status: number) {
  switch (status) {
    case 0:
      return "NETWORK_ERROR";
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "IDEMPOTENCY_MISMATCH";
    case 429:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "SERVER_ERROR" : "UNKNOWN";
  }
}

function baseUrl(): string {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function apiFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { ok: false, status: 0, code: "CONFIG_ERROR", message: "API_KEY is not set on the server." };

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        "X-API-Key": apiKey,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK_ERROR", message: "Couldn't reach the booking service." };
  }

  const body = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return { ok: true, status: res.status, data: body as T };

  const retryAfter = Number(res.headers.get("retry-after"));
  const message = (body as { error?: unknown } | null)?.error;
  return {
    ok: false,
    status: res.status,
    code: codeFor(res.status),
    message: typeof message === "string" ? message : `Unexpected response (${res.status}).`,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  };
}

export function listSlots(provider?: string) {
  const qs = provider ? `?${new URLSearchParams({ provider })}` : "";
  return apiFetch<{ slots: SlotWithAvailability[] }>(`/slots${qs}`);
}

export function getBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`);
}

export function createBooking(input: NewBooking, idempotencyKey?: string) {
  return apiFetch<Booking>("/bookings", {
    method: "POST",
    body: input,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function cancelBooking(id: string) {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listBookingsByEmail(email: string, cursor?: string, limit = 10) {
  const qs = new URLSearchParams({ email, limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch<{ bookings: Booking[]; next_cursor: string | null }>(`/bookings?${qs}`);
}
