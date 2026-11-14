// API shapes from docs/openapi.json.

export type Slot = {
  id: string;
  provider: string;
  start: string; // ISO date-time
  end: string; // ISO date-time
};

export type SlotWithAvailability = Slot & { available: boolean };

export type BookingStatus = "confirmed" | "cancelled";

export type Booking = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: BookingStatus;
  created_at: string; // ISO date-time
};

export type NewBooking = { slot_id: string; name: string; email: string };

export type ApiErrorBody = { error: string };
