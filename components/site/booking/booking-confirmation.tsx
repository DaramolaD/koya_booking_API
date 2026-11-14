"use client";

import { Check, Copy, CopyCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BookingView } from "@/lib/views";
import { EASE } from "../motion";

export function BookingConfirmation({ booking, onBookAnother }: { booking: BookingView; onBookAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), []);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(booking.id);
      setCopied(true);
      toast.success("Booking ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the ID and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
          className="flex size-14 items-center justify-center rounded-full bg-sage text-white"
        >
          <Check className="size-7" strokeWidth={2.5} aria-hidden />
        </motion.div>
        <h3 ref={heading} tabIndex={-1} className="mt-5 font-display text-2xl font-semibold tracking-tight outline-none">
          You&apos;re booked in.
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your booking ID to look up or cancel this appointment.
        </p>
      </div>

      <dl className="divide-y divide-line rounded-lg border border-line bg-cream/60 text-sm">
        <Row label="Date">{booking.dateLabel}</Row>
        <Row label="Time">{booking.timeLabel}</Row>
        <Row label="With">{booking.provider}</Row>
        <Row label="Name">{booking.name}</Row>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-muted-foreground">Booking ID</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <code className="truncate font-mono text-xs">{booking.id}</code>
            <Button variant="ghost" size="icon-sm" onClick={copyId} aria-label="Copy booking ID">
              {copied ? <CopyCheck className="text-sage" aria-hidden /> : <Copy aria-hidden />}
            </Button>
          </dd>
        </div>
      </dl>

      <Button variant="outline" size="lg" onClick={onBookAnother} className="h-12 rounded-full bg-transparent">
        Book another
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
