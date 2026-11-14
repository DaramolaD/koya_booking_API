import { Reveal } from "./motion";

const STATS = [
  { value: "< 1 min", label: "To book online" },
  { value: "6 days", label: "Open every week" },
  { value: "Same week", label: "Appointments" },
  { value: "Free", label: "To cancel" },
];

export function Stats() {
  return (
    <section aria-label="At a glance" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <li key={s.label}>
            <Reveal delay={i * 0.06} className="h-full rounded-lg border border-line p-6 sm:p-8">
              <p className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-none">
                {s.value}
              </p>
              <p className="mt-3 text-[0.6875rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                {s.label}
              </p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
