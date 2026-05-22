"use client";

import Link from "next/link";
import { ArrowUpRight, Code2 } from "lucide-react";
import { SightLogo } from "@/components/sight/sight-logo";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200/80 bg-white px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <SightLogo size={22} />
              <span className="font-mono text-[13px] tracking-tight text-zinc-900">
                Sight
              </span>
            </div>
            <p className="mt-3 max-w-[280px] text-[12px] leading-relaxed text-zinc-500">
              Predictive liquidity management for fintech treasury teams. Built
              for the FinTech hackathon track as a working prototype of the
              architecture.
            </p>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              Hackathon project · Not for production use
            </div>
          </div>

          <FooterCol
            title="Product"
            items={[
              { label: "Live demo", href: "/dashboard" },
              { label: "Sight Lab", href: "/dashboard/lab" },
              { label: "Crisis Mode", href: "/dashboard/crisis" },
              { label: "Attestation", href: "/attestation" },
            ]}
          />

          <FooterCol
            title="Concept"
            items={[
              { label: "How it works", href: "/#how-it-works" },
              { label: "ML ensemble", href: "/#models" },
              { label: "Backtest results", href: "/#results" },
              { label: "Tech stack", href: "/#stack" },
            ]}
          />

          <FooterCol
            title="Source"
            items={[
              { label: "GitHub", href: "https://github.com/alqzowskiy/sight", external: true },
              {
                label: "Next.js docs",
                href: "https://nextjs.org",
                external: true,
              },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-zinc-200/80 pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 md:flex-row md:items-center">
          <span>© 2026 Sight · Predictive treasury for fintech</span>
          <a
            href="https://github.com/alqzowskiy/sight"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <Code2 className="h-3 w-3" />
            View source
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h4>
      <ul className="mt-3 space-y-2">
        {items.map((it) =>
          it.external ? (
            <li key={it.label}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-zinc-700 transition-colors hover:text-zinc-900"
              >
                {it.label}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </li>
          ) : (
            <li key={it.label}>
              <Link
                href={it.href}
                className="text-[12px] text-zinc-700 transition-colors hover:text-zinc-900"
              >
                {it.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
