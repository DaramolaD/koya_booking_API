import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toActionError } from "@/lib/action-errors";
import { findNextAvailable } from "@/lib/availability";
import { clinicDate, clinicToday } from "@/lib/format";
import { groupSlots } from "@/lib/views";
import { Reveal } from "../motion";
import { BookingPanel } from "./booking-panel";

export function BookingSection() {
  return (
    <section id="book" aria-labelledby="book-title" className="scroll-mt-4 bg-cream py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Book an appointment</p>
          <h2 id="book-title" className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Pick a Time That Works.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Choose a date, tap a time, and add your details. Your slot is held the moment you confirm.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-12">
          <Suspense fallback={<BookingPanelSkeleton />}>
            <BookingData />
          </Suspense>
        </Reveal>
      </div>
    </section>
  );
}

async function BookingData() {
  await connection();
  const today = clinicToday();

  const { result, slot } = await findNextAvailable();
  const initialSlots = result.ok
    ? { ok: true as const, data: groupSlots(result.data.slots, today) }
    : toActionError(result);
  const initialDate = slot ? clinicDate(slot.start) : today;

  return <BookingPanel today={today} initialDate={initialDate} initialSlots={initialSlots} />;
}

function BookingPanelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading appointment times" className="grid overflow-hidden rounded-lg border border-line bg-paper lg:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,19rem)_1fr] xl:gap-10">
        <div className="w-full max-w-sm">
          <Skeleton className="h-4 w-32 bg-cream" />
          <div className="mt-6 grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="mx-auto aspect-square w-full max-w-11 rounded-full bg-cream" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-4 w-40 bg-cream" />
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-11 bg-cream" />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <Skeleton className="h-6 w-40 bg-cream" />
        <Skeleton className="mt-6 h-10 bg-cream" />
        <Skeleton className="mt-4 h-10 bg-cream" />
        <Skeleton className="mt-6 h-11 bg-cream" />
      </div>
    </div>
  );
}
