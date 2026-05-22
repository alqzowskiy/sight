"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Droplet, Shield, Send, Plus } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

interface ActionItem {
  id: "newAccount" | "optimize" | "fxHedge" | "newTransfer";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: "blue" | "teal" | "zinc" | "emerald";
}

const ITEMS: ActionItem[] = [
  {
    id: "newAccount",
    label: "New account",
    hint: "Add a bank account to your treasury",
    icon: Plus,
    accent: "emerald",
  },
  {
    id: "optimize",
    label: "Liquidity Optimizer",
    hint: "Pressure × supply rebalancing across all accounts",
    icon: Droplet,
    accent: "blue",
  },
  {
    id: "fxHedge",
    label: "FX Hedge Advisor",
    hint: "Minimum-variance hedge ratios per position",
    icon: Shield,
    accent: "teal",
  },
  {
    id: "newTransfer",
    label: "New Transfer",
    hint: "Ad-hoc move between accounts",
    icon: Send,
    accent: "zinc",
  },
];

const ACCENT: Record<
  ActionItem["accent"],
  { iconBg: string; iconColor: string }
> = {
  blue: { iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  teal: { iconBg: "bg-teal-50", iconColor: "text-teal-600" },
  zinc: { iconBg: "bg-zinc-100", iconColor: "text-zinc-700" },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
};

export function HeaderActionsMenu({
  onSelect,
}: {
  onSelect: (id: ActionItem["id"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
          open
            ? "border-zinc-900 text-zinc-900"
            : "border-zinc-200/80 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
        }`}
      >
        Actions
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-[280px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl"
          >
            {ITEMS.map((item) => {
              const a = ACCENT[item.accent];
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${a.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${a.iconColor}`} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-zinc-950">
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                      {item.hint}
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
