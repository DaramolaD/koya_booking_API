import { Leaf } from "lucide-react";
import { SITE } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Leaf className="size-5 text-sage" aria-hidden />
            {SITE.name}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Unhurried, everyday care. Book, manage and cancel appointments online.
          </p>
        </div>

        <div>
          <h2 className="eyebrow">Hours</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {SITE.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{h.days}</dt>
                <dd className="tabular-nums">{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h2 className="eyebrow">Contact</h2>
          <address className="mt-4 space-y-2 text-sm not-italic">
            <p>{SITE.address}</p>
            <p>
              <a href={`mailto:${SITE.email}`} className="rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {SITE.email}
              </a>
            </p>
            <p className="tabular-nums">{SITE.phone}</p>
          </address>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-7xl px-5 py-6 text-xs leading-relaxed text-muted-foreground sm:px-8">
          {SITE.name} is a fictional clinic built as a demo project. In a medical emergency, call your
          local emergency number. Photography from Unsplash.
        </p>
      </div>
    </footer>
  );
}
