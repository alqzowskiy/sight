import type { Metadata } from "next";
import dynamic from "next/dynamic";

const LabView = dynamic(
  () => import("@/components/dashboard/lab/lab-view").then((m) => m.LabView),
);

export const metadata: Metadata = {
  title: "Sight · Lab",
};

export default function LabPage() {
  return <LabView />;
}
