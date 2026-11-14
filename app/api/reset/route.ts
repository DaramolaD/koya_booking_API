import { resetSlots } from "@/lib/server/bookings";
import { apiError, handle, json, readJson } from "@/lib/server/http";
import type { Slot } from "@/lib/types";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const list = (body as { slots?: unknown } | null)?.slots;
  if (!Array.isArray(list)) return apiError(400, "body must be { slots: [...] }");

  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const [i, raw] of list.entries()) {
    const s = raw as Partial<Record<keyof Slot, unknown>> | null;
    const id = s?.id, provider = s?.provider, start = s?.start, end = s?.end;
    if (typeof id !== "string" || id === "") return apiError(400, `slots[${i}].id is required`);
    if (seen.has(id)) return apiError(400, `duplicate slot id: ${id}`);
    if (typeof provider !== "string" || provider === "") return apiError(400, `slots[${i}].provider is required`);
    if (typeof start !== "string" || Number.isNaN(Date.parse(start))) return apiError(400, `slots[${i}].start must be a date-time`);
    if (typeof end !== "string" || Number.isNaN(Date.parse(end))) return apiError(400, `slots[${i}].end must be a date-time`);
    seen.add(id);
    slots.push({ id, provider, start, end });
  }

  const count = await resetSlots(slots);
  return json({ ok: true, slots: count });
});
