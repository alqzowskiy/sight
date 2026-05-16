"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FadeIn } from "./FadeIn";

const voices = [
  {
    id: "maria",
    name: "Maria K.",
    role: "Treasury Analyst",
    company: "NovaPay",
    avatar: "from-zinc-300 to-zinc-500",
    quote:
      "I used to start every morning logging into eight banking portals and copying balances into a spreadsheet. Now I open Sight, see what needs my attention, and approve the recommended transfers. I'm done by 9 a.m.",
  },
  {
    id: "david",
    name: "David R.",
    role: "Head of Treasury",
    company: "Helix Bank",
    avatar: "from-zinc-400 to-zinc-700",
    quote:
      "We replaced four spreadsheets, three dashboards, and a Slack channel with Sight. My team gets back two hours a day. I get to focus on strategy instead of firefighting.",
  },
  {
    id: "anna",
    name: "Anna L.",
    role: "CFO",
    company: "Vector Finance",
    avatar: "from-zinc-500 to-zinc-800",
    quote:
      "We freed up $4M of idle capital in our first quarter on Sight. At our cost of capital, that's a million dollars of value, recurring. The product paid for itself in six weeks.",
  },
];

export function VoicesSection() {
  const [active, setActive] = useState(voices[0].id);
  const current = voices.find((v) => v.id === active) ?? voices[0];

  return (
    <section
      id="voices"
      className="scroll-mt-24 px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <FadeIn>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Voices from treasury
          </p>
          <h2
            className="mt-5 max-w-[720px] font-medium leading-[1.05] tracking-[-0.035em]"
            style={{ fontSize: "clamp(28px, 3.5vw, 52px)" }}
          >
            What teams say after the first month.
          </h2>
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
                <span className="font-medium">{v.name}</span>{" "}
                <span className={isActive ? "text-zinc-400" : "text-zinc-500"}>
                  · {v.role}
                </span>
              </button>
            );
          })}
        </FadeIn>

        <div className="relative mt-8 grid grid-cols-1 gap-10 md:grid-cols-[1.6fr_1fr]">
          <div className="relative min-h-[220px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <blockquote
                  className="font-medium tracking-tight"
                  style={{ fontSize: "clamp(20px, 2.2vw, 32px)", lineHeight: 1.3 }}
                >
                  &ldquo;{current.quote}&rdquo;
                </blockquote>

                <div className="mt-8 flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${current.avatar} font-mono text-sm font-medium text-white/90 ring-2 ring-zinc-100`}
                  >
                    {current.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {current.name}
                    </div>
                    <div className="font-mono text-[13px] text-muted-foreground">
                      {current.role} · {current.company}
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
              className="hidden flex-col gap-6 rounded-2xl border border-zinc-200/80 bg-subtle/40 p-6 md:flex"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Outcomes
              </div>
              {(current.id === "maria"
                ? [
                    { v: "−7h", l: "Manual work / week" },
                    { v: "9 a.m.", l: "Morning routine done" },
                    { v: "8 → 1", l: "Banking portals consolidated" },
                  ]
                : current.id === "david"
                  ? [
                      { v: "−2h", l: "Per analyst, per day" },
                      { v: "4 → 0", l: "Spreadsheets retired" },
                      { v: "0", l: "Slack fire-drills since week 2" },
                    ]
                  : [
                      { v: "+$4M", l: "Idle capital freed Q1" },
                      { v: "6 wks", l: "Time-to-payback" },
                      { v: "$1M+", l: "Recurring annual value" },
                    ]
              ).map((row) => (
                <div key={row.l}>
                  <div className="font-mono text-3xl font-medium tracking-tight text-foreground">
                    {row.v}
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {row.l}
                  </div>
                </div>
              ))}
            </motion.aside>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
