import "server-only";

import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import type { Booking, Slot, SlotWithAvailability } from "@/lib/types";
import { collections, type BookingDoc, type SlotDoc } from "./db";

function toSlot(doc: SlotDoc, available: boolean): SlotWithAvailability {
  return {
    id: doc._id,
    provider: doc.provider,
    start: doc.start_text,
    end: doc.end_text,
    available,
  };
}

export function toBooking(doc: BookingDoc): Booking {
  return {
    id: doc._id,
    slot_id: doc.slot_id,
    name: doc.name,
    email: doc.email,
    status: doc.status,
    created_at: doc.created_at.toISOString(),
  };
}

/**
 * Replaces all slots and deletes every booking. Idempotency records and
 * rate-limit counters are cleared too, since they refer to the old data.
 */
export async function resetSlots(input: Slot[]): Promise<number> {
  const { slots, bookings, idempotency, rateLimits } = await collections();
  await Promise.all([bookings.deleteMany({}), idempotency.deleteMany({}), rateLimits.deleteMany({})]);
  await slots.deleteMany({});
  if (input.length === 0) return 0;
  const res = await slots.insertMany(
    input.map((s) => ({
      _id: s.id,
      provider: s.provider,
      start: new Date(s.start),
      end: new Date(s.end),
      start_text: s.start,
      end_text: s.end,
    })),
  );
  return res.insertedCount;
}

export async function listSlots(provider?: string): Promise<SlotWithAvailability[]> {
  const { slots, bookings } = await collections();
  const all = await slots.find(provider !== undefined ? { provider } : {}).sort({ start: 1, _id: 1 }).toArray();
  if (all.length === 0) return [];

  const taken = await bookings
    .find({ slot_id: { $in: all.map((s) => s._id) }, status: "confirmed" }, { projection: { slot_id: 1 } })
    .toArray();
  const takenIds = new Set(taken.map((b) => b.slot_id));

  return all.map((s) => toSlot(s, !takenIds.has(s._id)));
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { bookings } = await collections();
  const doc = await bookings.findOne({ _id: id });
  return doc ? toBooking(doc) : null;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "SLOT_NOT_FOUND" | "SLOT_STARTED" | "SLOT_TAKEN" };

/** Expects validated, normalised input. */
export async function createBooking(
  input: { slot_id: string; name: string; email: string },
  now = new Date(),
): Promise<CreateBookingResult> {
  const { slots, bookings } = await collections();
  const slot = await slots.findOne({ _id: input.slot_id });
  if (!slot) return { ok: false, reason: "SLOT_NOT_FOUND" };
  if (slot.start <= now) return { ok: false, reason: "SLOT_STARTED" };

  const doc: BookingDoc = {
    _id: randomUUID(), // unguessable, unlike sequential ids or ObjectIds
    slot_id: slot._id,
    name: input.name,
    email: input.email,
    status: "confirmed",
    created_at: now,
  };

  // No read-before-write availability check: that would race under concurrent
  // requests. The partial unique index on confirmed bookings rejects duplicates.
  try {
    await bookings.insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) return { ok: false, reason: "SLOT_TAKEN" };
    throw err;
  }
  return { ok: true, booking: toBooking(doc) };
}

export type CancelResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CANCELLED" };

/** Soft cancel: the booking is kept, and the slot becomes bookable again. */
export async function cancelBooking(id: string, now = new Date()): Promise<CancelResult> {
  const { bookings } = await collections();
  // Conditional update, so concurrent cancels resolve to exactly one success.
  const updated = await bookings.findOneAndUpdate(
    { _id: id, status: "confirmed" },
    { $set: { status: "cancelled", cancelled_at: now } },
    { returnDocument: "after" },
  );
  if (updated) return { ok: true, booking: toBooking(updated) };

  const exists = await bookings.findOne({ _id: id }, { projection: { _id: 1 } });
  return { ok: false, reason: exists ? "ALREADY_CANCELLED" : "NOT_FOUND" };
}

type Cursor = { t: number; id: string };

function encodeCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    return typeof c.t === "number" && Number.isFinite(c.t) && typeof c.id === "string" ? { t: c.t, id: c.id } : null;
  } catch {
    return null;
  }
}

/**
 * Keyset pagination on (created_at, _id), oldest first. Stable while new
 * bookings are being added, unlike offset pagination; _id breaks timestamp ties.
 */
export async function listBookingsForEmail(
  email: string,
  limit: number,
  cursor: Cursor | null,
): Promise<{ bookings: Booking[]; next_cursor: string | null }> {
  const { bookings } = await collections();
  const after = cursor
    ? {
        $or: [
          { created_at: { $gt: new Date(cursor.t) } },
          { created_at: new Date(cursor.t), _id: { $gt: cursor.id } },
        ],
      }
    : {};

  // One extra row tells us whether there is a next page.
  const docs = await bookings
    .find({ email, ...after })
    .sort({ created_at: 1, _id: 1 })
    .limit(limit + 1)
    .toArray();

  const page = docs.slice(0, limit);
  const last = page.at(-1);
  return {
    bookings: page.map(toBooking),
    next_cursor: docs.length > limit && last ? encodeCursor({ t: last.created_at.getTime(), id: last._id }) : null,
  };
}
