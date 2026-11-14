export const CLINIC_TIME_ZONE = process.env.CLINIC_TIME_ZONE ?? "UTC";

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function clinicDate(iso: string | Date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE }).format(new Date(iso));
}

export function clinicToday(now = new Date()) {
  return clinicDate(now);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function dayParts(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(date);
  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    long: part({ weekday: "long", day: "numeric", month: "long" }),
  };
}
