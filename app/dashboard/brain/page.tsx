import type { Metadata } from "next";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { getCurrentTenant } from "@/lib/db/client";
import { MlNotAvailable } from "@/components/dashboard/ml-not-available";

const BrainView = nextDynamic(
  () => import("@/components/dashboard/brain/brain-view").then((m) => m.BrainView),
);

export const metadata: Metadata = {
  title: "Sight · Brain",
};

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/sign-in");
  if (!tenant.onboarded) redirect("/onboarding");

  // Brain renders per-account ML weights and SHAP from the ensemble. These
  // are only meaningful for the NovaPay demo tenant (the one with trained
  // models). Show a friendly empty state for everyone else.
  if (!tenant.isDemo) {
    return <MlNotAvailable pageName="Brain" />;
  }

  return <BrainView />;
}
