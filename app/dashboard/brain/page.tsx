import type { Metadata } from "next";
import dynamic from "next/dynamic";

const BrainView = dynamic(
  () => import("@/components/dashboard/brain/brain-view").then((m) => m.BrainView),
);

export const metadata: Metadata = {
  title: "Sight · Brain",
};

export default function BrainPage() {
  return <BrainView />;
}
