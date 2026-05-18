"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { NumberTicker } from "@/components/dashboard/number-ticker";

const ease = [0.16, 1, 0.3, 1] as const;

const HORIZONS = [
  { days: 1, sight: 5.22, naive: 5.92 },
  { days: 3, sight: 4.96, naive: 11.38 },
  { days: 7, sight: 5.89, naive: 6.58 },
  { days: 14, sight: 6.42, naive: 9.78 },
];

export function MetricsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="results"
      ref={ref}
      className="border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Real backtest results
          </div>
          <h2 className="mt-2 max-w-[760px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
            Numbers from an actual walk-forward backtest. Not marketing.
          </h2>
          <p className="mt-4 max-w-[640px] text-[13.5px] leading-relaxed text-zinc-500">
            Sixteen cutoff points over thirty days. Trained on data before each
            cutoff. Predicted what happened after. Compared against three
            baseline forecasters. Every digit on this page is reproducible from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-zinc-900">
              public/data/backtest_results.json
            </code>
            .
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="3-day MAPE"
            value={4.96}
            suffix="%"
            sub="vs naive 11.38%"
            inView={inView}
          />
          <KpiCard
            label="7-day MAPE"
            value={5.89}
            suffix="%"
            sub="vs MA-7 9.65%"
            inView={inView}
          />
          <KpiCard
            label="Deficit detection F1"
            value={1.0}
            decimals={2}
            sub="224 of 224 caught"
            inView={inView}
            accent
          />
          <KpiCard
            label="Forecast horizon"
            value={14}
            suffix="d"
            sub="per account, per day"
            inView={inView}
          />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                MAPE by horizon · lower is better
              </h3>
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                Sight vs naive
              </span>
            </div>
            <div className="space-y-3">
              {HORIZONS.map((h, i) => (
                <HorizonBar
                  key={h.days}
                  label={`${h.days} day${h.days > 1 ? "s" : ""}`}
                  sight={h.sight}
                  naive={h.naive}
                  delay={0.15 + i * 0.08}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Pill
              k="Sight wins"
              v="all 4 horizons"
              sub="across 1d, 3d, 7d, 14d"
            />
            <Pill
              k="11 / 11"
              v="accounts"
              sub="stacker beats every base model"
            />
            <Pill
              k="2.83%"
              v="ensemble holdout MAPE"
              sub="42% better than Prophet alone"
            />
            <Pill
              k="P10 – P90"
              v="calibrated"
              sub="post-hoc conformal correction"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  suffix = "",
  decimals = 2,
  sub,
  inView,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  sub: string;
  inView: boolean;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease }}
      className={`rounded-xl border p-5 ${
        accent
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-[30px] tabular-nums tracking-tight ${
          accent ? "text-emerald-800" : "text-zinc-900"
        }`}
      >
        {inView ? (
          <NumberTicker
            value={value}
            duration={1.0}
            format={(n) => n.toFixed(decimals)}
          />
        ) : (
          value.toFixed(decimals)
        )}
        {suffix}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        {sub}
      </div>
    </motion.div>
  );
}

function HorizonBar({
  label,
  sight,
  naive,
  delay,
}: {
  label: string;
  sight: number;
  naive: number;
  delay: number;
}) {
  const max = Math.max(sight, naive, 12);
  const sightW = `${(sight / max) * 100}%`;
  const naiveW = `${(naive / max) * 100}%`;
  return (
    <div className="grid grid-cols-[60px_1fr_60px] items-center gap-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="space-y-1">
        <div className="relative h-3 overflow-hidden rounded bg-zinc-100">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: sightW }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, delay, ease }}
            className="absolute inset-y-0 left-0 rounded bg-emerald-600"
          />
        </div>
        <div className="relative h-3 overflow-hidden rounded bg-zinc-100">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: naiveW }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, delay: delay + 0.1, ease }}
            className="absolute inset-y-0 left-0 rounded bg-zinc-400"
          />
        </div>
      </div>
      <div className="flex flex-col items-end font-mono text-[10px] tabular-nums">
        <span className="text-emerald-700">{sight}%</span>
        <span className="text-zinc-400">{naive}%</span>
      </div>
    </div>
  );
}

function Pill({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[16px] font-medium tabular-nums text-zinc-900">
          {k}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          {v}
        </span>
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
        {sub}
      </div>
    </div>
  );
}
