"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Rocket,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  X,
  Plus,
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

// =============================================================================
// Types & static data
// =============================================================================

type Path = "company" | "picking" | "clone" | "configure" | "blank";
type CloneStatus = "idle" | "submitting" | "done" | "error";

type Industry = "PSP" | "EMI" | "FinTech" | "Bank" | "Marketplace" | "Other";
type Region = "CIS" | "EU" | "MENA" | "SEA" | "US";

const INDUSTRIES: { id: Industry; label: string; hint: string }[] = [
  { id: "FinTech", label: "FinTech", hint: "Lending, neobank, embedded finance" },
  { id: "PSP", label: "PSP", hint: "Payment service provider" },
  { id: "EMI", label: "EMI", hint: "E-money institution" },
  { id: "Bank", label: "Bank", hint: "Licensed bank or challenger" },
  { id: "Marketplace", label: "Marketplace", hint: "Multi-merchant platform" },
  { id: "Other", label: "Other", hint: "Treasury team of any shape" },
];

const REGIONS: { id: Region; label: string }[] = [
  { id: "CIS", label: "CIS · Central Asia" },
  { id: "EU", label: "European Union" },
  { id: "MENA", label: "MENA · Gulf" },
  { id: "SEA", label: "Southeast Asia" },
  { id: "US", label: "United States" },
];

type Currency = "USD" | "EUR" | "GBP" | "SGD" | "CHF" | "KZT" | "AED" | "JPY";
type AccountType = "operational" | "settlement" | "reserve" | "fx_hedge";

interface AccountDraft {
  id: string;
  name: string;
  bank: string;
  currency: Currency;
  country: string;
  city: string;
  balance: number;
  minBalance: number;
  type: AccountType;
  location: [number, number];
}

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
  { id: "operational", label: "Operational", hint: "Day-to-day cash, payments in/out" },
  { id: "settlement", label: "Settlement", hint: "Card / scheme settlement (Visa, MC)" },
  { id: "reserve", label: "Reserve", hint: "Regulatory or strategic reserve" },
  { id: "fx_hedge", label: "FX Hedge", hint: "Hedging position against FX exposure" },
];

// Common cities → ISO country + lat/lon. Lets us auto-fill location while still
// letting users override. Sorted alphabetically for the picker.
const CITY_PRESETS: {
  city: string;
  country: string;
  location: [number, number];
}[] = [
  // Kazakhstan + Central Asia
  { city: "Almaty", country: "KZ", location: [43.24, 76.92] },
  { city: "Astana", country: "KZ", location: [51.17, 71.43] },
  { city: "Aktau", country: "KZ", location: [43.65, 51.16] },
  { city: "Atyrau", country: "KZ", location: [47.12, 51.92] },
  { city: "Shymkent", country: "KZ", location: [42.32, 69.59] },
  { city: "Tashkent", country: "UZ", location: [41.31, 69.28] },
  { city: "Bishkek", country: "KG", location: [42.87, 74.59] },
  // CIS
  { city: "Moscow", country: "RU", location: [55.75, 37.62] },
  { city: "Baku", country: "AZ", location: [40.41, 49.86] },
  // Europe
  { city: "Amsterdam", country: "NL", location: [52.37, 4.9] },
  { city: "Berlin", country: "DE", location: [52.52, 13.4] },
  { city: "Frankfurt", country: "DE", location: [50.11, 8.68] },
  { city: "London", country: "GB", location: [51.5, -0.12] },
  { city: "Madrid", country: "ES", location: [40.42, -3.7] },
  { city: "Milan", country: "IT", location: [45.46, 9.19] },
  { city: "Paris", country: "FR", location: [48.85, 2.35] },
  { city: "Prague", country: "CZ", location: [50.08, 14.43] },
  { city: "Stockholm", country: "SE", location: [59.33, 18.06] },
  { city: "Vienna", country: "AT", location: [48.21, 16.37] },
  { city: "Warsaw", country: "PL", location: [52.23, 21.01] },
  { city: "Zurich", country: "CH", location: [47.37, 8.54] },
  // Americas
  { city: "New York", country: "US", location: [40.71, -74.0] },
  { city: "San Francisco", country: "US", location: [37.77, -122.41] },
  { city: "Toronto", country: "CA", location: [43.65, -79.38] },
  // MENA + Asia
  { city: "Dubai", country: "AE", location: [25.2, 55.27] },
  { city: "Riyadh", country: "SA", location: [24.71, 46.68] },
  { city: "Istanbul", country: "TR", location: [41.01, 28.97] },
  { city: "Hong Kong", country: "HK", location: [22.3, 114.17] },
  { city: "Mumbai", country: "IN", location: [19.08, 72.88] },
  { city: "Seoul", country: "KR", location: [37.57, 126.98] },
  { city: "Shanghai", country: "CN", location: [31.23, 121.47] },
  { city: "Singapore", country: "SG", location: [1.36, 103.99] },
  { city: "Sydney", country: "AU", location: [-33.87, 151.21] },
  { city: "Tokyo", country: "JP", location: [35.68, 139.76] },
];

const DEFAULT_DRAFT: Omit<AccountDraft, "id"> = {
  name: "",
  bank: "",
  currency: "USD",
  country: "US",
  city: "New York",
  balance: 1_000_000,
  minBalance: 100_000,
  type: "operational",
  location: [40.71, -74.0],
};

let draftIdCounter = 0;
function newDraftId() {
  draftIdCounter += 1;
  return `draft-${Date.now().toString(36)}-${draftIdCounter}`;
}

// =============================================================================
// Wizard root
// =============================================================================

export function OnboardingWizard({ tenantName }: { tenantName: string }) {
  const router = useRouter();
  const [path, setPath] = useState<Path>("company");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<Industry>("FinTech");
  const [region, setRegion] = useState<Region>("CIS");
  const [savingCompany, setSavingCompany] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submitCompany() {
    const name = companyName.trim();
    if (!name) {
      setError("Company name is required.");
      return;
    }
    setSavingCompany(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "company",
          companyName: name,
          industry,
          region,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      setPath("picking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save company info");
    } finally {
      setSavingCompany(false);
    }
  }

  async function cloneDemo() {
    setPath("clone");
    setCloneStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "clone" }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      setCloneStatus("done");
      setTimeout(() => router.push("/dashboard"), 800);
    } catch (err) {
      setCloneStatus("error");
      setError(err instanceof Error ? err.message : "Onboarding failed");
    }
  }

  async function skipBlank() {
    setPath("blank");
    setError(null);
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "blank" }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      router.push("/dashboard");
    } catch (err) {
      setPath("picking");
      setError(err instanceof Error ? err.message : "Onboarding failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-[920px]">
        <Header tenantName={tenantName} step={path} />

        <AnimatePresence mode="wait">
          {path === "company" && (
            <motion.div
              key="company"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease }}
              className="mt-10"
            >
              <CompanyStep
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                industry={industry}
                onIndustryChange={setIndustry}
                region={region}
                onRegionChange={setRegion}
                onSubmit={submitCompany}
                submitting={savingCompany}
              />
            </motion.div>
          )}
          {path === "picking" && (
            <motion.div
              key="picking"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease }}
              className="mt-10"
            >
              <PathPicker
                onClone={cloneDemo}
                onConfigure={() => setPath("configure")}
                onSkip={skipBlank}
              />
            </motion.div>
          )}

          {path === "configure" && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease }}
              className="mt-10"
            >
              <ConfigureStep
                onBack={() => setPath("picking")}
                onError={(e) => setError(e)}
                onFinish={() => router.push("/dashboard")}
              />
            </motion.div>
          )}

          {path === "clone" && (
            <motion.div
              key="clone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-10"
            >
              {cloneStatus === "submitting" && (
                <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-600" />
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                      Cloning NovaPay portfolio into your tenant…
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      11 accounts · 1,144 forecast points · 579 anomalies · audit log
                    </p>
                  </div>
                </div>
              )}
              {cloneStatus === "done" && (
                <div className="flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/60 p-12">
                  <div className="text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" strokeWidth={1.5} />
                    <p className="mt-4 text-[18px] font-medium text-zinc-950">
                      All set — opening your dashboard.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <FooterDisclaimer />
      </div>
    </div>
  );
}

// =============================================================================
// Header
// =============================================================================

function Header({
  tenantName,
  step,
}: {
  tenantName: string;
  step: Path;
}) {
  const stepNumber = step === "company" ? 1 : step === "configure" ? 3 : 2;

  let title: React.ReactNode;
  let body: React.ReactNode;
  if (step === "company") {
    title = (
      <>
        Welcome to Sight.
        <br />
        <span className="text-zinc-400">Tell us about your company.</span>
      </>
    );
    body =
      "Just a few details — they show up in your dashboard, AI Copilot context, and audit log.";
  } else if (step === "configure") {
    title = (
      <>
        Add your accounts.
        <br />
        <span className="text-zinc-400">Sight is built around them.</span>
      </>
    );
    body =
      "Add one account at a time — name, bank, currency, opening balance, and minimum buffer. Sight starts forecasting immediately.";
  } else {
    title = (
      <>
        Pick your starting point.
        <br />
        <span className="text-zinc-400">Demo data or your own accounts?</span>
      </>
    );
    body = (
      <>
        Workspace:{" "}
        <span className="font-medium text-zinc-900">{tenantName}</span>. Pick
        the fastest path to a working dashboard.
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Onboarding · Step {stepNumber} of 3
      </div>
      <h1 className="mt-2 text-[36px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-950 md:text-[44px]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-zinc-600">
        {body}
      </p>
    </motion.div>
  );
}

function CompanyStep({
  companyName,
  onCompanyNameChange,
  industry,
  onIndustryChange,
  region,
  onRegionChange,
  onSubmit,
  submitting,
}: {
  companyName: string;
  onCompanyNameChange: (v: string) => void;
  industry: Industry;
  onIndustryChange: (v: Industry) => void;
  region: Region;
  onRegionChange: (v: Region) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Company name" full>
          <input
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="e.g., Kazpay, Onor Fintech, BlueRiver Holdings"
            className="input"
            autoFocus
          />
        </Field>
        <Field label="What kind of business?" full>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {INDUSTRIES.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onIndustryChange(i.id)}
                className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                  industry === i.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.1em]">
                  {i.label}
                </div>
                <div
                  className={`mt-0.5 text-[10px] leading-snug ${
                    industry === i.id ? "text-zinc-300" : "text-zinc-500"
                  }`}
                >
                  {i.hint}
                </div>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Home region" full>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRegionChange(r.id)}
                className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                  region === r.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.1em]">
                  {r.label}
                </div>
              </button>
            ))}
          </div>
        </Field>
      </div>
      <div className="mt-8 flex items-center justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !companyName.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          )}
          Continue
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Path picker (step 1)
// =============================================================================

function PathPicker({
  onClone,
  onConfigure,
  onSkip,
}: {
  onClone: () => void;
  onConfigure: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PathCard
          icon={<Rocket className="h-6 w-6 text-purple-600" strokeWidth={1.6} />}
          badge="Recommended"
          accent="purple"
          title="Try with demo data"
          lead="Clone NovaPay — 11 accounts, 90 days of history, 14-day ML forecasts, 579 anomalies."
          bullets={[
            "Instant working dashboard",
            "AI Copilot has full context",
            "Counterparty cascade scenarios ready",
          ]}
          cta="Clone NovaPay demo"
          onClick={onClone}
        />
        <PathCard
          icon={<Building2 className="h-6 w-6 text-zinc-700" strokeWidth={1.6} />}
          accent="zinc"
          title="Set up my own accounts"
          lead="Add your real bank accounts now. Configure currencies, balances, and minimum buffers."
          bullets={[
            "Multi-currency support (USD, EUR, GBP, SGD, CHF)",
            "Auto-located on the globe by city",
            "Sight starts forecasting as soon as you finish",
          ]}
          cta="Configure my accounts"
          onClick={onConfigure}
        />
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      >
        Skip — I&apos;ll add accounts later
      </button>
    </div>
  );
}

interface PathCardProps {
  icon: React.ReactNode;
  badge?: string;
  title: string;
  lead: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
  accent: "purple" | "zinc";
}

function PathCard(props: PathCardProps) {
  const { icon, badge, title, lead, bullets, cta, onClick, accent } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col rounded-2xl border bg-white p-6 text-left transition-all ${
        accent === "purple"
          ? "border-zinc-200 hover:border-purple-300 hover:shadow-[0_8px_24px_-12px_rgba(124,58,237,0.25)]"
          : "border-zinc-200 hover:border-zinc-400"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            accent === "purple" ? "bg-purple-50" : "bg-zinc-100"
          }`}
        >
          {icon}
        </div>
        {badge && (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-purple-700">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-[20px] font-medium tracking-tight text-zinc-950">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{lead}</p>
      <ul className="mt-4 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[12px] leading-snug text-zinc-700">
            <CheckCircle2
              className={`mt-0.5 h-3 w-3 shrink-0 ${
                accent === "purple" ? "text-purple-500" : "text-zinc-400"
              }`}
              strokeWidth={2}
            />
            {b}
          </li>
        ))}
      </ul>
      <div className="flex-1" aria-hidden />
      <div
        className={`mt-6 inline-flex items-center gap-2 self-start rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
          accent === "purple"
            ? "bg-purple-600 text-white group-hover:bg-purple-700"
            : "border border-zinc-300 bg-white text-zinc-900 group-hover:border-zinc-900"
        }`}
      >
        <ArrowRight className="h-3 w-3" strokeWidth={2} />
        {cta}
      </div>
    </button>
  );
}

// =============================================================================
// Configure step (step 2)
// =============================================================================

function ConfigureStep({
  onBack,
  onError,
  onFinish,
}: {
  onBack: () => void;
  onError: (msg: string) => void;
  onFinish: () => void;
}) {
  const [drafts, setDrafts] = useState<AccountDraft[]>([
    { ...DEFAULT_DRAFT, id: newDraftId() },
  ]);
  const [submitting, setSubmitting] = useState(false);

  function updateDraft(id: string, patch: Partial<AccountDraft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function removeDraft(id: string) {
    setDrafts((ds) => (ds.length === 1 ? ds : ds.filter((d) => d.id !== id)));
  }
  function addDraft() {
    setDrafts((ds) => [...ds, { ...DEFAULT_DRAFT, id: newDraftId() }]);
  }

  async function finish() {
    if (drafts.some((d) => !d.name.trim() || !d.bank.trim())) {
      onError("Every account needs a name and bank.");
      return;
    }
    setSubmitting(true);
    try {
      // Create each account sequentially. Could parallelize but sequential
      // gives clearer error reporting and ordered audit events.
      for (const d of drafts) {
        const res = await fetch("/api/v1/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: d.name.trim(),
            bank: d.bank.trim(),
            currency: d.currency,
            country: d.country,
            city: d.city,
            location: d.location,
            balance: d.balance,
            minBalance: d.minBalance,
            type: d.type,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Account "${d.name}": ${txt || res.statusText}`);
        }
      }
      // Mark tenant onboarded.
      const r = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "blank" }),
      });
      if (!r.ok) throw new Error("Failed to finalize onboarding");
      onFinish();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Setup failed");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {drafts.map((d, i) => (
          <DraftCard
            key={d.id}
            index={i}
            draft={d}
            canRemove={drafts.length > 1}
            onChange={(patch) => updateDraft(d.id, patch)}
            onRemove={() => removeDraft(d.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addDraft}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700 transition-colors hover:border-zinc-900 hover:bg-white"
      >
        <Plus className="h-3 w-3" strokeWidth={2} />
        Add another account
      </button>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} />
          Back
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300"
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          )}
          Finish · {drafts.length} {drafts.length === 1 ? "account" : "accounts"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Draft card (one account form)
// =============================================================================

function DraftCard({
  index,
  draft,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  draft: AccountDraft;
  canRemove: boolean;
  onChange: (patch: Partial<AccountDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
            {index + 1}
          </span>
          {draft.name.trim() || "Untitled account"}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Remove account"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Account name">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g., USD Operating · NYC"
            className="input"
          />
        </Field>
        <Field label="Bank">
          <input
            type="text"
            value={draft.bank}
            onChange={(e) => onChange({ bank: e.target.value })}
            placeholder="e.g., JPMorgan, Halyk, Kaspi"
            className="input"
          />
        </Field>

        <Field label="Currency">
          <select
            value={draft.currency}
            onChange={(e) => onChange({ currency: e.target.value as Currency })}
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
            value={`${draft.country}|${draft.city}`}
            onChange={(e) => {
              const preset = CITY_PRESETS.find(
                (p) => `${p.country}|${p.city}` === e.target.value,
              );
              if (preset) {
                onChange({
                  country: preset.country,
                  city: preset.city,
                  location: preset.location,
                });
              }
            }}
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

        <Field label={`Opening balance (${draft.currency})`}>
          <input
            type="number"
            value={draft.balance}
            min={0}
            step={10_000}
            onChange={(e) => onChange({ balance: Number(e.target.value) || 0 })}
            className="input tabular-nums"
          />
        </Field>
        <Field label={`Minimum balance (${draft.currency})`}>
          <input
            type="number"
            value={draft.minBalance}
            min={0}
            step={10_000}
            onChange={(e) =>
              onChange({ minBalance: Number(e.target.value) || 0 })
            }
            className="input tabular-nums"
          />
        </Field>

        <Field label="Account type" full>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ type: t.id })}
                className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                  draft.type === t.id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.1em]">
                  {t.label}
                </div>
                <div
                  className={`mt-0.5 text-[10px] leading-snug ${
                    draft.type === t.id ? "text-zinc-300" : "text-zinc-500"
                  }`}
                >
                  {t.hint}
                </div>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(228 228 231);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 13px;
          color: rgb(24 24 27);
          transition: border-color 0.15s;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(24 24 27);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

// =============================================================================
// Footer
// =============================================================================

function FooterDisclaimer() {
  return (
    <div className="mt-10 flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.8} />
      <p className="text-[12px] leading-relaxed text-zinc-600">
        <span className="font-medium text-zinc-900">Co-pilot, not Autopilot.</span> Whatever you pick,
        every transfer in Sight always requires your explicit Execute click. We never move money
        on our own.
      </p>
    </div>
  );
}
