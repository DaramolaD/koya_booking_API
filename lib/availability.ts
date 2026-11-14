import "server-only";

import { cache } from "react";
import { listSlots } from "./api-client";

/** Deduplicated per render: the hero and booking section share one request. */
export const getAllSlots = cache(() => listSlots());

export const findNextAvailable = cache(async () => {
  const result = await getAllSlots();
  const now = Date.now();
  const slot = result.ok ? (result.data.slots.find((s) => s.available && Date.parse(s.start) > now) ?? null) : null;
  return { result, slot };
});
