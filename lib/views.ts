// Display-ready data, formatted on the server.
import { clinicDate, dayParts, formatDate, formatTime } from "./format";
import type { Booking, BookingStatus, Slot, SlotWithAvailability } from "./types";

export type SlotView = {
  id: string;
  provider: string;
  start: string;
  timeLabel: string;
  /** Clinic-local YYYY-MM-DD. */
  date: string;
  available: boolean;
};

export type BookingView = {
  id: string;
  slotId: string;
  status: BookingStatus;
  name: string;
  email: string;
  provider: string;
  /** Clinic-local YYYY-MM-DD, or null if the slot is no longer listed. */
  date: string | null;
  dateLabel: string;
  timeLabel: string;
};

export type DayView = { date: string; weekday: string; day: string; month: string; long: string };

export type SlotsByDate = {
  byDate: Record<string, SlotView[]>;
  /** Days with at least one bookable slot. */
  availableDates: string[];
};

export function toSlotView(s: SlotWithAvailability, now = Date.now()): SlotView {
  return {
    id: s.id,
    provider: s.provider,
    start: s.start,
    timeLabel: formatTime(s.start),
    date: clinicDate(s.start),
    available: s.available && Date.parse(s.start) > now,
  };
}

export function groupSlots(slots: SlotWithAvailability[], today: string, now = Date.now()): SlotsByDate {
  const byDate: Record<string, SlotView[]> = {};
  for (const s of slots) {
    const view = toSlotView(s, now);
    if (view.date < today) continue;
    (byDate[view.date] ??= []).push(view);
  }
  const availableDates = Object.keys(byDate)
    .filter((d) => byDate[d].some((s) => s.available))
    .sort();
  return { byDate, availableDates };
}

export function toBookingView(b: Booking, slot: Slot | undefined): BookingView {
  return {
    id: b.id,
    slotId: b.slot_id,
    status: b.status,
    name: b.name,
    email: b.email,
    provider: slot?.provider ?? "",
    date: slot ? clinicDate(slot.start) : null,
    dateLabel: slot ? formatDate(slot.start) : "Slot no longer listed",
    timeLabel: slot ? `${formatTime(slot.start)} – ${formatTime(slot.end)}` : "",
  };
}

export function toDayView(date: string): DayView {
  return { date, ...dayParts(date) };
}
