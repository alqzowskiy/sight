import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";

const tiers = [
  {
    name: "Scale",
    price: "$3K/mo",
    note: "Up to 10 accounts, 1 currency cluster",
  },
  {
    name: "Growth",
    price: "$9K/mo",
    note: "Up to 30 accounts, multi-currency",
  },
  {
    name: "Enterprise",
    price: "Custom",
    note: "Unlimited, dedicated support, on-prem option",
  },
];

export function CtaSection() {
  return (
    <section
      id="pricing"
      className="relative scroll-mt-24 overflow-hidden bg-zinc-50 px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,0,0,0.04), transparent 70%)",
        }}
      />

      <FadeIn className="relative mx-auto max-w-3xl text-center">
        <h2
          className="font-medium leading-[0.95] tracking-[-0.04em]"
          style={{ fontSize: "clamp(40px, 5vw, 72px)" }}
        >
          Start seeing.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] text-zinc-600">
          Sight is in private beta with 12 fintech treasury teams. We&rsquo;re
          onboarding 5 more this quarter.
        </p>
      </FadeIn>

      <FadeIn className="relative mx-auto mt-10 max-w-3xl">
        <div className="rounded-2xl border border-zinc-200 bg-background p-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Beta pricing — annual · USD
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
              · locked 24mo post-GA
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className="bg-background p-6">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t.name}
                </div>
                <div className="mt-2 font-mono text-2xl font-medium tracking-tight md:text-3xl">
                  {t.price}
                </div>
                <p className="mt-2 text-[13px] text-zinc-600">{t.note}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn className="relative mt-10 flex flex-col items-center gap-4 text-center">
        <a
          href="#request"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
        >
          Request access
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          30-day response · No commitment · NDAs available
        </p>
      </FadeIn>
    </section>
  );
}
