"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  heading: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: "Time Machine",
    items: [
      { keys: ["←"], description: "Step one day backward" },
      { keys: ["→"], description: "Step one day forward" },
      { keys: ["Space"], description: "Play or pause auto-advance" },
      { keys: ["Home"], description: "Reset to today" },
    ],
  },
  {
    heading: "Navigation",
    items: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["Esc"], description: "Close modal or palette" },
      { keys: ["?"], description: "Show this overlay" },
    ],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] bg-zinc-950/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease }}
            className="fixed left-1/2 top-[18%] z-[81] w-[440px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-zinc-200/80 px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  Shortcuts
                </div>
                <h2 className="mt-0.5 text-[15px] font-medium text-zinc-900">
                  Keyboard reference
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="space-y-5 px-5 py-5">
              {GROUPS.map((group) => (
                <section key={group.heading}>
                  <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {group.heading}
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li
                        key={item.description}
                        className="flex items-center justify-between gap-3 text-[12px]"
                      >
                        <span className="text-zinc-700">
                          {item.description}
                        </span>
                        <span className="flex items-center gap-1">
                          {item.keys.map((k) => (
                            <kbd
                              key={k}
                              className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <footer className="border-t border-zinc-200/80 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
              Press ? again to dismiss
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
