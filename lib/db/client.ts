import { PrismaClient } from "@prisma/client";

// In dev, Next.js hot-reloads the API routes and would create a new PrismaClient
// on every reload — eventually exhausting DB connections. Stash a single instance
// on globalThis so the same client is reused across reloads.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * The single demo tenant slug. v1 is single-tenant — extractTenant() always
 * resolves to this. Multi-tenant is Y2 roadmap.
 */
export const DEMO_TENANT_SLUG = "novapay";

/**
 * Resolve the tenant id for the current request. In v1 this is a constant
 * (single-tenant demo). In v2 it will parse a session cookie or JWT.
 *
 * Returns null if the tenant hasn't been seeded yet — callers should respond
 * 503 in that case.
 */
export async function resolveTenantId(): Promise<string | null> {
  const tenant = await db.tenant.findUnique({
    where: { slug: DEMO_TENANT_SLUG },
    select: { id: true },
  });
  return tenant?.id ?? null;
}
