import { Star } from "lucide-react";
import { FadeIn } from "./FadeIn";

export function QuoteSection() {
  return (
    <section className="px-6 py-16 md:px-8 md:py-20 lg:py-24">
      <FadeIn className="relative mx-auto max-w-3xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-4 -top-12 select-none font-serif text-[180px] leading-none text-zinc-100 md:-top-16 md:text-[240px]"
        >
          &ldquo;
        </span>

        <div className="relative border-l-2 border-foreground/10 pl-8 md:pl-10">
          <blockquote className="text-3xl font-medium leading-[1.25] tracking-[-0.02em] md:text-4xl">
            We replaced four spreadsheets, three dashboards, and a Slack
            channel with Sight. The team gets back two hours a day — and we
            sleep better.
          </blockquote>

          <div className="mt-8 flex items-center gap-1.5" aria-label="5 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5 fill-foreground text-foreground"
              />
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500" />
            <div>
              <div className="text-sm font-medium text-foreground">
                Maria K.
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                Head of Treasury, NovaPay
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
