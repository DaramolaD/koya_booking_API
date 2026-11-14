"use client";

import { RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { getSlotsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionResult } from "@/lib/action-errors";
import { emitBookingCreated, onBookingCancelled } from "@/lib/client-events";
import { cn } from "@/lib/utils";
import { toDayView, type BookingView, type SlotView, type SlotsByDate } from "@/lib/views";
import { EASE } from "../motion";
import { showRateLimitToast } from "../rate-limit";
import { BookingConfirmation } from "./booking-confirmation";
import { BookingForm } from "./booking-form";
import { DateCalendar } from "./date-calendar";

type SlotsResult = ActionResult<SlotsByDate>;

const step = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: EASE },
};

export function BookingPanel({
  today,
  initialDate,
  initialSlots,
}: {
  today: string;
  initialDate: string;
  initialSlots: SlotsResult;
}) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotsResult>(initialSlots);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingView | null>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSlots(await getSlotsAction());
    } catch {
      setSlots({ ok: false, code: "NETWORK_ERROR", message: "Couldn't load times. Check your connection." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onBookingCancelled(() => void reload()), [reload]);

  const handleRateLimited = useCallback((retryAfterSeconds?: number) => {
    const until = showRateLimitToast(retryAfterSeconds);
    setRateLimitedUntil(until);
    setTimeout(() => setRateLimitedUntil((cur) => (cur === until ? null : cur)), until - Date.now());
  }, []);

  function chooseDate(d: string) {
    if (d === date) return;
    setDate(d);
    setSelectedId(null);
  }

  function handleBooked(booking: BookingView) {
    setSlots((prev) => {
      if (!prev.ok || !booking.date) return prev;
      const day = prev.data.byDate[booking.date] ?? [];
      const updated = day.map((s) => (s.id === booking.slotId ? { ...s, available: false } : s));
      return {
        ...prev,
        data: {
          byDate: { ...prev.data.byDate, [booking.date]: updated },
          availableDates: updated.some((s) => s.available)
            ? prev.data.availableDates
            : prev.data.availableDates.filter((d) => d !== booking.date),
        },
      };
    });
    setConfirmed(booking);
    emitBookingCreated({ email: booking.email, date: booking.date ?? date });
  }

  function handleSlotTaken() {
    setSelectedId(null);
    void reload();
  }

  function bookAnother() {
    setConfirmed(null);
    setSelectedId(null);
    void reload();
  }

  const daySlots = slots.ok ? (slots.data.byDate[date] ?? []) : [];
  const availableDates = slots.ok ? slots.data.availableDates : [];
  const lastDate = slots.ok ? (Object.keys(slots.data.byDate).sort().at(-1) ?? today) : today;
  const selected = daySlots.find((s) => s.id === selectedId) ?? null;
  const day = toDayView(date);

  return (
    <div className="grid overflow-hidden rounded-lg border border-line bg-paper lg:grid-cols-[1.5fr_1fr]">
      <div
        className={cn(
          "grid min-w-0 gap-8 p-6 transition-opacity sm:p-8 xl:grid-cols-[minmax(0,19rem)_1fr] xl:gap-10",
          confirmed && "pointer-events-none opacity-50",
        )}
        inert={!!confirmed}
      >
        <div className="w-full max-w-sm">
          <DateCalendar
            value={date}
            onChange={chooseDate}
            min={today}
            max={lastDate > date ? lastDate : date}
            available={availableDates}
          />
        </div>

        <div className="min-w-0 border-t border-line pt-8 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-10">
          <h3 id="times-label" className="text-sm font-medium">
            Available times <span className="font-normal text-muted-foreground">· {day.long}</span>
          </h3>

          <div className="mt-4" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3" aria-label="Loading times">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-14 bg-cream" />
                ))}
              </div>
            ) : !slots.ok ? (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line p-5 text-sm">
                <p role="alert">{slots.message}</p>
                <Button variant="outline" size="sm" onClick={() => reload()} className="bg-transparent">
                  <RotateCw aria-hidden /> Try again
                </Button>
              </div>
            ) : daySlots.length === 0 || daySlots.every((s) => !s.available) ? (
              <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted-foreground">
                {availableDates.length === 0
                  ? "No open times right now. New times are added regularly."
                  : "No times left on this day. Days with open times are marked in the calendar."}
              </p>
            ) : (
              <TimeGrid slots={daySlots} value={selectedId} onChange={setSelectedId} />
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <AnimatePresence mode="wait" initial={false}>
          {confirmed ? (
            <motion.div key="confirmed" {...step}>
              <BookingConfirmation booking={confirmed} onBookAnother={bookAnother} />
            </motion.div>
          ) : selected ? (
            <motion.div key={`form-${selected.id}`} {...step}>
              <BookingForm
                slot={selected}
                day={day}
                rateLimitedUntil={rateLimitedUntil}
                onBooked={handleBooked}
                onSlotTaken={handleSlotTaken}
                onRateLimited={handleRateLimited}
              />
            </motion.div>
          ) : (
            <motion.div key="empty" {...step} className="flex h-full min-h-56 flex-col justify-center">
              <p className="eyebrow">Your details</p>
              <p className="mt-3 font-display text-2xl font-semibold tracking-tight">Select a time to continue.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                It takes two fields and about thirty seconds.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TimeGrid({
  slots,
  value,
  onChange,
}: {
  slots: SlotView[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <ul role="list" aria-labelledby="times-label" className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
      {slots.map((s) => {
        const active = s.id === value;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!s.available}
              onClick={() => onChange(s.id)}
              aria-pressed={active}
              aria-label={`${s.timeLabel} with ${s.provider}${s.available ? "" : ", unavailable"}`}
              className={cn(
                "flex h-14 w-full flex-col items-center justify-center rounded-md border px-1 transition-colors",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cream/60 disabled:text-muted-foreground/60",
                active ? "border-sage bg-sage text-white" : "border-line bg-paper hover:border-sage/60",
              )}
            >
              <span className={cn("text-sm font-medium tabular-nums", !s.available && "line-through")}>{s.timeLabel}</span>
              <span className={cn("max-w-full truncate text-[0.6875rem]", active ? "text-white/80" : "text-muted-foreground")}>
                {s.provider}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
