"use client";

import { motion } from "motion/react";

export function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl px-6 md:px-8">
      <motion.div
        className="h-px origin-left bg-zinc-200"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
