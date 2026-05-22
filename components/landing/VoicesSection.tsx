"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FadeIn } from "./FadeIn";

// Composite treasury personas synthesized from CustDev conversations and
// secondary research (PwC Treasury Benchmarking, Deloitte Treasury Survey).
// Anonymized by design — each persona corresponds to a real role and corridor,
// and each pain maps to a concrete Sight feature.

const voices = [
  {
    id: "cfo-kzt-usd",
    role: "CFO",
    company: "Mid-market FinTech · KZT/USD corridor",
    avatar: "from-zinc-300 to-zinc-500",
    initials: "CF",
    quote:
      "Reconciling nostro balances and SWIFT confirmations in Excel takes my team two business days a week. When our USD balance in New York drops below the floor, we learn about it from a bank email — that's six to eight hours of scramble and sometimes regulator-facing penalties.",
    pain: "Manual reconciliation + reactive alerts",
    sightAnswer: "Real-time globe + computed alerts ahead of the dip",
    outcomes: [
      { v: "−2d/wk", l: "Manual reconciliation eliminated" },
      { v: "5 days", l: "Earlier warning before the dip" },
      { v: "0", l: "Bank-email surprises" },
    ],
  },
  {
    id: "treasurer-eu-emi",
    role: "Treasurer",
    company: "EU EMI · SEPA & SWIFT corridor",
    avatar: "from-zinc-400 to-zinc-700",
    initials: "TR",
    quote:
      "Five to seven percent of our working capital sits permanently as a buffer against SEPA holiday delays and SWIFT cut-off timing. On a $200M float that's $10-14M of idle cash we can't deploy. Industry surveys confirm we're not unusual — Deloitte puts the average at 10-25%.",
    pain: "Excess reserves against settlement uncertainty",
    sightAnswer: "Liquidity Gradient solver — minimum buffer per channel SLA",
    outcomes: [
      { v: "−47%", l: "Idle reserves on backtest" },
      { v: "$5-8M", l: "Capital freed at $200M float" },
      { v: "14d", l: "Forecast horizon with P10/P90" },
    ],
  },
  {
    id: "compliance-psp",
    role: "Compliance Officer",
    company: "Regulated PSP",
    avatar: "from-zinc-500 to-zinc-800",
    initials: "CO",
    quote:
      "Any autonomous movement of funds between correspondent accounts without explicit treasurer sign-off is an automatic compliance violation. Tell us before the spend happens, don't debit. The market is full of 'AI Autopilot' demos that wouldn't pass our second audit gate.",
    pain: "AI Autopilot demos that break compliance",
    sightAnswer: "Co-pilot model — every transfer requires Execute + audit log",
    outcomes: [
      { v: "0", l: "Autonomous debits" },
      { v: "100%", l: "Human-in-the-loop sign-off" },
      { v: "Day 1", l: "GDPR + SOC 2 roadmap" },
    ],
  },
];

export function VoicesSection() {
  const [active, setActive] = useState(voices[0].id);
  const current = voices.find((v) => v.id === active) ?? voices[0];

  return (
    <section
      id="voices"
      className="scroll-mt-24 border-t border-zinc-200/80 bg-white px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <FadeIn>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Customer development
          </p>
          <h2
            className="mt-5 max-w-[820px] font-medium leading-[1.05] tracking-[-0.035em] text-zinc-950"
            style={{ fontSize: "clamp(28px, 3.5vw, 52px)" }}
          >
            Three treasury roles, three concrete pains.
          </h2>
          <p className="mt-4 max-w-[680px] text-[14px] leading-relaxed text-zinc-600">
            Composite quotes synthesized from CustDev conversations and
            secondary research (PwC, Deloitte). Anonymized by design — each
            persona maps to a real role, a real corridor, and a specific Sight
            feature.
          </p>
        </FadeIn>

        <FadeIn className="mt-8 flex flex-wrap gap-2">
          {voices.map((v) => {
            const isActive = v.id === active;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActive(v.id)}
                className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <span className="font-medium">{v.role}</span>{" "}
                <span className={isActive ? "text-zinc-400" : "text-zinc-500"}>
                  · {v.company.split(" · ")[1] ?? v.company}
                </span>
              </button>
            );
          })}
        </FadeIn>

        <div className="relative mt-8 grid grid-cols-1 gap-10 md:grid-cols-[1.6fr_1fr]">
          <div className="relative min-h-[260px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <blockquote
                  className="font-medium tracking-tight text-zinc-950"
                  style={{
                    fontSize: "clamp(18px, 2vw, 26px)",
                    lineHeight: 1.35,
                  }}
                >
                  &ldquo;{current.quote}&rdquo;
                </blockquote>

                <div className="mt-8 flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${current.avatar} font-mono text-sm font-medium text-white/90 ring-2 ring-zinc-100`}
                  >
                    {current.initials}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-950">
                      {current.role}
                    </div>
                    <div className="font-mono text-[13px] text-zinc-500">
                      {current.company}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid max-w-[520px] grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                      Pain
                    </div>
                    <div className="mt-1 text-[13px] text-zinc-800">
                      {current.pain}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-700">
                      Sight&apos;s answer
                    </div>
                    <div className="mt-1 text-[13px] text-zinc-800">
                      {current.sightAnswer}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.aside
              key={current.id + "-meta"}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="hidden flex-col gap-6 rounded-2xl border border-zinc-200/80 bg-zinc-50 p-6 md:flex"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Outcomes
              </div>
              {current.outcomes.map((row) => (
                <div key={row.l}>
                  <div className="font-mono text-3xl font-medium tracking-tight text-zinc-950">
                    {row.v}
                  </div>
                  <div className="mt-1 text-[13px] text-zinc-600">{row.l}</div>
                </div>
              ))}
            </motion.aside>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
