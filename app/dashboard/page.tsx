import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getCurrentTenant } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Sight · Treasury Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/sign-in");
  if (!tenant.onboarded) redirect("/onboarding");

  return <DashboardLayout />;
}
