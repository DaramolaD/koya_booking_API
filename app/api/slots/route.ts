import type { NextRequest } from "next/server";
import { listSlots } from "@/lib/server/bookings";
import { handle, json } from "@/lib/server/http";

export const GET = handle(async (req: NextRequest) => {
  const provider = req.nextUrl.searchParams.get("provider") ?? undefined;
  return json({ slots: await listSlots(provider) });
});
