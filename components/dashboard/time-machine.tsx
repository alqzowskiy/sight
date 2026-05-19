"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { useTimeStore } from "@/lib/store/time-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import {
  formatOffsetLabel,
  getEffectiveStatusAt,
  getDateForOffset,
} from "@/lib/utils/forecast";

const MIN_DAYS = -30;
const MAX_DAYS = 14;
const TICKS = [-30, -14, -7, 0, 7, 14];
const PLAY_INTERVAL_MS = 700;

export function TimeMachine() {
  const offset = useTimeStore((s) => s.currentOffset);
  const isPlaying = useTimeStore((s) => s.isPlaying);
  const setOffset = useTimeStore((s) => s.setOffset);
  const togglePlay = useTimeStore((s) => s.togglePlay);
  const reset = useTimeStore((s) => s.reset);
  const accounts = useAccountsStore((s) => s.accounts);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);

  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const total = MAX_DAYS - MIN_DAYS;
  const pct = ((offset - MIN_DAYS) / total) * 100;
  const todayPct = ((0 - MIN_DAYS) / total) * 100;

  const updateFromClient = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      const days = Math.round(MIN_DAYS + ratio * total);
      setOffset(days);
    },
    [setOffset, total],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClient(e.clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    function move(e: PointerEvent) {
      updateFromClient(e.clientX);
    }
    function up() {
      setDragging(false);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, updateFromClient]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const cur = useTimeStore.getState().currentOffset;
      if (cur >= MAX_DAYS) {
        useTimeStore.setState({ isPlaying: false });
        return;
      }
      useTimeStore.setState({ currentOffset: cur + 1 });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setOffset(Math.max(MIN_DAYS, useTimeStore.getState().currentOffset - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setOffset(Math.min(MAX_DAYS, useTimeStore.getState().currentOffset + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Home") {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOffset, togglePlay, reset]);

  const statusHint = useMemo(() => {
    if (offset <= 0) {
      const critical = accounts.filter((a) => a.status === "critical").length;
      const warn = accounts.filter((a) => a.status === "warning").length;
      if (critical > 0) return `${critical} critical · ${warn} warning`;
      if (warn > 0) return `${warn} warning`;
      return "All healthy";
    }
    let critical = 0;
    let warning = 0;
    for (const a of accounts) {
      const s = getEffectiveStatusAt(a, offset, a.balance);
      if (s === "critical") critical++;
      else if (s === "warning") warning++;
    }
    if (critical > 0) return `${critical} critical · ${warning} warning`;
    if (warning > 0) return `${warning} warning`;
    return "All healthy";
  }, [accounts, offset, activeScenarios]);

  const dateLabel = useMemo(() => {
    const d = getDateForOffset(offset);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [offset]);

  return (
    <div className="flex h-full w-full items-center gap-2 px-3 py-3 lg:gap-4 lg:px-6 lg:py-0">
      <div className="flex items-center gap-1.5">
        <IconButton
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          )}
        </IconButton>
        <IconButton aria-label="Reset to today" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
              Time Machine
            </h3>
            <span className="hidden font-mono text-[10px] text-zinc-400 lg:inline">
              Drag · ←/→ step · Space play
            </span>
          </div>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              offset === 0 ? "text-zinc-700" : "text-zinc-900"
            }`}
          >
            {formatOffsetLabel(offset)} · {dateLabel}
          </span>
        </div>

        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          className="relative h-9 cursor-pointer select-none touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <div
              className="absolute left-0 h-[2px] bg-zinc-300"
              style={{ width: `${todayPct}%` }}
            />
            <div
              className="absolute h-[2px] border-t border-dashed border-zinc-300"
              style={{ left: `${todayPct}%`, width: `${100 - todayPct}%` }}
            />
          </div>

          {TICKS.map((d) => {
            const left = ((d - MIN_DAYS) / total) * 100;
            const isToday = d === 0;
            return (
              <div
                key={d}
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%` }}
              >
                <div
                  className={
                    isToday ? "h-5 w-px bg-zinc-900" : "h-2 w-px bg-zinc-300"
                  }
                />
                <span
                  className={`absolute left-1/2 mt-2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.12em] ${
                    isToday ? "text-zinc-900" : "text-zinc-400"
                  }`}
                >
                  {isToday
                    ? "Today"
                    : d > 0
                      ? `+${d}d`
                      : `${d}d`}
                </span>
              </div>
            );
          })}

          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pct}%` }}
          >
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white shadow-md">
              <div className="text-center">
                {formatOffsetLabel(offset)} · {dateLabel}
              </div>
              <div
                className={`mt-0.5 text-center text-[9px] tracking-[0.1em] ${
                  statusHint.includes("critical")
                    ? "text-red-300"
                    : statusHint.includes("warning")
                      ? "text-amber-300"
                      : "text-emerald-300"
                }`}
              >
                {statusHint}
              </div>
            </div>
            <div
              onPointerDown={onPointerDown}
              className="h-5 w-5 rounded-full border-2 border-zinc-900 bg-white shadow-sm transition-transform hover:scale-110"
              style={{ touchAction: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
    >
      {children}
    </button>
  );
}
