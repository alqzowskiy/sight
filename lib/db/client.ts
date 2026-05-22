import { PrismaClient } from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";

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

/** The public read-only demo tenant slug. Accessible via /demo/* without auth. */
export const DEMO_TENANT_SLUG = "novapay";

/**
 * Resolve the tenant id for the current request, lazily creating one for
 * first-time Clerk-authenticated users.
 *
 * Flow:
 *   1. Read Clerk userId from session via auth()
 *   2. If no session → return null (caller should 401/redirect to sign-in)
 *   3. If session has a linked TenantUser → return that tenant.id
 *   4. Otherwise → create Tenant + TenantUser in one transaction and return
 *
 * Tenants created here start with `onboarded=false`. The /dashboard route
 * redirects to /onboarding until the user picks clone-demo or start-blank.
 */
export async function resolveTenantId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Fast path: existing user.
  const existing = await db.tenantUser.findUnique({
    where: { externalId: userId },
    select: { tenantId: true },
  });
  if (existing) return existing.tenantId;

  // First sign-in: lazy-create tenant + tenant user.
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? `${userId}@sight.local`;
  const displayName =
    user?.firstName || user?.lastName
      ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
      : email.split("@")[0];

  // Slug: short, URL-safe, unique. Append a random suffix on conflict.
  const baseSlug = sanitizeSlug(displayName) || `t-${userId.slice(-8)}`;
  const slug = await uniqueSlug(baseSlug);

  const tenant = await db.tenant.create({
    data: {
      slug,
      name: `${displayName}'s Treasury`,
      region: "CIS",
      isDemo: false,
      onboarded: false,
      users: {
        create: {
          externalId: userId,
          email,
          role: "CFO",
        },
      },
    },
  });

  return tenant.id;
}

/**
 * Resolve the demo tenant id (public, no auth). Used by /demo/* routes
 * and by the onboarding clone flow.
 */
export async function resolveDemoTenantId(): Promise<string | null> {
  const tenant = await db.tenant.findUnique({
    where: { slug: DEMO_TENANT_SLUG },
    select: { id: true },
  });
  return tenant?.id ?? null;
}

/** Look up the active tenant for the current Clerk session. Includes onboarded flag. */
export async function getCurrentTenant() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return null;
  return db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, name: true, isDemo: true, onboarded: true },
  });
}

function sanitizeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await db.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
