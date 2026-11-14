"use client";

import { Loader2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBookingAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingView, DayView, SlotView } from "@/lib/views";
import { Countdown } from "../rate-limit";

type Fields = { name: string; email: string };

export function BookingForm({
  slot,
  day,
  rateLimitedUntil,
  onBooked,
  onSlotTaken,
  onRateLimited,
}: {
  slot: SlotView;
  day: DayView;
  rateLimitedUntil: number | null;
  onBooked: (b: BookingView) => void;
  onSlotTaken: () => void;
  onRateLimited: (retryAfterSeconds?: number) => void;
}) {
  // One Idempotency-Key per booking attempt; the parent remounts this per slot.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Fields>({ name: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  const blocked = rateLimitedUntil !== null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || blocked) return;
    setFormError(null);
    setFieldErrors({});

    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createBookingAction>>;
      try {
        res = await createBookingAction({ slotId: slot.id, idempotencyKey, ...values });
      } catch {
        // Outcome unknown: keep the same key so retrying is safe.
        setFormError("Connection lost. Press Confirm again. You won't be booked twice.");
        return;
      }

      if (res.ok) {
        toast.success("Appointment confirmed");
        onBooked(res.data);
        return;
      }

      setIdempotencyKey(res.nextIdempotencyKey);
      if (res.code === "SLOT_TAKEN") {
        toast.error(res.message);
        onSlotTaken();
        return;
      }
      if (res.code === "RATE_LIMITED") {
        onRateLimited(res.retryAfterSeconds);
        setFormError("Too many attempts. Please wait before trying again.");
        return;
      }
      // Errors are plain strings; map "email ..." / "name ..." to that field.
      const field = res.code === "VALIDATION_ERROR" ? /^(name|email)\b/i.exec(res.message)?.[1]?.toLowerCase() : undefined;
      if (field) setFieldErrors({ [field]: [capitalise(res.message)] });
      else setFormError(capitalise(res.message));
    });
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-describedby={`${id}-summary`}>
      <div>
        <p className="eyebrow">Your details</p>
        <p id={`${id}-summary`} className="mt-3 font-display text-2xl font-semibold tracking-tight">
          {day.long}, {slot.timeLabel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{slot.provider}</p>
      </div>

      <Field
        id={`${id}-name`}
        label="Full name"
        errors={fieldErrors.name}
        input={{
          name: "name",
          required: true,
          maxLength: 100,
          autoComplete: "name",
          value: values.name,
          onChange: set("name"),
        }}
      />
      <Field
        id={`${id}-email`}
        label="Email"
        hint="We'll use this to find your bookings."
        errors={fieldErrors.email}
        input={{
          name: "email",
          type: "email",
          required: true,
          maxLength: 254,
          autoComplete: "email",
          inputMode: "email",
          value: values.email,
          onChange: set("email"),
        }}
      />

      <div aria-live="assertive" aria-atomic="true">
        {formError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {formError}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending || blocked} className="h-12 rounded-full text-[0.9375rem]">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Booking…
          </>
        ) : blocked ? (
          <>
            Try again in <Countdown key={rateLimitedUntil} until={rateLimitedUntil} />
          </>
        ) : (
          "Confirm booking"
        )}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  errors,
  input,
}: {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  input: React.ComponentProps<"input">;
}) {
  const invalid = !!errors?.length;
  const describedBy = [hint && `${id}-hint`, invalid && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-11 bg-white"
        {...input}
      />
      {hint && !invalid && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {errors!.join(" ")}
        </p>
      )}
    </div>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
