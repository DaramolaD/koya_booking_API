import type { NextRequest } from "next/server";
import { cancelBooking, getBooking } from "@/lib/server/bookings";
import { apiError, handle, json } from "@/lib/server/http";

export const GET = handle(async (_req: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) => {
  const { id } = await ctx.params;
  const booking = await getBooking(id);
  return booking ? json(booking) : apiError(404, "booking not found");
});

export const DELETE = handle(async (_req: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) => {
  const { id } = await ctx.params;
  const result = await cancelBooking(id);
  if (result.ok) return json(result.booking);
  return result.reason === "NOT_FOUND"
    ? apiError(404, "booking not found")
    : apiError(409, "booking is already cancelled");
});
