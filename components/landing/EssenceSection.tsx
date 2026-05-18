"use client";

import { motion } from "motion/react";
import {
  Eye,
  AlertTriangle,
  Sparkles,
  Shuffle,
} from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS = [
  {
    n: "01",
    icon: Eye,
    title: "See what hasn't happened yet",
    body: "Drag Time Machine. Every account balance, every status colour, every alert recomputes from real ML predictions fourteen days ahead. USD-NYC is fine today, $150K below minimum on day five — you watch it happen.",
    tag: "Time Machine",
  },
  {
    n: "02",
    icon: AlertTriangle,
    title: "Catch the risk before it happens",
    body: "Auto-generated alerts the moment a forecast dips below an account minimum. Severity escalates with how low the dip goes. No manual monitoring of eleven accounts across five currencies.",
    tag: "Predictive alerts",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "Understand why in plain English",
    body: "Click any alert, get a 2-sentence explanation from gpt-4o-mini using the actual forecast numbers. Why the dip is happening, when it bottoms out, and what to do about it.",
    tag: "AI insights",
  },
  {
    n: "04",
    icon: Shuffle,
    title: "Resolve in one click",
    body: "Sight Compass finds the optimal donor account, picks SEPA or SWIFT based on currency pair, sizes the transfer to cover the deficit plus a 20% buffer, executes it. Balance restored, forecast cleared.",
    tag: "One-click resolution",
  },
];

const OUTCOMES = [
  { value: "0", label: "overdrafts on backtest", sub: "all 224 caught early" },
  { value: "−47%", label: "frozen reserves", sub: "fewer just-in-case buffers" },
  { value: "−80%", label: "treasury hours", sub: "from manual monitoring" },
];

export function EssenceSection() {
  return (
    <section
      id="essence"
      className="relative border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <Header />
        <Steps />
        <Outcomes />
      </div>
    </section>
  );
}

function Header() {
  return (
    <div className="mb-16 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          What Sight actually does
        </div>
        <h2 className="mt-2 text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
          Treasury teams react to liquidity crises.{" "}
          <span className="text-zinc-400">Sight predicts and resolves them.</span>
        </h2>
      </div>
      <div className="text-[14px] leading-relaxed text-zinc-600 lg:pt-2">
        <p>
          A fintech treasury team manages dozens of accounts across currencies
          and banks. Clearing delays cause cash gaps. To stay safe they freeze
          millions in idle reserves. They notice problems only after they
          happen, then scramble to rebalance.
        </p>
        <p className="mt-3">
          Sight gives them a forecast, a reason, and a fix — for every account,
          every day, in real time. Four steps below.
        </p>
      </div>
    </div>
  );
}

function Steps() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.article
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
            className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300"
          >
            <div className="mb-5 flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {s.n}
              </span>
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                {s.tag}
              </span>
            </div>
            <Icon
              className="h-6 w-6 text-zinc-950"
              strokeWidth={1.5}
            />
            <h3 className="mt-4 text-[18px] font-medium tracking-tight text-zinc-950">
              {s.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
              {s.body}
            </p>
          </motion.article>
        );
      })}
    </div>
  );
}

function Outcomes() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mt-12 grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-zinc-950 p-2 sm:grid-cols-3"
    >
      {OUTCOMES.map((o) => (
        <div
          key={o.label}
          className="rounded-xl bg-zinc-900/60 px-5 py-5 text-white"
        >
          <div className="font-mono text-[28px] tabular-nums tracking-tight text-emerald-400">
            {o.value}
          </div>
          <div className="mt-1 text-[13px] text-zinc-100">{o.label}</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            {o.sub}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
