"use client";

import {
  Activity,
  CreditCard,
  Database,
  FileCheck,
  GitBranch,
  Landmark,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { FadeIn } from "./FadeIn";

const sources = [
  { Icon: Landmark, label: "Banks" },
  { Icon: CreditCard, label: "Card networks" },
  { Icon: Database, label: "ERP / GL" },
  { Icon: Activity, label: "FX feeds" },
];

const outputs = [
  { Icon: Workflow, label: "Dashboards" },
  { Icon: Zap, label: "Alerts" },
  { Icon: GitBranch, label: "Actions" },
  { Icon: FileCheck, label: "Reports" },
];

function FlowArrow({ delay }: { delay: number }) {
  return (
    <svg
      viewBox="0 0 80 12"
      preserveAspectRatio="none"
      className="h-3 w-full"
      aria-hidden="true"
    >
      <motion.line
        x1={0}
        y1={6}
        x2={76}
        y2={6}
        stroke="hsl(var(--foreground))"
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      />
      <path d="M 70 2 L 78 6 L 70 10" fill="none" stroke="hsl(var(--foreground))" strokeWidth={1} />
    </svg>
  );
}

const badges = [
  {
    heading: "Compliance",
    items: [
      { label: "SOC 2 Type II", note: "In progress" },
      { label: "GDPR-ready", note: "EU data residency" },
      { label: "ISO 27001", note: "In progress" },
    ],
    Icon: ShieldCheck,
  },
  {
    heading: "Integrations",
    items: [
      { label: "Plaid · Tink · FinAPI", note: "Open banking" },
      { label: "Direct bank APIs", note: "JPM, BNP, HSBC, DBS, Mizuho" },
      { label: "NetSuite · SAP · custom SFTP", note: "ERPs and ledgers" },
    ],
    Icon: Workflow,
  },
  {
    heading: "Audit & explainability",
    items: [
      { label: "Full audit log", note: "Every decision tracked" },
      { label: "SHAP-based reasoning", note: "Show your work" },
      { label: "Model versioning", note: "Reproducible forecasts" },
    ],
    Icon: FileCheck,
  },
];

export function ArchitectureSection() {
  return (
    <section
      id="architecture"
      className="scroll-mt-24 px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <FadeIn>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Built for serious infrastructure
          </p>
          <h2
            className="mt-5 max-w-[720px] font-medium leading-[1.05] tracking-[-0.035em]"
            style={{ fontSize: "clamp(28px, 3.5vw, 52px)" }}
          >
            The architecture behind the calm.
          </h2>
          <p className="mt-5 max-w-[580px] text-[16px] leading-[1.65] text-zinc-600">
            Real-time data pipelines. ML models you can audit. Security that
            passes&nbsp;SOC&nbsp;2.
          </p>
        </FadeIn>

        <FadeIn className="mt-10 rounded-3xl border border-zinc-200/80 bg-subtle/40 p-6 md:p-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_50px_1.2fr_50px_1fr] md:items-center md:gap-3 lg:gap-4">
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Data sources
              </div>
              {sources.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-background px-3 py-2.5"
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-700" />
                  <span className="text-[13px]">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="hidden w-full md:block">
                <FlowArrow delay={0.2} />
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                50K evt/s
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-foreground p-6 text-background">
              <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Sight core
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] text-white">
                  Forecast
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] text-white">
                  Radar
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] text-white">
                  Compass
                </div>
              </div>
              <div className="mt-3 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                ML · stream proc · audit
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="hidden w-full md:block">
                <FlowArrow delay={0.5} />
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                &lt;200ms
              </div>
            </div>

            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Outputs
              </div>
              {outputs.map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-background px-3 py-2.5"
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-700" />
                  <span className="text-[13px]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 md:grid-cols-3">
          {badges.map(({ heading, items, Icon }) => (
            <div key={heading} className="bg-background p-6">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-zinc-700" />
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {heading}
                </h3>
              </div>
              <ul className="mt-6 space-y-4">
                {items.map((it) => (
                  <li key={it.label}>
                    <div className="text-[14px] font-medium text-foreground">
                      {it.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {it.note}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}
