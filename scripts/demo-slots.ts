// Load demo slots through the real API: POST /reset (docs/openapi.json).
//   pnpm demo:slots                      → http://localhost:3000/api
//   API_BASE_URL=https://x.vercel.app pnpm demo:slots
//
// Warning: /reset DELETES EVERY BOOKING and replaces all slots. That's the spec.
//
// Generates 14 days from today in the clinic's time zone: Mon–Fri 09:00–17:00,
// Sat 09:00–13:00, Sun closed, 30-minute slots, two providers.

const BASE = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "").replace(/\/api$/, "");
const API_KEY = process.env.API_KEY;
const TZ = process.env.CLINIC_TIME_ZONE ?? "UTC";
const DAYS = 14;
const SLOT_MINUTES = 30;
const PROVIDERS = ["Dr Ade", "Dr Bello"];
const HOURS: Record<number, [number, number] | null> = { 0: null, 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17], 6: [9, 13] };

/** Offset (ms) of `timeZone` from UTC at an instant, e.g. +3_600_000 for UTC+1. */
function zoneOffsetMs(instant: number, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(instant / 1000) * 1000;
}

/** "09:00 on 2026-11-16 at the clinic" → UTC instant (handles daylight saving). */
function clinicTimeToUtc(date: string, hour: number, minute: number) {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  let utc = naive - zoneOffsetMs(naive, TZ);
  utc = naive - zoneOffsetMs(utc, TZ);
  return new Date(utc);
}

async function main() {
  if (!API_KEY) throw new Error("Set API_KEY (e.g. in .env.local)");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);

  const slots: { id: string; provider: string; start: string; end: string }[] = [];
  for (let day = 0; day < DAYS; day++) {
    const date = new Date(Date.UTC(y, m - 1, d + day)).toISOString().slice(0, 10);
    const hours = HOURS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    if (!hours) continue;
    for (let min = hours[0] * 60; min < hours[1] * 60; min += SLOT_MINUTES) {
      const start = clinicTimeToUtc(date, Math.floor(min / 60), min % 60);
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
      const provider = PROVIDERS[(min / SLOT_MINUTES) % PROVIDERS.length];
      slots.push({ id: `${date}-${String(min / 60 | 0).padStart(2, "0")}${String(min % 60).padStart(2, "0")}`, provider, start: start.toISOString(), end: end.toISOString() });
    }
  }

  const res = await fetch(`${BASE}/api/reset`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ slots }),
  });
  console.log(`POST ${BASE}/api/reset → ${res.status}`, await res.text());
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
