import type { Metadata } from "next";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { getCurrentTenant } from "@/lib/db/client";
import { MlNotAvailable } from "@/components/dashboard/ml-not-available";

const LabView = nextDynamic(
  () => import("@/components/dashboard/lab/lab-view").then((m) => m.LabView),
);

export const metadata: Metadata = {
  title: "Sight · Lab",
};

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/sign-in");
  if (!tenant.onboarded) redirect("/onboarding");
  if (!tenant.isDemo) return <MlNotAvailable pageName="Lab" />;

  return <LabView />;
}
