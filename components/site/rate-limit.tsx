"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Seconds left until `until`. Callers remount with key={until}. */
function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [until]);

  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export function Countdown({ until }: { until: number }) {
  return <span className="tabular-nums">{useCountdown(until)}s</span>;
}

function RateLimitMessage({ until }: { until: number }) {
  const seconds = useCountdown(until);
  return seconds > 0 ? (
    <span>
      Too many attempts. Try again in <strong className="tabular-nums">{seconds}s</strong>.
    </span>
  ) : (
    <span>You can try again now.</span>
  );
}

const FALLBACK_SECONDS = 10;

/** Shows the 429 toast and returns when the client may retry. */
export function showRateLimitToast(retryAfterSeconds?: number) {
  const seconds = retryAfterSeconds ?? FALLBACK_SECONDS;
  const until = Date.now() + seconds * 1000;
  toast.error(<RateLimitMessage until={until} />, {
    id: "rate-limit",
    duration: seconds * 1000 + 1500,
  });
  return until;
}
