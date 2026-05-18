"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";

interface NumberTickerProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

export function NumberTicker({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 0.5,
  className,
}: NumberTickerProps) {
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (v) => format(v));
  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, motionValue, duration]);

  useEffect(() => {
    return display.on("change", (v) => setText(v));
  }, [display]);

  return <motion.span className={className}>{text}</motion.span>;
}
