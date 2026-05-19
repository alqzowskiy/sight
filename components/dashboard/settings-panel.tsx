"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Brain,
  FlaskConical,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  X,
  Check,
  Pencil,
} from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { formatCompact } from "@/lib/utils/format";
import type { Account, AccountType, Currency } from "@/types";
import { toast } from "sonner";

const ease = [0.16, 1, 0.3, 1] as const;

type Tab = "accounts" | "lab" | "brain";

interface CityPreset {
  label: string;
  country: string;
  currency: Currency;
  location: [number, number];
  region: string;
}

const CITY_PRESETS: CityPreset[] = [
  // North America
  { label: "New York", country: "US", currency: "USD", location: [40.71, -74.0], region: "North America" },
  { label: "San Francisco", country: "US", currency: "USD", location: [37.77, -122.41], region: "North America" },
  { label: "Chicago", country: "US", currency: "USD", location: [41.88, -87.63], region: "North America" },
  { label: "Boston", country: "US", currency: "USD", location: [42.36, -71.06], region: "North America" },
  { label: "Miami", country: "US", currency: "USD", location: [25.76, -80.19], region: "North America" },
  { label: "Los Angeles", country: "US", currency: "USD", location: [34.05, -118.24], region: "North America" },
  { label: "Toronto", country: "CA", currency: "USD", location: [43.65, -79.38], region: "North America" },
  { label: "Vancouver", country: "CA", currency: "USD", location: [49.28, -123.12], region: "North America" },
  { label: "Mexico City", country: "MX", currency: "USD", location: [19.43, -99.13], region: "North America" },

  // Europe
  { label: "London", country: "GB", currency: "GBP", location: [51.5, -0.12], region: "Europe" },
  { label: "Frankfurt", country: "DE", currency: "EUR", location: [50.11, 8.68], region: "Europe" },
  { label: "Paris", country: "FR", currency: "EUR", location: [48.85, 2.35], region: "Europe" },
  { label: "Amsterdam", country: "NL", currency: "EUR", location: [52.37, 4.89], region: "Europe" },
  { label: "Brussels", country: "BE", currency: "EUR", location: [50.85, 4.35], region: "Europe" },
  { label: "Madrid", country: "ES", currency: "EUR", location: [40.42, -3.7], region: "Europe" },
  { label: "Milan", country: "IT", currency: "EUR", location: [45.46, 9.19], region: "Europe" },
  { label: "Rome", country: "IT", currency: "EUR", location: [41.9, 12.5], region: "Europe" },
  { label: "Vienna", country: "AT", currency: "EUR", location: [48.21, 16.37], region: "Europe" },
  { label: "Dublin", country: "IE", currency: "EUR", location: [53.35, -6.26], region: "Europe" },
  { label: "Luxembourg", country: "LU", currency: "EUR", location: [49.61, 6.13], region: "Europe" },
  { label: "Lisbon", country: "PT", currency: "EUR", location: [38.72, -9.14], region: "Europe" },
  { label: "Stockholm", country: "SE", currency: "EUR", location: [59.33, 18.07], region: "Europe" },
  { label: "Copenhagen", country: "DK", currency: "EUR", location: [55.68, 12.57], region: "Europe" },
  { label: "Helsinki", country: "FI", currency: "EUR", location: [60.17, 24.94], region: "Europe" },
  { label: "Warsaw", country: "PL", currency: "EUR", location: [52.23, 21.01], region: "Europe" },
  { label: "Zurich", country: "CH", currency: "CHF", location: [47.37, 8.54], region: "Europe" },
  { label: "Geneva", country: "CH", currency: "CHF", location: [46.2, 6.15], region: "Europe" },

  // Asia Pacific
  { label: "Singapore", country: "SG", currency: "SGD", location: [1.36, 103.99], region: "Asia Pacific" },
  { label: "Hong Kong", country: "HK", currency: "USD", location: [22.32, 114.17], region: "Asia Pacific" },
  { label: "Tokyo", country: "JP", currency: "USD", location: [35.68, 139.69], region: "Asia Pacific" },
  { label: "Shanghai", country: "CN", currency: "USD", location: [31.23, 121.47], region: "Asia Pacific" },
  { label: "Beijing", country: "CN", currency: "USD", location: [39.9, 116.4], region: "Asia Pacific" },
  { label: "Seoul", country: "KR", currency: "USD", location: [37.57, 126.98], region: "Asia Pacific" },
  { label: "Mumbai", country: "IN", currency: "USD", location: [19.08, 72.88], region: "Asia Pacific" },
  { label: "Bangalore", country: "IN", currency: "USD", location: [12.97, 77.59], region: "Asia Pacific" },
  { label: "Bangkok", country: "TH", currency: "USD", location: [13.76, 100.5], region: "Asia Pacific" },
  { label: "Kuala Lumpur", country: "MY", currency: "USD", location: [3.14, 101.69], region: "Asia Pacific" },
  { label: "Jakarta", country: "ID", currency: "USD", location: [-6.21, 106.85], region: "Asia Pacific" },
  { label: "Manila", country: "PH", currency: "USD", location: [14.6, 120.98], region: "Asia Pacific" },
  { label: "Taipei", country: "TW", currency: "USD", location: [25.03, 121.57], region: "Asia Pacific" },
  { label: "Ho Chi Minh City", country: "VN", currency: "USD", location: [10.78, 106.7], region: "Asia Pacific" },
  { label: "Sydney", country: "AU", currency: "USD", location: [-33.87, 151.21], region: "Asia Pacific" },
  { label: "Melbourne", country: "AU", currency: "USD", location: [-37.81, 144.96], region: "Asia Pacific" },
  { label: "Auckland", country: "NZ", currency: "USD", location: [-36.85, 174.76], region: "Asia Pacific" },

  // Middle East
  { label: "Dubai", country: "AE", currency: "USD", location: [25.2, 55.27], region: "Middle East" },
  { label: "Abu Dhabi", country: "AE", currency: "USD", location: [24.45, 54.38], region: "Middle East" },
  { label: "Riyadh", country: "SA", currency: "USD", location: [24.71, 46.68], region: "Middle East" },
  { label: "Doha", country: "QA", currency: "USD", location: [25.29, 51.53], region: "Middle East" },
  { label: "Tel Aviv", country: "IL", currency: "USD", location: [32.08, 34.78], region: "Middle East" },
  { label: "Istanbul", country: "TR", currency: "EUR", location: [41.01, 28.98], region: "Middle East" },

  // CIS / Central Asia
  { label: "Almaty", country: "KZ", currency: "USD", location: [43.24, 76.94], region: "CIS · Central Asia" },
  { label: "Astana", country: "KZ", currency: "USD", location: [51.17, 71.43], region: "CIS · Central Asia" },
  { label: "Tashkent", country: "UZ", currency: "USD", location: [41.31, 69.24], region: "CIS · Central Asia" },
  { label: "Baku", country: "AZ", currency: "USD", location: [40.41, 49.87], region: "CIS · Central Asia" },
  { label: "Tbilisi", country: "GE", currency: "USD", location: [41.72, 44.78], region: "CIS · Central Asia" },

  // Africa
  { label: "Johannesburg", country: "ZA", currency: "USD", location: [-26.2, 28.04], region: "Africa" },
  { label: "Cape Town", country: "ZA", currency: "USD", location: [-33.92, 18.42], region: "Africa" },
  { label: "Lagos", country: "NG", currency: "USD", location: [6.52, 3.38], region: "Africa" },
  { label: "Cairo", country: "EG", currency: "USD", location: [30.04, 31.24], region: "Africa" },
  { label: "Nairobi", country: "KE", currency: "USD", location: [-1.29, 36.82], region: "Africa" },
  { label: "Casablanca", country: "MA", currency: "EUR", location: [33.57, -7.59], region: "Africa" },

  // Latin America
  { label: "São Paulo", country: "BR", currency: "USD", location: [-23.55, -46.63], region: "Latin America" },
  { label: "Buenos Aires", country: "AR", currency: "USD", location: [-34.6, -58.38], region: "Latin America" },
  { label: "Santiago", country: "CL", currency: "USD", location: [-33.45, -70.66], region: "Latin America" },
  { label: "Bogotá", country: "CO", currency: "USD", location: [4.71, -74.07], region: "Latin America" },
  { label: "Lima", country: "PE", currency: "USD", location: [-12.05, -77.04], region: "Latin America" },
];

const CITIES_BY_REGION: Array<{ region: string; cities: CityPreset[] }> = (() => {
  const order = [
    "North America",
    "Europe",
    "Asia Pacific",
    "Middle East",
    "CIS · Central Asia",
    "Africa",
    "Latin America",
  ];
  return order.map((region) => ({
    region,
    cities: CITY_PRESETS.filter((c) => c.region === region),
  }));
})();

export function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const [tab, setTab] = useState<Tab>("accounts");

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
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col border-l border-zinc-200 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between border-b border-zinc-200/80 px-5 py-4 lg:px-6 lg:py-5">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  <SettingsIcon className="h-3 w-3" strokeWidth={1.6} />
                  Workspace
                </div>
                <h2 className="mt-1 text-[16px] font-medium text-zinc-900">
                  Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close settings"
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" strokeWidth={1.7} />
              </button>
            </header>

            <nav className="flex shrink-0 border-b border-zinc-200/80 px-4 lg:px-6">
              <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")}>
                Accounts
              </TabButton>
              <TabButton active={tab === "lab"} onClick={() => setTab("lab")}>
                Lab
              </TabButton>
              <TabButton active={tab === "brain"} onClick={() => setTab("brain")}>
                Brain
              </TabButton>
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
              {tab === "accounts" && <AccountsTab />}
              {tab === "lab" && (
                <LinkCard
                  href="/dashboard/lab"
                  Icon={FlaskConical}
                  title="Sight Lab"
                  description="ML backtest, MAPE per horizon, P10/P90 coverage, deficit-detection F1, actual-vs-predicted charts."
                  onNavigate={() => setOpen(false)}
                />
              )}
              {tab === "brain" && (
                <LinkCard
                  href="/dashboard/brain"
                  Icon={Brain}
                  title="Sight Brain"
                  description="Visualisation of the 5-model ensemble — which model believes what, how the Ridge stacker combines them."
                  onNavigate={() => setOpen(false)}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
        active ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="settings-tab-underline"
          className="absolute inset-x-3 bottom-0 h-[2px] bg-zinc-900"
        />
      )}
    </button>
  );
}

function LinkCard({
  href,
  Icon,
  title,
  description,
  onNavigate,
}: {
  href: string;
  Icon: typeof Brain;
  title: string;
  description: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group block rounded-xl border border-zinc-200/80 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          Tool
        </div>
      </div>
      <h3 className="mt-3 text-[15px] font-medium text-zinc-900">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
        {description}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900 group-hover:underline">
        Open →
      </div>
    </Link>
  );
}

function AccountsTab() {
  const accounts = useAccountsStore((s) => s.accounts);
  const customIds = useAccountsStore((s) => s.customAccountIds);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const sorted = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Accounts · {accounts.length}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-zinc-700"
        >
          <Plus className="h-3 w-3" strokeWidth={1.8} />
          Add
        </button>
      </div>

      {addOpen && <AddAccountForm onDone={() => setAddOpen(false)} />}

      <div className="flex flex-col gap-2">
        {sorted.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            isCustom={!!customIds[a.id]}
            editing={editingId === a.id}
            onStartEdit={() => setEditingId(a.id)}
            onStopEdit={() => setEditingId(null)}
          />
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
        Editing affects the live dashboard immediately. New accounts get a
        statistical forecast generated in-browser (Holt-Winters with weekly
        seasonality) and feed into alerts and Compass like any other account.
      </p>
    </div>
  );
}

function AccountRow({
  account,
  isCustom,
  editing,
  onStartEdit,
  onStopEdit,
}: {
  account: Account;
  isCustom: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const updateAccountMeta = useAccountsStore((s) => s.updateAccountMeta);
  const removeAccount = useAccountsStore((s) => s.removeAccount);
  const [name, setName] = useState(account.name);
  const [bank, setBank] = useState(account.bank);

  function save() {
    if (!name.trim() || !bank.trim()) return;
    updateAccountMeta(account.id, { name, bank });
    onStopEdit();
    toast.success("Account updated.");
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
        <div className="flex flex-col gap-2">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </Field>
          <Field label="Bank">
            <input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setName(account.name);
              setBank(account.bank);
              onStopEdit();
            }}
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white hover:bg-zinc-700"
          >
            <Check className="h-3 w-3" strokeWidth={1.8} />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-900">
            {account.currency} · {account.name.split("·")[1]?.trim() ?? account.name}
          </span>
          {isCustom && (
            <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-zinc-600">
              Custom
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-zinc-500">
          {account.bank} · {formatCompact(account.balance, account.currency)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onStartEdit}
          aria-label={`Edit ${account.name}`}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={() => {
              removeAccount(account.id);
              toast.success("Account removed.");
            }}
            aria-label={`Remove ${account.name}`}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        )}
      </div>
    </div>
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
      <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "SGD", "CHF"];
const TYPES: AccountType[] = ["operational", "settlement", "reserve"];

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const addAccount = useAccountsStore((s) => s.addAccount);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const defaultCity =
    CITY_PRESETS.find((c) => c.label === "New York") ?? CITY_PRESETS[0];
  const [city, setCity] = useState(defaultCity.label);
  const [currency, setCurrency] = useState<Currency>(defaultCity.currency);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [balance, setBalance] = useState<string>("500000");
  const [minBalance, setMinBalance] = useState<string>("200000");
  const [type, setType] = useState<AccountType>("operational");
  const [submitting, setSubmitting] = useState(false);

  function handleCityChange(label: string) {
    setCity(label);
    const preset = CITY_PRESETS.find((c) => c.label === label);
    if (preset && !currencyTouched) {
      setCurrency(preset.currency);
    }
  }

  function handleCurrencyChange(c: Currency) {
    setCurrency(c);
    setCurrencyTouched(true);
  }

  function submit() {
    if (!name.trim() || !bank.trim()) {
      toast.error("Name and bank are required.");
      return;
    }
    const balanceNum = Number(balance);
    const minBalanceNum = Number(minBalance);
    if (!Number.isFinite(balanceNum) || balanceNum < 0) {
      toast.error("Balance must be a non-negative number.");
      return;
    }
    if (!Number.isFinite(minBalanceNum) || minBalanceNum < 0) {
      toast.error("Min balance must be a non-negative number.");
      return;
    }
    const preset =
      CITY_PRESETS.find((c) => c.label === city) ?? CITY_PRESETS[0];
    // Ensure the account name carries the city after a "·" separator —
    // marker labels and other UI parse the city out of name.
    const rawName = name.trim();
    const composedName = rawName.includes("·")
      ? rawName
      : `${rawName} · ${preset.label}`;
    setSubmitting(true);
    const id = addAccount({
      name: composedName,
      bank: bank.trim(),
      currency,
      country: preset.country,
      location: preset.location,
      balance: balanceNum,
      minBalance: minBalanceNum,
      type,
    });
    toast.success(`Account created — forecast ready.`);
    setSubmitting(false);
    onDone();
    return id;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700">
          New account
        </div>
        <button
          type="button"
          onClick={onDone}
          aria-label="Cancel"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NovaPay USD · Tokyo"
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Bank">
            <input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="MUFG Bank"
              className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
            />
          </Field>
        </div>
        <Field label="City">
          <select
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
          >
            {CITIES_BY_REGION.map(({ region, cities }) => (
              <optgroup key={region} label={region}>
                {cities.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label} · {c.country}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 focus:border-zinc-400 focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Balance">
          <input
            type="number"
            inputMode="numeric"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
        </Field>
        <Field label="Min balance">
          <input
            type="number"
            inputMode="numeric"
            value={minBalance}
            onChange={(e) => setMinBalance(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-zinc-900 focus:border-zinc-400 focus:outline-none"
          />
        </Field>
        <div className="col-span-2">
          <Field label="Type">
            <div className="flex gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                    type === t
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-zinc-200 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 hover:text-zinc-900"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-3 w-3" strokeWidth={1.8} />
          Create
        </button>
      </div>
    </div>
  );
}
