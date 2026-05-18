import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sight · Crisis",
};

export default function CrisisPage() {
  return (
    <div className="grid h-full place-items-center bg-[#FAFAFA] p-12">
      <div className="max-w-xl text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          Crisis
        </div>
        <h1 className="mt-2 text-[24px] font-medium tracking-tight text-zinc-900">
          Crisis Mode
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
          Open Crisis Mode from the dashboard header to stress-test treasury
          shocks. This page is reserved for a dedicated scenario library.
        </p>
      </div>
    </div>
  );
}
