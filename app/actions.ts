"use server";

import { toActionError, type ActionError, type ActionResult } from "@/lib/action-errors";
import {
  cancelBooking,
  createBooking,
  getBooking,
  listBookingsByEmail,
  listSlots,
} from "@/lib/api-client";
import { clinicToday } from "@/lib/format";
import type { Booking, Slot } from "@/lib/types";
import { groupSlots, toBookingView, type BookingView, type SlotsByDate } from "@/lib/views";

/** Bookings only carry slot_id, so join the slots for display. */
async function withSlots(bookings: Booking[]): Promise<BookingView[]> {
  const slots = await listSlots();
  const byId = new Map<string, Slot>(slots.ok ? slots.data.slots.map((s) => [s.id, s]) : []);
  return bookings.map((b) => toBookingView(b, byId.get(b.slot_id)));
}

export async function getSlotsAction(): Promise<ActionResult<SlotsByDate>> {
  const result = await listSlots();
  return result.ok ? { ok: true, data: groupSlots(result.data.slots, clinicToday()) } : toActionError(result);
}

export type CreateBookingInput = {
  slotId: string;
  name: string;
  email: string;
  idempotencyKey: string;
};

export type CreateBookingResult =
  | { ok: true; data: BookingView }
  | (ActionError & { /** The Idempotency-Key to send on the NEXT attempt. */ nextIdempotencyKey: string });

export async function createBookingAction(input: CreateBookingInput): Promise<CreateBookingResult> {
  const slot_id = String(input.slotId ?? "");
  const idempotencyKey = String(input.idempotencyKey ?? "");
  const name = String(input.name ?? "");
  const email = String(input.email ?? "");

  // Validation is left to the API.
  const result = await createBooking({ slot_id, name, email }, idempotencyKey || undefined);
  if (result.ok) {
    const [view] = await withSlots([result.data]);
    return { ok: true, data: view };
  }

  // Keep the key when the outcome is unknown (no response or 5xx) so a retry
  // replays the original result; any definite answer gets a fresh key.
  const outcomeUnknown = result.status === 0 || result.status >= 500;
  const error = toActionError(result, {
    CONFLICT: "Someone just booked this time. Please choose another.",
    NOT_FOUND: "That time is no longer available. Please choose another.",
  });
  return {
    ...error,
    code: result.status === 409 ? "SLOT_TAKEN" : error.code,
    nextIdempotencyKey: outcomeUnknown ? idempotencyKey : crypto.randomUUID(),
  };
}

export async function getBookingAction(id: string): Promise<ActionResult<BookingView>> {
  const trimmed = String(id ?? "").trim();
  if (!trimmed) return { ok: false, code: "VALIDATION_ERROR", message: "Enter a booking reference." };
  const result = await getBooking(trimmed);
  if (!result.ok) return toActionError(result, { NOT_FOUND: "No booking matches that reference." });
  const [view] = await withSlots([result.data]);
  return { ok: true, data: view };
}

export async function listBookingsAction(
  email: string,
  cursor?: string,
): Promise<ActionResult<BookingView[], { nextCursor: string | null }>> {
  const trimmed = String(email ?? "").trim();
  if (!trimmed) return { ok: false, code: "VALIDATION_ERROR", message: "Enter your email." };
  const result = await listBookingsByEmail(trimmed, cursor);
  if (!result.ok) return toActionError(result);
  return { ok: true, data: await withSlots(result.data.bookings), nextCursor: result.data.next_cursor ?? null };
}

export async function cancelBookingAction(id: string): Promise<ActionResult<BookingView>> {
  const result = await cancelBooking(String(id ?? ""));
  if (!result.ok) return toActionError(result, { CONFLICT: "This booking is already cancelled." });
  const [view] = await withSlots([result.data]);
  return { ok: true, data: view };
}
