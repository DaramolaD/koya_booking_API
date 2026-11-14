import { ArrowRight, Leaf } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findNextAvailable } from "@/lib/availability";
import { addDays, clinicDate, clinicToday, dayParts, formatTime } from "@/lib/format";
import { IMAGES, SITE } from "@/lib/site-config";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[92svh] flex-col overflow-hidden bg-charcoal text-white">
      <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(120%_80%_at_70%_20%,#56604a_0%,#2b302c_45%,#1f2326_100%)]" />
      {IMAGES.hero && (
        <Image
          src={IMAGES.hero.src}
          alt={IMAGES.hero.alt}
          fill
          preload
          sizes="100vw"
          className="-z-10 object-cover"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-charcoal via-charcoal/70 to-charcoal/35 md:bg-linear-to-tr md:via-charcoal/60 md:to-charcoal/20"
      />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-charcoal/70 to-transparent" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2 rounded-md font-display text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none">
          <Leaf className="size-5 text-sage-mist" aria-hidden />
          {SITE.name}
        </a>
        <nav aria-label="Main" className="flex items-center gap-6">
          <a href="#my-bookings" className="hidden rounded-sm text-sm text-white/80 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:block">
            My bookings
          </a>
          <Button asChild className="h-10 rounded-full px-5 focus-visible:ring-white/60">
            <a href="#book">Book now</a>
          </Button>
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end gap-10 px-5 pt-16 pb-12 sm:px-8 md:flex-row md:items-end md:justify-between md:pb-20">
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
          <p className="eyebrow text-sage-mist!">Book in under a minute</p>
          <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-6xl lg:text-[4rem]">
            Care That Fits Your Schedule.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            See real availability, choose a time that suits you, and get an instant confirmation.
            No phone queues, no waiting for a call back.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 rounded-full px-7 text-[0.9375rem] focus-visible:ring-white/60">
            <a href="#book">
              Find a time <ArrowRight aria-hidden />
            </a>
          </Button>
        </div>

        <Suspense fallback={<NextAvailableSkeleton />}>
          <NextAvailable />
        </Suspense>
      </div>
    </section>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-label="Next available appointment"
      className="w-full shrink-0 rounded-lg bg-white p-5 text-charcoal md:w-72"
    >
      {children}
    </aside>
  );
}

async function NextAvailable() {
  await connection();
  const { slot } = await findNextAvailable();

  return (
    <CardShell>
      <p className="eyebrow">Next available</p>
      {slot ? (
        <>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {relativeDay(clinicDate(slot.start))}, {formatTime(slot.start)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{slot.provider}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No open times this week. New times are added regularly.
        </p>
      )}
      <a
        href="#book"
        className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-sage-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        See all times <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </CardShell>
  );
}

function relativeDay(date: string) {
  const today = clinicToday();
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  const p = dayParts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

function NextAvailableSkeleton() {
  return (
    <CardShell>
      <p className="eyebrow">Next available</p>
      <Skeleton className="mt-3 h-8 w-44 bg-cream" />
      <Skeleton className="mt-2 h-4 w-28 bg-cream" />
      <Skeleton className="mt-4 h-4 w-24 bg-cream" />
    </CardShell>
  );
}
