"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SightLogo } from "@/components/sight/sight-logo";
import { BRAND } from "@/lib/utils/brand";

const SESSION_KEY = "sight-splash-shown";
const TOTAL_MS = 2600;
const ease = [0.16, 1, 0.3, 1] as const;

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    setVisible(true);
    const id = window.setTimeout(() => {
      setVisible(false);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }, TOTAL_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease }}
            className="text-zinc-900"
          >
            <SightLogo size={96} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease }}
            className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500"
          >
            {BRAND.tagline}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
