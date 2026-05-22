import { describe, expect, it } from "vitest";
import { liquidityScore } from "./scoring";
import type { Account } from "@/types";

// We test the offset=0 path which doesn't require forecast data — that's the
// "right now" snapshot the LiquidityScore widget shows in the dashboard header.

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: overrides.id ?? "test",
    name: overrides.name ?? "Test Account",
    bank: overrides.bank ?? "Test Bank",
    location: overrides.location ?? [0, 0],
    currency: overrides.currency ?? "USD",
    balance: overrides.balance ?? 1_000_000,
    minBalance: overrides.minBalance ?? 500_000,
    type: overrides.type ?? "operational",
    status: overrides.status ?? "healthy",
  };
}

describe("liquidityScore", () => {
  it("returns 0 for an empty account list", () => {
    expect(liquidityScore([], 0)).toBe(0);
  });

  it("returns 100 for a healthy account well above its minimum", () => {
    const accounts = [
      makeAccount({ balance: 2_000_000, minBalance: 500_000, status: "healthy" }),
    ];
    // ratio = 4 → clamped to 100. No penalty.
    expect(liquidityScore(accounts, 0)).toBe(100);
  });

  it("penalizes critical accounts heavily", () => {
    const healthy = [
      makeAccount({ id: "h", balance: 1_000_000, minBalance: 500_000, status: "healthy" }),
    ];
    const critical = [
      makeAccount({ id: "c", balance: 100_000, minBalance: 500_000, status: "critical" }),
    ];
    const healthyScore = liquidityScore(healthy, 0);
    const criticalScore = liquidityScore(critical, 0);
    expect(criticalScore).toBeLessThan(healthyScore);
    expect(criticalScore).toBeLessThan(20); // ratio 0.2 → 12, minus 25 → 0 (floored).
  });

  it("averages scores across accounts", () => {
    const accounts = [
      makeAccount({ id: "a", balance: 1_500_000, minBalance: 500_000, status: "healthy" }),
      makeAccount({ id: "b", balance: 100_000, minBalance: 500_000, status: "critical" }),
    ];
    const score = liquidityScore(accounts, 0);
    // Should sit between the two extremes, not equal to either.
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("treats minBalance=0 accounts as perfectly healthy", () => {
    const accounts = [
      makeAccount({ balance: 100, minBalance: 0, status: "healthy" }),
    ];
    expect(liquidityScore(accounts, 0)).toBe(100);
  });

  it("applies an extra negative-balance penalty", () => {
    const positive = [makeAccount({ balance: 0, minBalance: 100_000, status: "critical" })];
    const negative = [makeAccount({ balance: -1, minBalance: 100_000, status: "critical" })];
    expect(liquidityScore(negative, 0)).toBeLessThanOrEqual(liquidityScore(positive, 0));
  });
});
