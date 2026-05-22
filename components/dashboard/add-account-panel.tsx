"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Loader2 } from "lucide-react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { toast } from "sonner";

const ease = [0.16, 1, 0.3, 1] as const;

type Currency = "USD" | "EUR" | "GBP" | "SGD" | "CHF" | "KZT" | "AED" | "JPY";
type AccountType = "operational" | "settlement" | "reserve" | "fx_hedge";

const CURRENCIES: Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "KZT",
  "CHF",
  "SGD",
  "AED",
  "JPY",
];

const ACCOUNT_TYPES: { id: AccountType; label: string; hint: string }[] = [
  { id: "operational", label: "Operational", hint: "Daily ops account" },
  { id: "settlement", label: "Settlement", hint: "Card / merchant settlement" },
  { id: "reserve", label: "Reserve", hint: "Safety buffer / compliance" },
  { id: "fx_hedge", label: "FX hedge", hint: "Forwards + cross-currency" },
];

// Mirror the onboarding wizard preset list so cities + ISO countries stay in sync.
const CITY_PRESETS: {
  city: string;
  country: string;
  location: [number, number];
}[] = [
  { city: "Almaty", country: "KZ", location: [43.24, 76.92] },
  { city: "Astana", country: "KZ", location: [51.17, 71.43] },
  { city: "Aktau", country: "KZ", location: [43.65, 51.16] },
  { city: "Atyrau", country: "KZ", location: [47.12, 51.92] },
  { city: "Shymkent", country: "KZ", location: [42.32, 69.59] },
  { city: "Tashkent", country: "UZ", location: [41.31, 69.28] },
  { city: "Bishkek", country: "KG", location: [42.87, 74.59] },
  { city: "Moscow", country: "RU", location: [55.75, 37.62] },
  { city: "Baku", country: "AZ", location: [40.41, 49.86] },
  { city: "Amsterdam", country: "NL", location: [52.37, 4.9] },
  { city: "Berlin", country: "DE", location: [52.52, 13.4] },
  { city: "Frankfurt", country: "DE", location: [50.11, 8.68] },
  { city: "London", country: "GB", location: [51.5, -0.12] },
  { city: "Paris", country: "FR", location: [48.85, 2.35] },
  { city: "Zurich", country: "CH", location: [47.37, 8.54] },
  { city: "Warsaw", country: "PL", location: [52.23, 21.01] },
  { city: "New York", country: "US", location: [40.71, -74.0] },
  { city: "San Francisco", country: "US", location: [37.77, -122.41] },
  { city: "Dubai", country: "AE", location: [25.2, 55.27] },
  { city: "Riyadh", country: "SA", location: [24.71, 46.68] },
  { city: "Istanbul", country: "TR", location: [41.01, 28.97] },
  { city: "Hong Kong", country: "HK", location: [22.3, 114.17] },
  { city: "Mumbai", country: "IN", location: [19.08, 72.88] },
  { city: "Singapore", country: "SG", location: [1.36, 103.99] },
  { city: "Tokyo", country: "JP", location: [35.68, 139.76] },
];

export function AddAccountPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fetchFromApi = useAccountsStore((s) => s.fetchFromApi);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [presetKey, setPresetKey] = useState("KZ|Almaty");
  const [balance, setBalance] = useState(500_000);
  const [minBalance, setMinBalance] = useState(100_000);
  const [type, setType] = useState<AccountType>("operational");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when panel is reopened so a previous submit doesn't bleed in.
  useEffect(() => {
    if (open) {
      setName("");
      setBank("");
      setCurrency("USD");
      setPresetKey("KZ|Almaty");
      setBalance(500_000);
      setMinBalance(100_000);
      setType("operational");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (!name.trim() || !bank.trim()) {
      setError("Name and bank are required.");
      return;
    }
    const preset = CITY_PRESETS.find(
      (p) => `${p.country}|${p.city}` === presetKey,
    );
    if (!preset) {
      setError("Pick a city.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bank: bank.trim(),
          currency,
          country: preset.country,
          city: preset.city,
          location: preset.location,
          balance,
          minBalance,
          type,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      await fetchFromApi();
      toast.success(`Added ${name.trim()} (${preset.city})`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
            aria-label="Add new account"
          >
            <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50">
                  <Plus className="h-4 w-4 text-emerald-600" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[14px] font-medium text-zinc-950">
                    New account
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    Adds a baseline forecast on day 0
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3">
                <Field label="Account name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., USD operations · Astana"
                    className="input"
                    autoFocus
                  />
                </Field>
                <Field label="Bank">
                  <input
                    type="text"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="e.g., Kaspi, Halyk, Forte, JPMorgan"
                    className="input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Currency">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="input"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="City">
                    <select
                      value={presetKey}
                      onChange={(e) => setPresetKey(e.target.value)}
                      className="input"
                    >
                      {CITY_PRESETS.map((p) => (
                        <option
                          key={`${p.country}-${p.city}`}
                          value={`${p.country}|${p.city}`}
                        >
                          {p.city} ({p.country})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Opening balance">
                    <input
                      type="number"
                      value={balance}
                      onChange={(e) => setBalance(Number(e.target.value) || 0)}
                      min={0}
                      step={10_000}
                      className="input"
                    />
                  </Field>
                  <Field label="Min balance">
                    <input
                      type="number"
                      value={minBalance}
                      onChange={(e) =>
                        setMinBalance(Number(e.target.value) || 0)
                      }
                      min={0}
                      step={10_000}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Account type">
                  <div className="grid grid-cols-2 gap-1.5">
                    {ACCOUNT_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                          type === t.id
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        <div className="font-mono text-[10px] uppercase tracking-[0.1em]">
                          {t.label}
                        </div>
                        <div
                          className={`mt-0.5 text-[10px] leading-snug ${
                            type === t.id ? "text-zinc-300" : "text-zinc-500"
                          }`}
                        >
                          {t.hint}
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {error && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              )}

              <p className="mt-4 text-[11px] leading-snug text-zinc-500">
                Sight generates a 90-day baseline history + 14-day forecast
                anchored to today&apos;s balance. The account starts with a
                <span className="font-mono"> BASELINE </span>
                badge until your real activity catches up.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !name.trim() || !bank.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" strokeWidth={2.2} />
                )}
                Create account
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      {children}
    </label>
  );
}
