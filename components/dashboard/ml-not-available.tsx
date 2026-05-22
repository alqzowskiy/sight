import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

/**
 * Empty state for `/dashboard/brain` and `/dashboard/lab` when the current
 * tenant is not the public demo workspace. The ML visuals reference 5-model
 * ensemble outputs that have only been trained for NovaPay — showing them on
 * a user's own (blank or just-cloned) workspace would be misleading.
 *
 * Per-tenant ML training is on the Y2 roadmap.
 */
export function MlNotAvailable({
  pageName,
}: {
  pageName: "Brain" | "Lab";
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
          <Sparkles className="h-6 w-6 text-purple-600" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 text-[24px] font-medium tracking-tight text-zinc-950">
          Sight {pageName} is calibrated for the demo workspace
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">
          The 5-model ensemble and SHAP attributions you&apos;d see here are trained on
          NovaPay&apos;s 180-day history. They&apos;d be misleading on a fresh
          workspace. Per-tenant ML retraining ships in Y2 — until then, dive in
          via the public demo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900 transition-colors hover:border-zinc-900"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
