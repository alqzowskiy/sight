"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Floating Copilot button anchored to the bottom-right. Pulled out of the
 * dashboard header to keep that bar focused on real treasury controls.
 *
 * Behaviour:
 *   - Visible everywhere (dashboard, brain, lab) — Copilot is global.
 *   - Hides itself while the panel is open (the slide-over has its own X).
 *   - Cmd/Ctrl+J shortcut already toggles the panel via the AiChatPanel hook;
 *     this component just provides a visible affordance.
 *   - Shows a one-off "Try me" pulse the first time a tenant lands.
 */
export function FloatingCopilotButton() {
  const chatOpen = useUiStore((s) => s.chatOpen);
  const setChatOpen = useUiStore((s) => s.setChatOpen);
  const [hintDismissed, setHintDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "sight.copilotHintDismissed";
    const seen = window.localStorage.getItem(KEY);
    if (!seen) {
      setHintDismissed(false);
    }
  }, []);

  function dismissHint() {
    setHintDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sight.copilotHintDismissed", "1");
    }
  }

  return (
    <AnimatePresence>
      {!chatOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.35, ease }}
          className="fixed bottom-5 right-5 z-30 flex items-end gap-3 lg:bottom-6 lg:right-6"
        >
          {!hintDismissed && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: 0.4, duration: 0.4, ease }}
              className="hidden max-w-[260px] items-start gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-lg md:flex"
            >
              <div className="flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-purple-700">
                  Sight Copilot
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-zinc-700">
                  Ask anything. Try{" "}
                  <span className="font-medium">
                    &ldquo;what is my biggest counterparty risk?&rdquo;
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={dismissHint}
                aria-label="Dismiss hint"
                className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}

          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              dismissHint();
            }}
            aria-label="Open Sight Copilot"
            title="Sight Copilot · ⌘J"
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-600/30 transition-transform hover:scale-105 hover:shadow-purple-600/50"
          >
            {!hintDismissed && (
              <span className="absolute inset-0 animate-ping rounded-full bg-purple-500 opacity-40" />
            )}
            <Sparkles className="h-5 w-5 relative" strokeWidth={1.8} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
