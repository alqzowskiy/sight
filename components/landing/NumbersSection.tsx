import { AlertOctagon, Clock, DollarSign, Gauge, TrendingDown, Zap } from "lucide-react";
import { FadeIn } from "./FadeIn";

const cells = [
  {
    Icon: TrendingDown,
    value: "−$7M",
    label: "Idle reserves freed up per customer",
    sub: "On average within 90 days",
    valueClass: "text-success",
  },
  {
    Icon: AlertOctagon,
    value: "80%",
    label: "Overdraft incidents prevented",
    sub: "Across all customer accounts",
  },
  {
    Icon: Zap,
    value: "<60s",
    label: "From alert to executed action",
    sub: "Median across 240+ incidents",
  },
  {
    Icon: DollarSign,
    value: "$2.4M",
    label: "Annual yield gain per $10M freed",
    sub: "At 3.2% money-market rate",
  },
  {
    Icon: Clock,
    value: "6h/wk",
    label: "Manual reconciliation eliminated per analyst",
    sub: "Equivalent of 0.75 FTE",
  },
  {
    Icon: Gauge,
    value: "99.7%",
    label: "Forecast accuracy · 1-day horizon",
    sub: "Industry benchmark: 87%",
  },
];

export function NumbersSection() {
  return (
    <section className="relative bg-zinc-950 px-6 py-16 text-white md:px-10 md:py-20 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            In numbers
          </p>
          <h2
            className="mt-5 font-medium leading-[1.05] tracking-[-0.035em]"
            style={{ fontSize: "clamp(32px, 4vw, 60px)" }}
          >
            What Sight unlocks.
          </h2>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Based on closed-beta customer outcomes · Q4 2025 · n=12 fintech treasury teams
          </p>
        </FadeIn>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 md:mt-16 md:grid-cols-3">
          {cells.map(({ Icon, value, label, sub, valueClass }, i) => (
            <FadeIn
              key={label}
              delay={i * 0.06}
              className="flex flex-col gap-3 bg-zinc-950 p-8 md:p-10"
            >
              <Icon className="h-4 w-4 text-zinc-500" />
              <div
                className={`font-mono font-medium leading-none tracking-tight ${valueClass ?? "text-white"}`}
                style={{ fontSize: "clamp(36px, 4.5vw, 68px)" }}
              >
                {value}
              </div>
              <div className="text-[14px] text-zinc-300">{label}</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                {sub}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
