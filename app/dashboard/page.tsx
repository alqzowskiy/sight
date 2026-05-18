import type { Metadata } from "next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export const metadata: Metadata = {
  title: "Sight · NovaPay Dashboard",
};

export default function DashboardPage() {
  return <DashboardLayout />;
}
