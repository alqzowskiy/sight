"use client";

import { Monitor } from "lucide-react";

export function MobileFallback() {
  return (
    <div className="fixed inset-0 z-[100] hidden h-screen w-screen flex-col items-center justify-center bg-white px-6 text-center max-[1023px]:flex">
      <Monitor className="h-10 w-10 text-zinc-300" strokeWidth={1.4} />
      <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        Sight
      </div>
      <h1 className="mt-2 text-[18px] font-medium tracking-tight text-zinc-900">
        Best on desktop
      </h1>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-zinc-500">
        The treasury map needs room to breathe. Open Sight on a screen wider
        than 1024px to see the full dashboard.
      </p>
      <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        Your current viewport is below threshold.
      </div>
    </div>
  );
}
