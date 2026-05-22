import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";
import type { Currency } from "@/types";

export const dynamic = "force-dynamic";

const ALERT_THRESHOLD_MULTIPLIER = 1.2;
const RECOMMENDED_BUFFER_MULTIPLIER = 1.5;
const HORIZON_DAYS = 7;

type Severity = "info" | "warning" | "critical";

interface AccountWithLatest {
  id: string;
  currency: string;
  bank: string;
  minBalance: number;
  todayBalance: number;
  futurePoints: Array<{
    date: Date;
    balance: number;
    p10: number;
    p90: number;
    dayOffset: number;
  }>;
}

function severityFor(deficitRatio: number): Severity {
  if (deficitRatio >= 0.5) return "critical";
  if (deficitRatio >= 0.2) return "warning";
  return "info";
}

export async function GET() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
  });

  const allForecasts = await db.forecast.findMany({
    where: { tenantId },
    orderBy: { date: "asc" },
  });

  // Find today's date per account (latest historical point).
  const todayByAccount = new Map<string, Date>();
  for (const f of allForecasts) {
    if (f.isHistorical) {
      const prev = todayByAccount.get(f.accountId);
      if (!prev || f.date > prev) todayByAccount.set(f.accountId, f.date);
    }
  }

  // Build per-account view of upcoming 7 days.
  const enriched: AccountWithLatest[] = accounts.map((a) => {
    const today = todayByAccount.get(a.id) ?? new Date(0);
    const todayPoint = allForecasts
      .filter((f) => f.accountId === a.id && f.date.getTime() === today.getTime())[0];
    const futurePoints = allForecasts
      .filter((f) => f.accountId === a.id && f.date > today)
      .slice(0, HORIZON_DAYS)
      .map((f, i) => ({
        date: f.date,
        balance: f.balance,
        p10: f.p10,
        p90: f.p90,
        dayOffset: i + 1,
      }));
    return {
      id: a.id,
      currency: a.currency,
      bank: a.bank,
      minBalance: a.minBalance,
      todayBalance: todayPoint?.balance ?? 0,
      futurePoints,
    };
  });

  // For each account, find the first day where balance < 1.2 × min.
  const alerts = enriched
    .map((acc) => {
      if (acc.minBalance === 0) return null;
      const threshold = acc.minBalance * ALERT_THRESHOLD_MULTIPLIER;
      const breachPoint = acc.futurePoints.find((p) => p.balance < threshold);
      if (!breachPoint) return null;

      const deficit = acc.minBalance - breachPoint.p10;
      const deficitRatio = Math.max(0, deficit) / acc.minBalance;
      const severity = severityFor(deficitRatio);

      // Find a donor — same currency first, otherwise the largest USD account.
      const sameCurrencyDonors = enriched
        .filter(
          (d) =>
            d.id !== acc.id &&
            d.currency === acc.currency &&
            d.todayBalance > d.minBalance * RECOMMENDED_BUFFER_MULTIPLIER,
        )
        .sort((a, b) => b.todayBalance - a.todayBalance);

      const donor =
        sameCurrencyDonors[0] ??
        enriched
          .filter(
            (d) =>
              d.id !== acc.id &&
              d.currency === "USD" &&
              d.todayBalance > d.minBalance * RECOMMENDED_BUFFER_MULTIPLIER,
          )
          .sort((a, b) => b.todayBalance - a.todayBalance)[0];

      const recommendedAmount = Math.max(
        0,
        acc.minBalance * RECOMMENDED_BUFFER_MULTIPLIER - breachPoint.p10,
      );

      const intervalWidth = breachPoint.p90 - breachPoint.p10;
      const confidence = Math.max(
        0.3,
        Math.min(0.99, 1 - intervalWidth / Math.max(1, breachPoint.balance) / 2),
      );

      return {
        id: `${acc.id}-d${breachPoint.dayOffset}`,
        accountId: acc.id,
        severity,
        predictedDate: breachPoint.date.toISOString().slice(0, 10),
        predictedDeficit: Math.max(0, deficit),
        confidence,
        recommendedDonorId: donor?.id,
        recommendedAmount: donor ? recommendedAmount : undefined,
        recommendedChannel: donor
          ? donor.currency === (acc.currency as Currency)
            ? donor.currency === "EUR"
              ? ("SEPA" as const)
              : ("SWIFT" as const)
            : ("SWIFT" as const)
          : undefined,
        reason: `Forecasted balance ${(breachPoint.balance / 1000).toFixed(0)}K dips below ${(threshold / 1000).toFixed(0)}K on +${breachPoint.dayOffset}d`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ alerts });
}
