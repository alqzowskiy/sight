import type { Currency } from "@/types";

export interface CrisisCtx {
  accountId: string;
  currency: Currency;
  dayOffset: number;
  baseBalance: number;
}

export interface CrisisScenario {
  id: string;
  name: string;
  description: string;
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
];

export function getCrisisScenario(id: string): CrisisScenario | undefined {
  return crisisScenarios.find((s) => s.id === id);
}
