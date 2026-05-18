"use client";

import { motion } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

const GROUPS = [
  {
    heading: "ML pipeline",
    items: [
      { name: "Python 3.13", role: "runtime" },
      { name: "Prophet 1.1", role: "trend + seasonality" },
      { name: "LightGBM 4.6", role: "gradient boosting" },
      { name: "statsmodels 0.14", role: "ARIMA + ETS" },
      { name: "Chronos-T5", role: "Amazon foundation model" },
      { name: "scikit-learn 1.4", role: "Ridge stacker" },
      { name: "SHAP 0.51", role: "feature explanations" },
      { name: "pandas + numpy", role: "data" },
    ],
  },
  {
    heading: "Frontend",
    items: [
      { name: "Next.js 16", role: "App Router" },
      { name: "React 19", role: "UI" },
      { name: "Tailwind CSS 4", role: "styling" },
      { name: "Motion", role: "animations" },
      { name: "cobe", role: "3D globe canvas" },
      { name: "Recharts", role: "charts" },
      { name: "cmdk", role: "command palette" },
      { name: "Zustand", role: "state" },
    ],
  },
  {
    heading: "AI insights",
    items: [
      { name: "AI SDK v6", role: "Vercel SDK" },
      { name: "@ai-sdk/openai", role: "provider" },
      { name: "gpt-4o-mini", role: "OpenAI" },
      { name: "Zod", role: "schema validation" },
    ],
  },
  {
    heading: "Hosting",
    items: [
      { name: "Vercel", role: "single deploy" },
      { name: "Fluid Compute", role: "Node.js runtime" },
      { name: "Vercel CDN", role: "static JSON" },
    ],
  },
];

export function StackSection() {
  return (
    <section
      id="stack"
      className="border-t border-zinc-200/80 bg-[#FAFAFA] px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            What we built with
          </div>
          <h2 className="mt-2 max-w-[640px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
            Standard tools. No magic. No vendor lock-in.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map((g, gi) => (
            <motion.div
              key={g.heading}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: gi * 0.08, ease }}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {g.heading}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                  >
                    <span className="text-zinc-900">{it.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                      {it.role}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
