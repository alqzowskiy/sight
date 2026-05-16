"use client";

import { motion } from "motion/react";
import { AnimatedNumber } from "./AnimatedNumber";
import { FadeIn } from "./FadeIn";

type SparkProps = {
  values: number[];
  delay: number;
};

function Spark({ values, delay }: SparkProps) {
  const W = 220;
  const H = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * (H - 6) - 3;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-6 h-10 w-full"
      aria-hidden="true"
    >
      <motion.path
        d={points}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export function ImpactSection() {
  return (
    <section className="px-6 py-16 md:px-8 md:py-20 lg:py-24">
      <FadeIn className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Impact
        </p>
        <h2 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.03em] md:text-5xl lg:text-6xl">
          The numbers Sight unlocks.
        </h2>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Based on closed-beta customer outcomes · Q4 2025
        </p>
      </FadeIn>

      <div
        aria-hidden="true"
        className="mx-auto mt-16 h-px max-w-5xl"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)) 50%, transparent 50%)",
          backgroundSize: "6px 1px",
        }}
      />

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-3">
        <FadeIn delay={0} className="flex flex-col items-start">
          <div className="font-mono text-7xl font-medium leading-[0.9] tracking-[-0.04em] text-foreground md:text-8xl lg:text-9xl">
            <span className="text-success">−$</span>
            <AnimatedNumber value={7} />
            <span>M</span>
          </div>
          <div className="mt-5 text-base font-medium text-foreground">
            Idle reserves freed up
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Per customer, on average, within 90 days
          </p>
          <Spark values={[28, 24, 26, 22, 18, 14, 11, 9, 8, 7]} delay={0.3} />
        </FadeIn>

        <FadeIn delay={0.1} className="flex flex-col items-start">
          <div className="font-mono text-7xl font-medium leading-[0.9] tracking-[-0.04em] text-foreground md:text-8xl lg:text-9xl">
            <AnimatedNumber value={80} />
            <span className="text-5xl text-success md:text-6xl">%</span>
          </div>
          <div className="mt-5 text-base font-medium text-foreground">
            Fewer overdraft incidents
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Median reduction across pilot customers
          </p>
          <Spark values={[12, 14, 11, 9, 7, 5, 4, 3, 3, 2]} delay={0.4} />
        </FadeIn>

        <FadeIn delay={0.2} className="flex flex-col items-start">
          <div className="font-mono text-7xl font-medium leading-[0.9] tracking-[-0.04em] text-foreground md:text-8xl lg:text-9xl">
            <span className="text-muted-foreground">&lt;</span>
            <AnimatedNumber value={60} />
            <span>s</span>
          </div>
          <div className="mt-5 text-base font-medium text-foreground">
            From alert to executed action
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            One-click rebalancing via best clearing rail
          </p>
          <Spark
            values={[240, 180, 150, 120, 100, 85, 70, 60, 55, 50]}
            delay={0.5}
          />
        </FadeIn>
      </div>
    </section>
  );
}
