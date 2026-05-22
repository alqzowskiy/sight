import { describe, expect, it } from "vitest";
import {
  computeHHI,
  getBankRating,
  levelLabel,
  levelColor,
  levelBg,
  type AccountWithCountry,
} from "./concentration";

function makeAccount(
  overrides: Partial<AccountWithCountry>,
): AccountWithCountry {
  return {
    id: overrides.id ?? "test-acct",
    name: overrides.name ?? "Test Account",
    bank: overrides.bank ?? "Test Bank",
    location: overrides.location ?? [0, 0],
    currency: overrides.currency ?? "USD",
    balance: overrides.balance ?? 1_000_000,
    minBalance: overrides.minBalance ?? 100_000,
    type: overrides.type ?? "operational",
    status: overrides.status ?? "healthy",
    country: overrides.country ?? "US",
  };
}

describe("computeHHI", () => {
  it("returns level=low and hhi=0 when no positive balances exist", () => {
    const accounts = [
      makeAccount({ id: "a", balance: 0 }),
      makeAccount({ id: "b", balance: -100 }),
    ];
    const result = computeHHI(accounts, "bank");
    expect(result.hhi).toBe(0);
    expect(result.level).toBe("low");
    expect(result.totalUsd).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("returns hhi=10000 when a single bucket holds 100% of capital", () => {
    const accounts = [
      makeAccount({ id: "a", bank: "JPMorgan", balance: 1_000_000 }),
      makeAccount({ id: "b", bank: "JPMorgan", balance: 500_000 }),
    ];
    const result = computeHHI(accounts, "bank");
    expect(result.hhi).toBe(10000);
    expect(result.level).toBe("high");
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].key).toBe("JPMorgan");
    expect(result.breakdown[0].share).toBeCloseTo(1, 5);
    expect(result.breakdown[0].accounts).toBe(2);
  });

  it("classifies as 'low' for highly diversified portfolios", () => {
    // 10 banks, each with 10% of capital → HHI = 10 * 100 = 1000.
    const accounts = Array.from({ length: 10 }, (_, i) =>
      makeAccount({
        id: `a${i}`,
        bank: `Bank-${i}`,
        balance: 1_000_000,
      }),
    );
    const result = computeHHI(accounts, "bank");
    expect(result.hhi).toBe(1000);
    expect(result.level).toBe("low");
    expect(result.breakdown).toHaveLength(10);
  });

  it("classifies as 'high' when the largest bucket dominates", () => {
    // 60% / 25% / 10% / 5% — SVB-style concentration.
    // HHI = 60² + 25² + 10² + 5² = 3600 + 625 + 100 + 25 = 4350.
    const accounts = [
      makeAccount({ id: "a", bank: "JPMorgan", balance: 6_000_000 }),
      makeAccount({ id: "b", bank: "Deutsche", balance: 2_500_000 }),
      makeAccount({ id: "c", bank: "HSBC", balance: 1_000_000 }),
      makeAccount({ id: "d", bank: "UBS", balance: 500_000 }),
    ];
    const result = computeHHI(accounts, "bank");
    expect(result.hhi).toBe(4350);
    expect(result.level).toBe("high");
    expect(result.breakdown[0].key).toBe("JPMorgan");
    expect(result.breakdown[0].share).toBeCloseTo(0.6, 5);
  });

  it("normalizes cross-currency balances to USD before computing shares", () => {
    // EUR 1.0M @ rate 1.08 = USD 1.08M.
    // USD 1.08M elsewhere → 50/50 split, HHI = 50² + 50² = 5000.
    const accounts = [
      makeAccount({
        id: "eur",
        bank: "Deutsche",
        currency: "EUR",
        balance: 1_000_000,
      }),
      makeAccount({
        id: "usd",
        bank: "JPMorgan",
        currency: "USD",
        balance: 1_080_000,
      }),
    ];
    const result = computeHHI(accounts, "bank");
    expect(result.hhi).toBe(5000);
    expect(result.level).toBe("high");
    expect(result.breakdown[0].share).toBeCloseTo(0.5, 5);
    expect(result.breakdown[1].share).toBeCloseTo(0.5, 5);
  });

  it("groups by the requested dimension", () => {
    const accounts = [
      makeAccount({ id: "a", bank: "JPMorgan", country: "US", currency: "USD", balance: 1_000_000 }),
      makeAccount({ id: "b", bank: "BNY Mellon", country: "US", currency: "USD", balance: 1_000_000 }),
      makeAccount({ id: "c", bank: "Deutsche", country: "DE", currency: "EUR", balance: 1_000_000 }),
    ];
    const byBank = computeHHI(accounts, "bank");
    const byCountry = computeHHI(accounts, "country");
    const byCurrency = computeHHI(accounts, "currency");

    expect(byBank.breakdown).toHaveLength(3);
    // Country: US (USD 1M + USD 1M = $2M) vs DE (EUR 1M ≈ $1.08M) → 2/3.08 ≈ 65%, 35%.
    expect(byCountry.breakdown).toHaveLength(2);
    expect(byCountry.breakdown[0].key).toBe("US");
    // Currency: USD = $2M, EUR ≈ $1.08M.
    expect(byCurrency.breakdown).toHaveLength(2);
    expect(byCurrency.breakdown[0].key).toBe("USD");
  });

  it("sorts breakdown by share descending", () => {
    const accounts = [
      makeAccount({ id: "a", bank: "Small", balance: 100_000 }),
      makeAccount({ id: "b", bank: "Big", balance: 5_000_000 }),
      makeAccount({ id: "c", bank: "Medium", balance: 1_000_000 }),
    ];
    const result = computeHHI(accounts, "bank");
    expect(result.breakdown.map((b) => b.key)).toEqual([
      "Big",
      "Medium",
      "Small",
    ]);
  });
});

describe("risk-adjusted HHI", () => {
  it("equals raw HHI when dimension is currency or country", () => {
    const accounts = [
      makeAccount({ id: "a", bank: "JPMorgan", currency: "USD", balance: 1_000_000 }),
      makeAccount({ id: "b", bank: "Deutsche Bank", currency: "EUR", balance: 1_000_000 }),
    ];
    const byCurrency = computeHHI(accounts, "currency");
    const byCountry = computeHHI(accounts, "country");
    expect(byCurrency.hhiRiskAdjusted).toBe(byCurrency.hhi);
    expect(byCountry.hhiRiskAdjusted).toBe(byCountry.hhi);
  });

  it("amplifies HHI when concentration is in a riskier counterparty", () => {
    // 80% in Halyk (BB+, multiplier 1.35), 20% in JPMorgan (A+, multiplier 1.0).
    const halykHeavy = [
      makeAccount({ id: "a", bank: "Halyk", currency: "USD", balance: 8_000_000 }),
      makeAccount({ id: "b", bank: "JPMorgan", currency: "USD", balance: 2_000_000 }),
    ];
    // 80% in JPMorgan, 20% in Halyk — same raw HHI, lower risk-adjusted.
    const jpmHeavy = [
      makeAccount({ id: "a", bank: "JPMorgan", currency: "USD", balance: 8_000_000 }),
      makeAccount({ id: "b", bank: "Halyk", currency: "USD", balance: 2_000_000 }),
    ];
    const a = computeHHI(halykHeavy, "bank");
    const b = computeHHI(jpmHeavy, "bank");
    expect(a.hhi).toBe(b.hhi); // both 80²+20² = 6800
    expect(a.hhiRiskAdjusted).toBeGreaterThan(b.hhiRiskAdjusted);
  });

  it("returns NR multiplier for unknown banks", () => {
    expect(getBankRating("UnknownBank").rating).toBe("NR");
    expect(getBankRating("UnknownBank").multiplier).toBeGreaterThan(1);
  });

  it("returns the correct credit rating for major banks", () => {
    expect(getBankRating("JPMorgan").rating).toBe("A+");
    expect(getBankRating("Deutsche Bank").rating).toBe("A");
    expect(getBankRating("Halyk").rating).toBe("BB+");
  });
});

describe("level helpers", () => {
  it("levelLabel returns Diversified/Moderate/Concentrated", () => {
    expect(levelLabel("low")).toBe("Diversified");
    expect(levelLabel("moderate")).toBe("Moderate");
    expect(levelLabel("high")).toBe("Concentrated");
  });

  it("levelColor and levelBg map to coherent Tailwind classes", () => {
    expect(levelColor("low")).toContain("emerald");
    expect(levelColor("moderate")).toContain("amber");
    expect(levelColor("high")).toContain("red");
    expect(levelBg("low")).toContain("emerald");
    expect(levelBg("moderate")).toContain("amber");
    expect(levelBg("high")).toContain("red");
  });
});
