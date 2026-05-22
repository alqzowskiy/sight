"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Show } from "@clerk/nextjs";

const EASE = [0.16, 1, 0.3, 1] as const;

const TECH = [
  { name: "Next.js" },
  { name: "Python" },
  { name: "Prophet" },
  { name: "LightGBM" },
  { name: "ARIMA" },
  { name: "Chronos" },
  { name: "OpenAI" },
  { name: "Vercel" },
];

export function Hero() {
  const fade = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: 0.1 + i * 0.06, ease: EASE },
  });

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-white pt-24 md:pt-28 lg:pt-32"
    >
      <Aura />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center md:px-10">
        <motion.div
          {...fade(0)}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700 backdrop-blur-md"
        >
          <Pulse />
          FinTech hackathon · Live demo ready
        </motion.div>

        <motion.h1
          {...fade(1)}
          className="mt-6 text-balance font-medium leading-[1] tracking-[-0.035em] text-zinc-950"
          style={{ fontSize: "clamp(36px, 5.5vw, 64px)" }}
        >
          Predictive liquidity for fintech treasury.
        </motion.h1>

        <motion.p
          {...fade(2)}
          className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-zinc-600"
        >
          A five-model ML ensemble forecasts every account fourteen days ahead,
          raises alerts before deficits happen, and explains each prediction
          with gpt-4o-mini.
        </motion.p>

        <motion.div
          {...fade(2.5)}
          className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-800"
        >
          <ShieldCheck className="h-3 w-3" strokeWidth={2} />
          AI Co-pilot, not Autopilot · Human-in-the-loop by design
        </motion.div>

        <motion.div
          {...fade(3)}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Open your dashboard
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Show>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Sign up free
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/demo/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/80 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-900 backdrop-blur-md transition-colors hover:border-zinc-900"
              >
                Try public demo
              </Link>
            </Show>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            No credit card · 30s to first forecast · Cancel anytime
          </p>
        </motion.div>
      </div>

      <PreviewDeck />

      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-2 md:px-10">
        <h2 className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Built with the actual ML & frontend stack
        </h2>
        <motion.ul
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12"
        >
          {TECH.map((t) => (
            <li
              key={t.name}
              className="font-mono text-[13px] tracking-tight text-zinc-700"
            >
              {t.name}
            </li>
          ))}
        </motion.ul>
      </section>
    </section>
  );
}

function PreviewDeck() {
  const bottomMask =
    "linear-gradient(to bottom, black 0%, black 80%, transparent 100%)";
  return (
    <div className="relative z-0 mx-auto mt-10 w-full max-w-6xl px-6 pb-24">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 -bottom-2 -z-10 h-32 rounded-[60%]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(10,10,10,0.22), transparent 70%)",
            filter: "blur(32px)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.4, ease: EASE }}
          className="relative overflow-hidden rounded-2xl"
          style={{
            WebkitMaskImage: bottomMask,
            maskImage: bottomMask,
          }}
        >
          <WindowChrome />
          <Image
            src="/preview-dashboard.jpeg"
            alt="Sight dashboard preview"
            width={2880}
            height={1600}
            priority
            className="block h-auto w-full"
          />
        </motion.div>
      </div>
    </div>
  );
}

function WindowChrome() {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200/80 bg-zinc-50 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
      <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        sight.app · /dashboard
      </span>
    </div>
  );
}

/**
 * Hero background — just the dot grid.
 *
 * We tried animated colour orbs + scanning flow lines and they read as
 * SaaS-bro noise on top of a fintech product. Reverted to a single static
 * dot grid masked to the top of the section: gives the page texture without
 * fighting the headline for attention.
 */
function Aura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        maskImage:
          "radial-gradient(ellipse 55% 50% at 50% 25%, black, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 55% 50% at 50% 25%, black, transparent 80%)",
        opacity: 0.35,
      }}
    />
  );
}

function Pulse() {
  return (
    <span className="relative inline-flex h-1.5 w-1.5">
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}
