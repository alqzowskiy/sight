import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-zinc-900",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-[22px] font-medium tabular-nums tracking-tight ${TONE[tone]}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          {hint}
        </div>
      )}
    </div>
  );
}
