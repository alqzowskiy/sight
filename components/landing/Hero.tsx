"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, Code2 } from "lucide-react";

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
          {...fade(3)}
          className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Open the live demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/80 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-900 backdrop-blur-md transition-colors hover:border-zinc-900"
          >
            How it works
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <Code2 className="h-3.5 w-3.5" />
            Source
          </a>
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

function Aura() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[80rem] opacity-50 lg:block"
      >
        <div className="absolute left-[8%] top-0 h-[60rem] w-[30rem] -translate-y-[40%] -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(220,38,38,0.08)_0,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0)_80%)]" />
        <div className="absolute left-[12%] top-0 h-[60rem] w-44 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(251,191,36,0.06)_0,rgba(0,0,0,0.02)_80%,transparent_100%)]" />
        <div className="absolute right-[8%] top-0 h-[60rem] w-[30rem] -translate-y-[40%] rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(37,99,235,0.06)_0,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0)_80%)]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 50% 45% at 50% 25%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 50% 45% at 50% 25%, black, transparent 75%)",
          opacity: 0.35,
        }}
      />
    </>
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
