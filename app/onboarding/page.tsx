import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/db/client";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const tenant = await getCurrentTenant();

  // Not signed in (middleware should have caught this, defensive guard).
  if (!tenant) redirect("/sign-in");

  // Already onboarded — straight to dashboard.
  if (tenant.onboarded) redirect("/dashboard");

  return <OnboardingWizard tenantName={tenant.name} />;
}
