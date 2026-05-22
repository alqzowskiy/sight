"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Send, Sparkles, X, Wrench } from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";
import { formatCompact } from "@/lib/utils/format";

const ease = [0.16, 1, 0.3, 1] as const;

type ToolPart = {
  type: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  state?: string;
};

/**
 * Slide-over chat panel powered by /api/v1/chat. Multi-turn conversation
 * with the Sight Copilot — supports tool calls (simulateTransfer,
 * getConcentration, triggerCounterpartyTest).
 *
 * Opens via the keyboard shortcut Cmd+J or the chat button in the header.
 */
export function AiChatPanel() {
  const open = useUiStore((s) => s.chatOpen);
  const setOpen = useUiStore((s) => s.setChatOpen);
  const focusedAccountId = useUiStore((s) => s.selectedAccountId);

  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/v1/chat",
      body: () => ({
        accountId: focusedAccountId ?? undefined,
      }),
    }),
  });

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  // Cmd+J / Ctrl+J to toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming") return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-zinc-900/10 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[440px] flex-col border-l border-zinc-200 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between border-b border-zinc-200/80 px-5 py-4">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  Sight Copilot
                </div>
                <h2 className="mt-1 text-[15px] font-medium text-zinc-900">
                  Conversational treasury
                </h2>
                <p className="mt-1 text-[12px] leading-snug text-zinc-500">
                  Ask anything. Sight can simulate transfers, run HHI snapshots,
                  and what-if counterparty defaults.
                </p>
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

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && <EmptyState />}
              {messages.map((m) => (
                <MessageView key={m.id} message={m} />
              ))}
              {status === "streaming" && (
                <div className="text-[11px] text-zinc-400">…</div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  Error: {error.message}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-zinc-200/80 px-4 py-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask why USD-NYC is at risk, or 'what if JPMorgan defaults'..."
                className="flex-1 rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
                disabled={status === "streaming"}
              />
              {status === "streaming" ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200"
                >
                  <Send className="h-3 w-3" strokeWidth={2} />
                  Send
                </button>
              )}
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  const suggestions = [
    "What's our biggest counterparty risk right now?",
    "What if JPMorgan defaults for 7 days?",
    "Simulate $500K from EUR-Frankfurt to USD-NYC",
    "Show me concentration by currency",
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          AI Co-pilot, not Autopilot
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-700">
          Sight Copilot can compute hypotheticals using live tools, but every
          actual money movement still requires your explicit Execute click in
          the dashboard.
        </p>
      </div>

      <div className="space-y-1">
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          Try asking
        </div>
        {suggestions.map((s) => (
          <SuggestionPill key={s} text={s} />
        ))}
      </div>
    </div>
  );
}

function SuggestionPill({ text }: { text: string }) {
  // Just visual — actual click handler set via window event from MessageView
  // No-op fallback; we keep it static for the demo.
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700">
      &ldquo;{text}&rdquo;
    </div>
  );
}

function MessageView({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-3.5 py-2 text-[13px] leading-relaxed text-white">
          {extractText(message)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message.parts.map((part, i) => {
        const p = part as ToolPart;
        if (p.type === "text") {
          const text = (p as unknown as { text?: string }).text ?? "";
          if (!text) return null;
          return (
            <div
              key={i}
              className="max-w-[90%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-3.5 py-2 text-[13px] leading-relaxed text-zinc-800"
            >
              {text}
            </div>
          );
        }
        if (p.type.startsWith("tool-")) {
          return <ToolCallCard key={i} part={p} />;
        }
        return null;
      })}
    </div>
  );
}

function extractText(m: UIMessage): string {
  return m.parts
    .filter((p) => (p as ToolPart).type === "text")
    .map((p) => (p as unknown as { text?: string }).text ?? "")
    .join("");
}

function ToolCallCard({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  const isExecuting =
    part.state === "input-streaming" || part.state === "input-available";
  const output = part.output ?? part.result;
  const input = part.input ?? part.args;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600">
        <Wrench className="h-3 w-3" strokeWidth={2} />
        Sight {isExecuting ? "is calling" : "called"} <span className="font-medium text-zinc-900">{name}</span>
      </div>
      {input != null && (
        <div className="mt-1.5 text-[11px] leading-snug text-zinc-500">
          {summarizeArgs(name, input)}
        </div>
      )}
      {output != null && <ToolOutputSummary name={name} output={output} />}
    </div>
  );
}

function summarizeArgs(_name: string, args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const entries = Object.entries(args as Record<string, unknown>);
  return entries
    .map(([k, v]) => `${k}: ${typeof v === "number" ? formatNumberCompact(v) : v}`)
    .join(" · ");
}

function formatNumberCompact(v: number): string {
  if (Math.abs(v) >= 1000) return formatCompact(v, "USD");
  return String(v);
}

function ToolOutputSummary({
  name,
  output,
}: {
  name: string;
  output: unknown;
}) {
  if (typeof output !== "object" || output === null) {
    return (
      <div className="mt-1.5 font-mono text-[10px] tabular-nums text-zinc-700">
        {String(output)}
      </div>
    );
  }
  const o = output as Record<string, unknown>;
  if (o.error) {
    return (
      <div className="mt-1.5 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
        {String(o.error)}
      </div>
    );
  }

  if (name === "simulateTransfer") {
    const from = o.from as Record<string, unknown> | undefined;
    const to = o.to as Record<string, unknown> | undefined;
    if (!from || !to) return null;
    return (
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
        <SimSide title="From" data={from} />
        <SimSide title="To" data={to} />
        <div className="col-span-2 mt-1 rounded bg-white px-2 py-1.5 text-[11px] text-zinc-700">
          {String(o.recommendation ?? "")}
        </div>
      </div>
    );
  }

  if (name === "getConcentration") {
    return (
      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
        <Stat label="HHI" value={String(o.hhi)} />
        <Stat label="Risk-adj" value={String(o.hhiRiskAdjusted)} />
        <Stat label="Level" value={String(o.level)} />
        <Stat label="Top" value={(o.breakdown as Array<{ key: string; share: number }>)?.[0]?.key ?? "—"} />
      </div>
    );
  }

  if (name === "triggerCounterpartyTest") {
    return (
      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
        <Stat label="Bank" value={String(o.bank ?? "")} />
        <Stat label="Frozen USD" value={formatCompact(Number(o.frozenUsd ?? 0), "USD")} />
        <Stat label="HHI after" value={String(o.hhiAfter ?? "—")} />
        <Stat label="Top survivor" value={String(o.topSurvivorBank ?? "—")} />
        <div className="col-span-2 mt-1 rounded bg-white px-2 py-1.5 text-[11px] text-zinc-700">
          {String(o.interpretation ?? "")}
        </div>
      </div>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white px-2 py-1">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </div>
      <div className="font-mono text-[11px] tabular-nums text-zinc-900">
        {value}
      </div>
    </div>
  );
}

function SimSide({ title, data }: { title: string; data: Record<string, unknown> }) {
  const before = Number(data.balanceBefore ?? 0);
  const after = Number(data.balanceAfter ?? 0);
  const currency = String(data.currency ?? "USD");
  const status = String(data.statusAfter ?? "");
  return (
    <div className="rounded bg-white px-2 py-1.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
        {title} · {String(data.id ?? "")}
      </div>
      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-700">
        {formatCompact(before, currency)} → {formatCompact(after, currency)}
      </div>
      <div
        className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
          status === "critical"
            ? "text-red-600"
            : status === "warning"
              ? "text-amber-600"
              : "text-emerald-600"
        }`}
      >
        {status}
      </div>
    </div>
  );
}
