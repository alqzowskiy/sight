"use client";

import { motion } from "motion/react";
import { Sparkles, ArrowDown } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const REQUEST_LINES = [
  { k: "POST", v: "/api/insights" },
  { k: "accountId", v: '"usd-nyc"' },
  { k: "dayOffset", v: "5" },
  { k: "context", v: '"crisis: swift-outage"' },
];

const SAMPLE_INSIGHT = `The account balance is forecasted to drop to $150,233 by May 23, which is significantly below the required minimum of $800,000. This stems from cumulative low forecasted balances on May 22 ($244K) and May 23 ($150K). To mitigate, consider increasing liquidity through funding or reducing outflows before these dates.`;

const SHAP_FACTORS = [
  { label: "Recent 7-day trend", impact: -82, color: "bg-red-500" },
  { label: "Monthly cycle", impact: -47, color: "bg-red-400" },
  { label: "Payday approaching", impact: 22, color: "bg-emerald-500" },
  { label: "Pending SWIFT inflows", impact: 15, color: "bg-emerald-400" },
];

export function AiSection() {
  return (
    <section
      id="ai"
      className="border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Predictions + explanations
            </div>
            <h2 className="mt-2 max-w-[680px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
              ML predicts the number. GPT-4o-mini explains why.
            </h2>
          </div>
          <p className="hidden max-w-[320px] text-[13px] leading-relaxed text-zinc-500 md:block">
            Two AI layers stacked. Predictive answers “what will happen”.
            Generative answers “why and what to do”.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease }}
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                request · live OpenAI call
              </span>
              <RequestPulse />
            </div>
            <div className="space-y-1.5 font-mono text-[11.5px]">
              {REQUEST_LINES.map((line) => (
                <div key={line.k} className="flex items-baseline gap-3">
                  <span className="w-[88px] shrink-0 text-zinc-500">
                    {line.k}
                  </span>
                  <span className="text-zinc-100">{line.v}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-5">
              <div className="rounded-lg bg-zinc-900/60 p-3 font-mono text-[10px] leading-relaxed text-zinc-300">
                <span className="text-zinc-500">model:</span> gpt-4o-mini
                <br />
                <span className="text-zinc-500">temperature:</span> 0.4
                <br />
                <span className="text-zinc-500">max_tokens:</span> 250
              </div>
              <div className="mt-4 flex items-center justify-center text-zinc-700">
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: 0.1, ease }}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                649 tokens · 1.2s
              </span>
            </div>
            <Typewriter text={SAMPLE_INSIGHT} />

            <div className="mt-5 border-t border-zinc-100 pt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Why the model predicted this · SHAP top factors
              </div>
              <div className="space-y-1.5">
                {SHAP_FACTORS.map((f, i) => (
                  <ShapBar key={f.label} {...f} delay={0.6 + i * 0.12} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Typewriter({ text }: { text: string }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="text-[13px] leading-relaxed text-zinc-800"
    >
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35 + i * 0.018, duration: 0.18 }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.p>
  );
}

function ShapBar({
  label,
  impact,
  color,
  delay,
}: {
  label: string;
  impact: number;
  color: string;
  delay: number;
}) {
  const abs = Math.abs(impact);
  const sign = impact < 0 ? "-" : "+";
  const width = `${Math.min(100, abs)}%`;
  return (
    <div className="grid grid-cols-[180px_1fr_56px] items-center gap-3">
      <span className="text-[11px] text-zinc-700">{label}</span>
      <div className="relative h-2 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
          className={`absolute inset-y-0 left-0 rounded-full ${color}`}
        />
      </div>
      <span
        className={`text-right font-mono text-[10px] tabular-nums ${
          impact < 0 ? "text-red-700" : "text-emerald-700"
        }`}
      >
        {sign}${abs}K
      </span>
    </div>
  );
}

function RequestPulse() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-400">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}
