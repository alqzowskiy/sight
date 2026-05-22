/**
 * Seed the database from public/data/*.json — the artifacts the Python ML
 * pipeline produces. Idempotent: re-running upserts everything.
 *
 *   pnpm db:seed
 *
 * Source of truth:
 *   - public/data/accounts.json  — 11 accounts metadata (manual)
 *   - public/data/forecasts.json — 104 forecast points per account (ML output)
 *
 * After Phase 2 we'll add transaction seeding too. For Phase 1 (foundation),
 * we only need the accounts and forecast snapshot.
 */

import { PrismaClient } from "@prisma/client";
import accountsJson from "../public/data/accounts.json";
import forecastsJson from "../public/data/forecasts.json";

const db = new PrismaClient();

interface SeedAccount {
  id: string;
  name: string;
  bank: string;
  currency: string;
  country: string;
  location: [number, number];
  minBalance: number;
  type: string;
}

interface ForecastPointRaw {
  date: string;
  balance: number;
  p10: number;
  p90: number;
  isHistorical: boolean;
  shap?: unknown[];
}

interface ForecastsPayload {
  model_version: string;
  model_per_account: Record<string, string>;
  accounts: Record<string, ForecastPointRaw[]>;
}

const TENANT_SLUG = "novapay";
const TENANT_NAME = "NovaPay";
const TENANT_REGION = "CIS";

async function main() {
  const accounts = accountsJson as SeedAccount[];
  const forecasts = forecastsJson as ForecastsPayload;

  console.log(`Seeding tenant "${TENANT_SLUG}"...`);
  const tenant = await db.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: { name: TENANT_NAME, region: TENANT_REGION },
    create: {
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      region: TENANT_REGION,
    },
  });
  console.log(`  tenant id: ${tenant.id}`);

  console.log(`Seeding ${accounts.length} accounts...`);
  for (const a of accounts) {
    await db.account.upsert({
      where: { id: a.id },
      update: {
        tenantId: tenant.id,
        name: a.name,
        bank: a.bank,
        currency: a.currency,
        country: a.country,
        latitude: a.location[0],
        longitude: a.location[1],
        minBalance: a.minBalance,
        type: a.type,
        externalId: a.id,
      },
      create: {
        id: a.id,
        tenantId: tenant.id,
        externalId: a.id,
        name: a.name,
        bank: a.bank,
        currency: a.currency,
        country: a.country,
        latitude: a.location[0],
        longitude: a.location[1],
        minBalance: a.minBalance,
        type: a.type,
      },
    });
  }
  console.log(`  ${accounts.length} accounts upserted`);

  let totalForecasts = 0;
  console.log("Seeding forecasts...");
  // Clear existing forecasts for this tenant so we don't accumulate stale rows
  // when the ML pipeline regenerates from a new "today" anchor.
  await db.forecast.deleteMany({ where: { tenantId: tenant.id } });

  for (const [accountId, points] of Object.entries(forecasts.accounts)) {
    const modelChoice = forecasts.model_per_account?.[accountId] ?? "stacker";
    const rows = points.map((p) => ({
      tenantId: tenant.id,
      accountId,
      date: new Date(p.date + "T00:00:00.000Z"),
      balance: p.balance,
      p10: p.p10,
      p90: p.p90,
      isHistorical: p.isHistorical,
      modelVersion: forecasts.model_version,
      modelChoice,
      shapJson: p.shap ? JSON.stringify(p.shap) : null,
    }));
    if (rows.length > 0) {
      await db.forecast.createMany({ data: rows });
      totalForecasts += rows.length;
    }
  }
  console.log(`  ${totalForecasts} forecast points inserted`);

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      eventType: "DATABASE_SEEDED",
      entityId: tenant.id,
      payload: JSON.stringify({
        accounts: accounts.length,
        forecasts: totalForecasts,
        modelVersion: forecasts.model_version,
      }),
    },
  });

  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
