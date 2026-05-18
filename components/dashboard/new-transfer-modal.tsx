"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAccountsStore } from "@/lib/store/accounts-store";
import type { TransferChannel } from "@/types";

const CHANNELS: { id: TransferChannel; label: string }[] = [
  { id: "SWIFT", label: "SWIFT" },
  { id: "SEPA", label: "SEPA" },
  { id: "VISA", label: "VISA" },
  { id: "MASTERCARD", label: "Mastercard" },
];

const ease = [0.16, 1, 0.3, 1] as const;

interface NewTransferModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTransferModal({ open, onClose }: NewTransferModalProps) {
  const accounts = useAccountsStore((s) => s.accounts);
  const addAndExecuteTransfer = useAccountsStore((s) => s.addAndExecuteTransfer);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<TransferChannel>("SWIFT");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (accounts.length >= 2 && !from) setFrom(accounts[0].id);
    if (accounts.length >= 2 && !to) setTo(accounts[1].id);
  }, [open, accounts, from, to]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === from),
    [accounts, from],
  );
  const toAccount = useMemo(
    () => accounts.find((a) => a.id === to),
    [accounts, to],
  );

  const canSubmit =
    !!fromAccount &&
    !!toAccount &&
    from !== to &&
    parseFloat(amount) > 0 &&
    !submitting;

  function handleSubmit() {
    if (!canSubmit || !fromAccount || !toAccount) return;
    setSubmitting(true);
    try {
      addAndExecuteTransfer({
        from: fromAccount.id,
        to: toAccount.id,
        fromLocation: fromAccount.location,
        toLocation: toAccount.location,
        channel,
        amount: parseFloat(amount),
        currency: fromAccount.currency,
      });
      toast.success("Transfer initiated.");
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transfer failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setAmount("");
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            className="fixed inset-0 z-[60] bg-zinc-900/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease }}
            className="fixed left-1/2 top-[14%] z-[61] w-[520px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  New transfer
                </div>
                <div className="mt-1 text-[15px] font-medium text-zinc-900">
                  Move money between accounts
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <Label>From</Label>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-[12px] focus:border-zinc-900 focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.currency} · {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ArrowRight className="mb-2 h-3.5 w-3.5 text-zinc-400" />
                <div>
                  <Label>To</Label>
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-[12px] focus:border-zinc-900 focus:outline-none"
                  >
                    {accounts
                      .filter((a) => a.id !== from)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.currency} · {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <div>
                  <Label>
                    Amount{fromAccount ? ` (${fromAccount.currency})` : ""}
                  </Label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100000"
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-[13px] tabular-nums focus:border-zinc-900 focus:outline-none"
                  />
                  {fromAccount && (
                    <div className="mt-1 font-mono text-[10px] text-zinc-400">
                      Available {fromAccount.currency}{" "}
                      {fromAccount.balance.toLocaleString("en-US")}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Channel</Label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as TransferChannel)}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 font-mono text-[11px] focus:border-zinc-900 focus:outline-none"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                Esc to close
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {submitting ? "Sending…" : "Send transfer"}
                <Send className="h-3 w-3" />
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700">
      {children}
    </label>
  );
}
