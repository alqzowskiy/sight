import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/tenant
 *
 * Returns the current authenticated user's tenant info. The dashboard uses
 * this to:
 *   - Replace hardcoded "NovaPay" branding with the user's company name
 *   - Hide demo-only controls (Auto-tour, Crisis, Reset) for non-demo tenants
 *   - Know whether to show Brain/Lab (only meaningful for the demo tenant)
 */
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant) return tenantUnavailable();

  return NextResponse.json({ tenant });
}
