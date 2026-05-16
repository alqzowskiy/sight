"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LiveWidget } from "./LiveWidget";

const ease = [0.16, 1, 0.3, 1] as const;

function stagger(i: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: 0.2 + i * 0.08, ease },
  };
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 pt-24 md:px-10 md:pt-28 lg:px-16 lg:pt-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 20%, rgba(0,0,0,0.05), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 60% 60% at 80% 50%, black, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 60% at 80% 50%, black, transparent 70%)",
          opacity: 0.35,
        }}
      />

      <div className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-[1280px] grid-cols-12 items-start gap-8 pb-12 pt-[10vh]">
        <div className="col-span-12 lg:col-span-7">
          <motion.a
            href="#beta"
            {...stagger(0)}
            className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/50 px-3 py-1.5 font-mono text-[12px] tracking-wider text-zinc-700 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:border-zinc-300"
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Private beta · 12 fintech teams onboarded
          </motion.a>

          <motion.h1
            {...stagger(1)}
            className="mt-6 font-medium leading-[0.95] tracking-[-0.04em] text-foreground"
            style={{ fontSize: "clamp(40px, 5.5vw, 80px)" }}
          >
            See your money&rsquo;s
            <br />
            <span className="relative inline-block">
              <span
                aria-hidden="true"
                className="absolute inset-x-[-0.08em] bottom-[0.12em] top-[0.18em] -z-10"
                style={{ backgroundColor: "rgba(251,191,36,0.35)" }}
              />
              future
            </span>
            .{" "}
            <span className="text-zinc-400">Move first.</span>
          </motion.h1>

          <motion.p
            {...stagger(2)}
            className="mt-8 max-w-[540px] text-zinc-600"
            style={{ fontSize: "clamp(17px, 1.4vw, 20px)", lineHeight: 1.55 }}
          >
            Sight predicts liquidity gaps 3 to 7 days ahead — and tells your
            treasury team exactly which transfer to execute, before any
            problem reaches your accounts.
          </motion.p>

          <motion.div
            {...stagger(3)}
            className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <a
              href="#request"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
            >
              Request access
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="#demo"
              className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-foreground transition-all hover:gap-2"
            >
              Book a 20-min demo
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </motion.div>

          <motion.p
            {...stagger(4)}
            className="mt-5 font-mono text-[11px] uppercase tracking-wider text-zinc-500"
          >
            SOC 2 in progress · No credit card · 14-day onboarding
          </motion.p>
        </div>

        <motion.div
          {...stagger(5)}
          className="col-span-12 lg:col-span-5"
        >
          <LiveWidget />
        </motion.div>
      </div>
    </section>
  );
}
