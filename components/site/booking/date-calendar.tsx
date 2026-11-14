"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { addDays, dayParts } from "@/lib/format";
import { cn } from "@/lib/utils";

// Date maths on YYYY-MM-DD strings in UTC, so server and client render the same grid.

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const monthOf = (date: string) => date.slice(0, 7); // "YYYY-MM"

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

/** Cells for a Monday-first month grid; `null` = padding before day 1. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
}

const clamp = (d: string, min: string, max?: string) => (d < min ? min : max && d > max ? max : d);

export function DateCalendar({
  value,
  onChange,
  min,
  max,
  available,
}: {
  value: string;
  onChange: (date: string) => void;
  min: string;
  /** Optional upper bound; omit for no limit. */
  max?: string;
  available?: string[];
}) {
  // Every date in range can be picked; `available` only adds the dot marker.
  const availableSet = new Set(available ?? []);
  const selectable = (d: string) => d >= min && (!max || d <= max);
  const [month, setMonth] = useState(monthOf(value));
  // Roving tabindex.
  const [focusDate, setFocusDate] = useState(value);
  const moveFocus = useRef(false);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, month]);

  const canPrev = month > monthOf(min);
  const canNext = !max || month < monthOf(max);
  const cells = monthCells(month);
  const tabbable =
    monthOf(focusDate) === month && selectable(focusDate)
      ? focusDate
      : (cells.find((d): d is string => !!d && selectable(d)) ?? clamp(`${month}-01`, min, max));

  function goMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setFocusDate(clamp(monthOf(value) === next ? value : `${next}-01`, min, max));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = moves[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const target = addDays(tabbable, step);
    if (!selectable(target)) return;
    setFocusDate(target);
    setMonth(monthOf(target));
    moveFocus.current = true;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 id="cal-label" className="text-sm font-medium" aria-live="polite">
          {monthLabel(month)}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(-1)} disabled={!canPrev} aria-label="Previous month">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => goMonth(1)} disabled={!canNext} aria-label="Next month">
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center" aria-hidden>
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-[0.625rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            {w}
          </span>
        ))}
      </div>

      <div ref={grid} role="group" aria-labelledby="cal-label" onKeyDown={onKeyDown} className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`pad-${i}`} />;
          const disabled = !selectable(d);
          const selected = d === value;
          const isToday = d === min;
          const hasOpenings = availableSet.has(d);
          return (
            <button
              key={d}
              type="button"
              data-date={d}
              disabled={disabled}
              tabIndex={d === tabbable ? 0 : -1}
              onClick={() => {
                setFocusDate(d);
                onChange(d);
              }}
              aria-pressed={selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${dayParts(d).long}${isToday ? ", today" : ""}${hasOpenings ? "" : ", no open times"}`}
              className={cn(
                "relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:text-muted-foreground/40",
                selected
                  ? "bg-sage font-semibold text-white"
                  : !disabled && "hover:bg-cream",
                isToday && !selected && "font-semibold ring-1 ring-sage/50 ring-inset",
              )}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
