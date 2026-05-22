import { describe, expect, it } from "vitest";
import { pickChannelAndFee } from "./channels";

describe("pickChannelAndFee", () => {
  it("EUR ↔ EUR (operational) → SEPA at €0.50 flat", () => {
    const choice = pickChannelAndFee(
      100_000,
      { currency: "EUR", type: "operational" },
      { currency: "EUR", type: "operational" },
    );
    expect(choice.channel).toBe("SEPA");
    expect(choice.fee).toBe(0.5);
    expect(choice.fxApplied).toBe(false);
  });

  it("USD ↔ USD (operational) → SWIFT at $25 flat", () => {
    const choice = pickChannelAndFee(
      100_000,
      { currency: "USD", type: "operational" },
      { currency: "USD", type: "operational" },
    );
    expect(choice.channel).toBe("SWIFT");
    expect(choice.fee).toBe(25);
    expect(choice.fxApplied).toBe(false);
  });

  it("EUR settlement → EUR settlement → VISA at 8 bps", () => {
    const choice = pickChannelAndFee(
      1_000_000,
      { currency: "EUR", type: "settlement" },
      { currency: "EUR", type: "settlement" },
    );
    expect(choice.channel).toBe("VISA");
    expect(choice.fee).toBeCloseTo(800, 5); // 1M * 0.0008
    expect(choice.fxApplied).toBe(false);
  });

  it("USD settlement → USD settlement → MASTERCARD at 8 bps", () => {
    const choice = pickChannelAndFee(
      500_000,
      { currency: "USD", type: "settlement" },
      { currency: "USD", type: "settlement" },
    );
    expect(choice.channel).toBe("MASTERCARD");
    expect(choice.fee).toBeCloseTo(400, 5);
    expect(choice.fxApplied).toBe(false);
  });

  it("cross-currency (EUR → USD) → SWIFT with FX spread", () => {
    const choice = pickChannelAndFee(
      100_000,
      { currency: "EUR", type: "operational" },
      { currency: "USD", type: "operational" },
    );
    expect(choice.channel).toBe("SWIFT");
    expect(choice.fxApplied).toBe(true);
    // FX fee = amount * rate * spread = 100_000 * 1.08 * 0.004 = 432.
    // Total fee = 25 + 432 = 457.
    expect(choice.fee).toBeGreaterThan(25);
    expect(choice.fee).toBeCloseTo(457, 0);
  });
});
