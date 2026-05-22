"use client";

import { motion } from "motion/react";
import { Building2, Banknote, FileSpreadsheet, Network } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

const STATS = [
  {
    value: "$150T+",
    label: "Annual B2B payment flows",
    source: "McKinsey · Capgemini",
  },
  {
    value: "$5-6B",
    label: "Treasury Management Software TAM",
    source: "Verified Market Research 2025",
  },
  {
    value: "10-25%",
    label: "Working capital frozen as buffer",
    source: "Deloitte Treasury Survey",
  },
  {
    value: "#1+#2",
    label: "Forecast accuracy & Excel — top pains",
    source: "PwC Treasury Benchmarking",
  },
];

const INCIDENTS = [
  {
    icon: Building2,
    year: "2023",
    name: "Silicon Valley Bank collapse",
    loss: "$200B+ deposits",
    cause:
      "Overnight illiquidity. Many fintechs held 80%+ of cash in a single counterparty.",
    fix: "Concentration Card (HHI) — tracks share of portfolio in any one bank.",
  },
  {
    icon: Network,
    year: "2024",
    name: "Synapse bankruptcy",
    loss: "$85M+ in limbo",
    cause:
      "Banking-as-a-service ledger discrepancies. Internal records desynced from real correspondent balances.",
    fix: "Versioned JSON contract between ML and UI. Conformal P10/P90 instead of point estimates.",
  },
  {
    icon: Banknote,
    year: "2023",
    name: "Credit Suisse emergency rescue",
    loss: "$1.6T balance sheet",
    cause:
      "Counterparty risk materialized worldwide. Treasurers had hours to reposition.",
    fix: "Counterparty dimension in HHI. Roadmap: contagion graph for second-order exposures.",
  },
  {
    icon: FileSpreadsheet,
    year: "2012",
    name: "JPMorgan London Whale",
    loss: "$6.2B trading loss",
    cause:
      "Excel copy-paste error in VaR model. Risk math used sum instead of average — passed review.",
    fix: "Liquidity Gradient solver in typed code. No Excel. All math is tested and versioned.",
  },
];

export function IndustryContextSection() {
  return (
    <section
      id="industry"
      className="relative border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <Header />
        <Stats />
        <Incidents />
        <Footnote />
      </div>
    </section>
  );
}

function Header() {
  return (
    <div className="mb-16 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Why Sight exists
        </div>
        <h2 className="mt-2 text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
          Treasury failures are predictable.{" "}
          <span className="text-zinc-400">We just don&apos;t watch them.</span>
        </h2>
      </div>
      <div className="text-[14px] leading-relaxed text-zinc-600 lg:pt-2">
        <p>
          Every major treasury blow-up of the last decade — SVB, Credit Suisse,
          Synapse, the London Whale — shared the same pattern. A risk was
          visible in the data. Nobody had the tools to see it in time.
        </p>
        <p className="mt-3">
          Sight is built directly against this pattern. Each feature below is a
          response to a documented failure, grounded in the same industry
          research that treasury benchmarking firms publish every year.
        </p>
      </div>
    </div>
  );
}

function Stats() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STATS.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: i * 0.06, ease: EASE }}
          className="rounded-2xl border border-zinc-200 bg-white p-5"
        >
          <div className="font-mono text-[26px] font-medium tabular-nums tracking-tight text-zinc-950 md:text-[30px]">
            {s.value}
          </div>
          <div className="mt-1 text-[13px] leading-snug text-zinc-700">
            {s.label}
          </div>
          <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            {s.source}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Incidents() {
  return (
    <div className="mt-12">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        Each Sight feature is a response to a real failure
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {INCIDENTS.map((inc, i) => {
          const Icon = inc.icon;
          return (
            <motion.article
              key={inc.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.07, ease: EASE }}
              className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300"
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                  {inc.year}
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-red-700">
                  {inc.loss}
                </span>
              </div>
              <Icon className="h-6 w-6 text-zinc-950" strokeWidth={1.5} />
              <h3 className="mt-4 text-[18px] font-medium tracking-tight text-zinc-950">
                {inc.name}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
                {inc.cause}
              </p>
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                  Sight&apos;s answer
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-700">
                  {inc.fix}
                </p>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function Footnote() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-[12px] leading-relaxed text-zinc-600"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        Sources
      </span>
      <span className="ml-3">
        McKinsey Global Payments Report · Capgemini World Payments Report · PwC
        Global Treasury Benchmarking Survey · Deloitte Global Treasury Survey ·
        Verified Market Research Treasury Management Systems Report 2025.
        Incident details from SEC filings, FDIC receivership reports, FRB
        post-mortems, and public investigative journalism.
      </span>
    </motion.div>
  );
}
