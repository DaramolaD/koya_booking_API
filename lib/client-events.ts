// Keeps the booking panel and "My bookings" in sync.

export type BookingCreatedDetail = { email: string; date: string | null };
export type BookingCancelledDetail = { date: string | null };

const CREATED = "fernwell:booking-created";
const CANCELLED = "fernwell:booking-cancelled";

export function emitBookingCreated(detail: BookingCreatedDetail) {
  window.dispatchEvent(new CustomEvent(CREATED, { detail }));
}

export function emitBookingCancelled(detail: BookingCancelledDetail) {
  window.dispatchEvent(new CustomEvent(CANCELLED, { detail }));
}

function listen<T>(name: string, fn: (detail: T) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<T>).detail);
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

export const onBookingCreated = (fn: (d: BookingCreatedDetail) => void) => listen(CREATED, fn);
export const onBookingCancelled = (fn: (d: BookingCancelledDetail) => void) => listen(CANCELLED, fn);
