import { describe, expect, it } from "vitest";
import { convertAmount, fxFeeUsd, isCrossCurrency, FX_SPREAD } from "./fx";

describe("convertAmount", () => {
  it("returns the same value when source and target currency match", () => {
    expect(convertAmount(1000, "USD", "USD")).toBe(1000);
    expect(convertAmount(0, "EUR", "EUR")).toBe(0);
  });

  it("converts EUR to USD using the demo rate (1.08)", () => {
    expect(convertAmount(1_000_000, "EUR", "USD")).toBeCloseTo(1_080_000, 0);
  });

  it("conversion is round-trip stable within FP precision", () => {
    const original = 500_000;
    const usd = convertAmount(original, "GBP", "USD");
    const back = convertAmount(usd, "USD", "GBP");
    expect(back).toBeCloseTo(original, 4);
  });

  it("supports all 5 currency pairs from the rate table", () => {
    // Every conversion should produce a positive finite number.
    const currencies = ["USD", "EUR", "GBP", "CHF", "SGD"] as const;
    for (const from of currencies) {
      for (const to of currencies) {
        const result = convertAmount(1000, from, to);
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
      }
    }
  });
});

describe("fxFeeUsd", () => {
  it("returns 0 when no FX conversion happens", () => {
    expect(fxFeeUsd(100_000, "USD", "USD")).toBe(0);
  });

  it("charges FX_SPREAD over the USD-equivalent amount", () => {
    // 100k EUR at rate 1.08 = 108k USD. Spread = 108k * 0.004 = 432.
    const fee = fxFeeUsd(100_000, "EUR", "USD");
    expect(fee).toBeCloseTo(432, 1);
  });

  it("FX_SPREAD is set to 40 bps (industry middle-of-road)", () => {
    expect(FX_SPREAD).toBe(0.004);
  });
});

describe("isCrossCurrency", () => {
  it("returns false for same currency", () => {
    expect(isCrossCurrency("USD", "USD")).toBe(false);
  });

  it("returns true for different currencies", () => {
    expect(isCrossCurrency("USD", "EUR")).toBe(true);
    expect(isCrossCurrency("CHF", "SGD")).toBe(true);
  });
});
