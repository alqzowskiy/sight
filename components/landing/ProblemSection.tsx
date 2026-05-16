"use client";

import { motion } from "motion/react";
import { FadeIn } from "./FadeIn";

const declineBars = [0.95, 0.88, 0.82, 0.78, 0.62, 0.55, 0.46, 0.38, 0.31, 0.22];

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative scroll-mt-24 px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-5">
          <FadeIn>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              The problem, in plain terms
            </p>
            <h2
              className="mt-5 font-medium leading-[0.95] tracking-[-0.04em]"
              style={{ fontSize: "clamp(36px, 4.5vw, 72px)" }}
            >
              Treasury teams
              <br />
              fly blind.
            </h2>
            <div className="mt-8 max-w-[460px] space-y-4 text-[16px] leading-[1.65] text-zinc-600">
              <p>
                Every day, fifteen million dollars sits frozen on your nostro
                accounts while another account quietly dips into overdraft.
                SWIFT delays for two days. SEPA pauses for a holiday. Black
                Friday hits.
              </p>
              <p>
                Your team finds out — after the fact, after the fees, after
                the missed payouts.
              </p>
            </div>
          </FadeIn>
        </div>

        <div
          aria-hidden="true"
          className="col-span-12 hidden md:col-span-1 md:flex md:justify-center"
        >
          <div className="h-full w-px border-l border-dashed border-zinc-200" />
        </div>

        <div className="col-span-12 md:col-span-6">
          <FadeIn>
            <div className="border-t-2 border-zinc-900 pt-8">
              <div className="flex items-end justify-between gap-4">
                <div
                  className="font-mono font-medium leading-none tracking-tight text-foreground"
                  style={{ fontSize: "clamp(48px, 6vw, 88px)" }}
                >
                  $15M
                </div>
                <div className="flex h-16 items-end gap-1">
                  {declineBars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h * 64}px` }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{
                        duration: 0.6,
                        delay: 0.3 + i * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="w-2 rounded-sm bg-zinc-900"
                    />
                  ))}
                </div>
              </div>
              <p className="mt-6 max-w-[460px] text-[16px] text-zinc-700">
                Average idle reserve held by mid-size fintechs to insure
                against forecast errors.
              </p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
                Industry survey, 2024 · n=147
              </p>
            </div>
          </FadeIn>

          <FadeIn className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="border-t border-zinc-200 pt-6">
              <div className="font-mono text-4xl font-medium tracking-tight md:text-5xl">
                65%
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Treasury time on manual reconciliation
              </p>
            </div>
            <div className="border-t border-zinc-200 pt-6">
              <div className="font-mono text-4xl font-medium tracking-tight md:text-5xl">
                2–5 days
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Average clearing delay across rails
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
