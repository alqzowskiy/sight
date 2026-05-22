import type { Currency } from "@/types";
import type { CounterpartyConfig } from "@/lib/store/crisis-store";

export interface CrisisCtx {
  accountId: string;
  currency: Currency;
  /** Bank name from accountMetas — needed for counterparty-default scoping. */
  bank: string;
  dayOffset: number;
  baseBalance: number;
  /** Parameterized config for the counterparty-default scenario. */
  config: CounterpartyConfig | null;
}

export interface CrisisScenario {
  id: string;
  name: string;
  description: string;
  /** Whether this scenario requires extra config (e.g., counterparty-default needs a bank). */
  requiresConfig?: boolean;
  delta: (ctx: CrisisCtx) => number;
}

function range(from: number, to: number, offset: number): boolean {
  return offset >= from && offset <= to;
}

export const crisisScenarios: CrisisScenario[] = [
  {
    id: "swift-outage",
    name: "SWIFT Outage 48h",
    description:
      "SWIFT clearing freezes for two days. Cross-region settlements pile up.",
    delta: ({ accountId, dayOffset }) => {
      if (!range(1, 3, dayOffset)) return 0;
      if (accountId === "usd-nyc") return -380_000;
      if (accountId === "usd-sf") return -180_000;
      if (accountId === "gbp-london") return -260_000;
      if (accountId === "sgd-singapore") return -340_000;
      if (accountId === "chf-zurich") return -160_000;
      if (accountId === "fx-hedging") return -220_000;
      return 0;
    },
  },
  {
    id: "black-friday",
    name: "Black Friday Surge",
    description:
      "3x card transaction volume for three days. Card settlement accounts drained.",
    delta: ({ accountId, dayOffset }) => {
      if (!range(1, 3, dayOffset)) return 0;
      if (accountId === "visa-eur") return -210_000;
      if (accountId === "mc-usd") return -240_000;
      if (accountId === "usd-nyc") return -320_000;
      if (accountId === "usd-sf") return -280_000;
      if (accountId === "eur-frankfurt") return -240_000;
      if (accountId === "eur-paris") return -190_000;
      if (accountId === "gbp-london") return -150_000;
      return 0;
    },
  },
  {
    id: "bank-holiday",
    name: "EU Bank Holiday",
    description:
      "EU clearing systems pause for three days. EUR inflows pushed back.",
    delta: ({ accountId, dayOffset }) => {
      if (!range(2, 4, dayOffset)) return 0;
      if (accountId === "eur-frankfurt") return -380_000;
      if (accountId === "eur-paris") return -320_000;
      if (accountId === "visa-eur") return -180_000;
      if (accountId === "regulatory-reserve") return -90_000;
      if (accountId === "chf-zurich") return -120_000;
      return 0;
    },
  },
  {
    id: "client-run",
    name: "Mass Withdrawal $10M",
    description:
      "$10M of customer outflows over 48 hours, spread across operational accounts.",
    delta: ({ accountId, dayOffset }) => {
      if (!range(1, 2, dayOffset)) return 0;
      if (accountId === "usd-nyc") return -2_400_000;
      if (accountId === "eur-frankfurt") return -2_000_000;
      if (accountId === "eur-paris") return -1_500_000;
      if (accountId === "gbp-london") return -1_200_000;
      if (accountId === "usd-sf") return -1_300_000;
      if (accountId === "sgd-singapore") return -1_100_000;
      if (accountId === "chf-zurich") return -500_000;
      return 0;
    },
  },
  {
    id: "fx-shock",
    name: "FX Shock -5% EUR",
    description:
      "EUR drops 5% against USD. Every EUR balance reprices downward.",
    delta: ({ currency, dayOffset, baseBalance }) => {
      if (dayOffset <= 0) return 0;
      if (currency !== "EUR") return 0;
      return -baseBalance * 0.05;
    },
  },
  {
    id: "counterparty-default",
    name: "Counterparty Default",
    description:
      "A single bank goes into default. All accounts at that bank lose access until recovery. Echoes the SVB-2023 cascade.",
    requiresConfig: true,
    delta: ({ bank, dayOffset, baseBalance, config }) => {
      // Without config the scenario is inert — UI guides the user to pick a bank.
      if (!config) return 0;
      if (bank !== config.bank) return 0;
      // Freeze the entire forecasted balance for the recovery window.
      // After that, balances ramp back linearly over ~3 days.
      const freezeUntil = config.recoveryDays;
      const fullRecovery = freezeUntil + 3;
      if (dayOffset <= 0) return 0;
      if (dayOffset <= freezeUntil) {
        return -baseBalance;
      }
      if (dayOffset < fullRecovery) {
        const t = (dayOffset - freezeUntil) / 3;
        // Smooth recovery from -baseBalance back to 0.
        return -baseBalance * (1 - t);
      }
      return 0;
    },
  },
];

export function getCrisisScenario(id: string): CrisisScenario | undefined {
  return crisisScenarios.find((s) => s.id === id);
}
