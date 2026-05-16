import { FadeIn } from "./FadeIn";

const items = [
  {
    n: "01",
    title: "Real-time, not end-of-day.",
    body: "Every transaction updates forecasts within seconds. No batch jobs. No waiting.",
  },
  {
    n: "02",
    title: "Probabilistic, not deterministic.",
    body: "P50, P90, P99 — not a single point estimate. Plan for risk, not averages.",
  },
  {
    n: "03",
    title: "Explainable, not black box.",
    body: "Every recommendation comes with reasoning. Defensible decisions.",
  },
  {
    n: "04",
    title: "Multi-bank, multi-currency.",
    body: "All your nostro accounts, every currency, every clearing channel. One screen.",
  },
];

export function DifferenceSection() {
  return (
    <section className="px-6 py-16 md:px-8 md:py-20 lg:py-24">
      <FadeIn className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Why Sight
        </p>
        <h2 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.03em] md:text-5xl lg:text-6xl">
          Built for treasury, not retrofitted from accounting.
        </h2>
      </FadeIn>

      <FadeIn className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-x-16 gap-y-14 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.n}
            className="group flex gap-5 transition-colors"
          >
            <div className="font-mono text-2xl text-muted-foreground/60 transition-colors group-hover:text-foreground">
              {item.n}
            </div>
            <div className="flex-1 border-l border-zinc-200 pl-6 transition-colors group-hover:border-zinc-400">
              <h3 className="text-xl font-medium tracking-tight">
                {item.title}
              </h3>
              <p className="mt-3 text-base leading-[1.7] text-muted-foreground">
                <span className="mr-1 text-muted-foreground/50">↳</span>
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </FadeIn>
    </section>
  );
}
