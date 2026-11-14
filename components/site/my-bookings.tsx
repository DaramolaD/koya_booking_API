"use client";

import { CalendarX2, Loader2, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBookingAction, getBookingAction, listBookingsAction } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionError } from "@/lib/action-errors";
import { emitBookingCancelled, onBookingCreated } from "@/lib/client-events";
import { cn } from "@/lib/utils";
import type { BookingView } from "@/lib/views";
import { EASE, Reveal } from "./motion";
import { showRateLimitToast } from "./rate-limit";

type Mode = "email" | "reference";
type Query = { mode: Mode; value: string };

export function MyBookings() {
  const [mode, setMode] = useState<Mode>("email");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState<Query | null>(null);
  const [bookings, setBookings] = useState<BookingView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();

  function handleError(err: ActionError) {
    if (err.code === "RATE_LIMITED") showRateLimitToast(err.retryAfterSeconds);
    setError(err.message);
  }

  function runSearch(q: Query) {
    setQuery(q);
    setError(null);
    startSearch(async () => {
      try {
        if (q.mode === "email") {
          const res = await listBookingsAction(q.value);
          if (!res.ok) return handleError(res);
          setBookings(res.data);
          setNextCursor(res.nextCursor);
        } else {
          const res = await getBookingAction(q.value);
          setNextCursor(null);
          if (!res.ok) {
            setBookings([]);
            return handleError(res);
          }
          setBookings([res.data]);
        }
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function loadMore() {
    if (!query || query.mode !== "email" || !nextCursor) return;
    startLoadMore(async () => {
      try {
        const res = await listBookingsAction(query.value, nextCursor);
        if (!res.ok) return handleError(res);
        setBookings((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          return [...prev, ...res.data.filter((b) => !seen.has(b.id))];
        });
        setNextCursor(res.nextCursor);
      } catch {
        toast.error("Couldn't load more. Please try again.");
      }
    });
  }

  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });
  useEffect(
    () =>
      onBookingCreated(({ email }) => {
        const q = queryRef.current;
        if (q?.mode === "email" && q.value.toLowerCase() === email.toLowerCase()) runSearch(q);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; reads latest query via ref
    [],
  );

  function replace(updated: BookingView) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  const hasSearched = query !== null;

  return (
    <section id="my-bookings" aria-labelledby="my-bookings-title" className="scroll-mt-4 bg-charcoal py-20 text-paper sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <p className="eyebrow text-sage-mist!">My bookings</p>
          <h2 id="my-bookings-title" className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Your Appointments, In One Place.
          </h2>
          <p className="mt-4 max-w-md text-paper/65">
            Look up everything booked with your email, or find one appointment by its booking ID. Cancel in two taps.
          </p>

          <div role="group" aria-label="Search by" className="mt-8 inline-flex rounded-full border border-white/15 p-1">
            {(["email", "reference"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setInput("");
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sage-mist focus-visible:outline-none",
                  mode === m ? "bg-paper text-charcoal" : "text-paper/70 hover:text-paper",
                )}
              >
                {m === "email" ? "By email" : "By booking ID"}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = input.trim();
              if (value) runSearch({ mode, value });
            }}
          >
            <label htmlFor="lookup" className="sr-only">
              {mode === "email" ? "Email address" : "Booking ID"}
            </label>
            <Input
              id="lookup"
              type={mode === "email" ? "email" : "text"}
              inputMode={mode === "email" ? "email" : "text"}
              autoComplete={mode === "email" ? "email" : "off"}
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "email" ? "you@example.com" : "Paste your booking ID"}
              className="h-12 border-white/15 bg-white/5 text-paper placeholder:text-paper/40 focus-visible:border-sage-mist focus-visible:ring-sage-mist/40"
            />
            <Button type="submit" disabled={searching} className="h-12 rounded-full px-6 focus-visible:ring-sage-mist/60">
              {searching ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
              <span className="sr-only sm:not-sr-only">Search</span>
            </Button>
          </form>
        </Reveal>

        <div aria-live="polite" aria-busy={searching}>
          {searching ? (
            <ListSkeleton />
          ) : error ? (
            <p role="alert" className="rounded-lg border border-white/10 bg-white/4 p-5 text-sm text-paper/80">
              {error}
            </p>
          ) : !hasSearched ? (
            <EmptyState title="Your bookings will appear here." body="Search with the email you booked with." />
          ) : bookings.length === 0 ? (
            <EmptyState title="No bookings found." body="Check the spelling, or try the other search option." />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-paper/60">
                {query?.mode === "email" ? `Showing ${bookings.length} booking${bookings.length === 1 ? "" : "s"}` : "Booking found"}
              </p>
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {bookings.map((b) => (
                    <motion.li
                      key={b.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <BookingCard booking={b} onCancelled={replace} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {nextCursor && (
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-2 h-11 self-center rounded-full border-white/20 bg-transparent px-6 text-paper hover:bg-white/10 hover:text-paper focus-visible:ring-sage-mist/60"
                >
                  {loadingMore && <Loader2 className="animate-spin" aria-hidden />}
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BookingCard({ booking, onCancelled }: { booking: BookingView; onCancelled: (b: BookingView) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const cancelled = booking.status === "cancelled";

  function confirmCancel(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open while pending
    startTransition(async () => {
      try {
        const res = await cancelBookingAction(booking.id);
        if (!res.ok) {
          if (res.code === "RATE_LIMITED") showRateLimitToast(res.retryAfterSeconds);
          else toast.error(res.message);
          return;
        }
        onCancelled(res.data);
        emitBookingCancelled({ date: res.data.date });
        toast.success("Appointment cancelled");
        setOpen(false);
      } catch {
        toast.error("Connection lost. Please try again.");
      }
    });
  }

  return (
    <article className={cn("rounded-lg border border-white/10 bg-white/4 p-5 transition-opacity", cancelled && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">{booking.dateLabel}</h3>
          <p className="mt-0.5 text-sm text-paper/70 tabular-nums">
            {booking.timeLabel} · {booking.provider}
          </p>
        </div>
        <Badge
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase",
            cancelled ? "border-white/15 bg-transparent text-paper/60" : "bg-sage text-white",
          )}
        >
          {cancelled ? "Cancelled" : "Confirmed"}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4">
        <p className="min-w-0 text-xs text-paper/55">
          {booking.name} · <code className="font-mono break-all">{booking.id}</code>
        </p>
        {!cancelled && (
          <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-paper/80 hover:bg-white/10 hover:text-paper focus-visible:ring-sage-mist/60"
              >
                <CalendarX2 aria-hidden /> Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-paper">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display tracking-tight">Cancel this appointment?</AlertDialogTitle>
                <AlertDialogDescription>
                  {booking.dateLabel}, {booking.timeLabel} with {booking.provider}. The time will be released to other
                  patients.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending} className="rounded-full bg-transparent">
                  Keep appointment
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={confirmCancel}
                  disabled={pending}
                  className="rounded-full"
                >
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  {pending ? "Cancelling…" : "Yes, cancel"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-56 flex-col justify-center rounded-lg border border-dashed border-white/15 p-8">
      <p className="font-display text-xl font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm text-paper/60">{body}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading bookings">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-lg border border-white/10 p-5">
          <Skeleton className="h-5 w-48 bg-white/10" />
          <Skeleton className="mt-2 h-4 w-32 bg-white/10" />
          <Skeleton className="mt-5 h-3 w-56 bg-white/10" />
        </div>
      ))}
    </div>
  );
}
