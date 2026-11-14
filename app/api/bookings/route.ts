import type { NextRequest } from "next/server";
import { createBooking, decodeCursor, listBookingsForEmail } from "@/lib/server/bookings";
import { apiError, handle, json, readJson } from "@/lib/server/http";
import { claimKey, hashBody, releaseKey, saveResponse, type StoredResponse } from "@/lib/server/idempotency";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { firstIssue, ListBookingsQuerySchema, NewBookingSchema } from "@/lib/server/validation";

type Outcome = StoredResponse & {
  headers?: Record<string, string>;
  /** Whether the response is stored against the Idempotency-Key. */
  final: boolean;
};

// Idempotency is checked before the rate limit so replays don't count as
// attempts; the rate limit runs before validation so failed attempts do.
export const POST = handle(async (req: NextRequest) => {
  const body = await readJson(req);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return apiError(400, "body must be a JSON object");
  }

  const key = req.headers.get("idempotency-key")?.trim() || null;
  if (key && key.length > 255) return apiError(400, "Idempotency-Key is too long");

  if (key) {
    const claim = await claimKey(key, hashBody(body));
    if (claim.kind === "replay") return json(claim.response.body, claim.response.status);
    if (claim.kind === "mismatch") return apiError(422, "Idempotency-Key was already used with a different request body");
    if (claim.kind === "in_progress") return apiError(409, "a request with this Idempotency-Key is still being processed");
  }

  let outcome: Outcome;
  try {
    outcome = await bookSlot(body as Record<string, unknown>);
  } catch (err) {
    if (key) await releaseKey(key).catch(() => {});
    throw err;
  }

  if (key) {
    if (outcome.final) await saveResponse(key, { status: outcome.status, body: outcome.body });
    else await releaseKey(key);
  }
  return json(outcome.body, outcome.status, outcome.headers);
});

async function bookSlot(body: Record<string, unknown>): Promise<Outcome> {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email) {
    const limit = await hitRateLimit(email);
    if (!limit.allowed) {
      return {
        status: 429,
        body: { error: "too many booking attempts for this email, try again later" },
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
        final: false,
      };
    }
  }

  const parsed = NewBookingSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: firstIssue(parsed.error) }, final: true };

  const result = await createBooking(parsed.data);
  if (result.ok) return { status: 201, body: result.booking, final: true };
  switch (result.reason) {
    case "SLOT_NOT_FOUND":
      return { status: 404, body: { error: "slot not found" }, final: true };
    case "SLOT_STARTED":
      return { status: 400, body: { error: "slot has already started" }, final: true };
    case "SLOT_TAKEN":
      return { status: 409, body: { error: "slot already booked" }, final: true };
  }
}

export const GET = handle(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const parsed = ListBookingsQuerySchema.safeParse({
    email: params.get("email") ?? undefined,
    limit: params.get("limit") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
  });
  if (!parsed.success) return apiError(400, firstIssue(parsed.error));

  const cursor = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : null;
  if (parsed.data.cursor && !cursor) return apiError(400, "cursor is invalid");

  return json(await listBookingsForEmail(parsed.data.email, parsed.data.limit, cursor));
});
