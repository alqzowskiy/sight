import type { ReactNode } from "react";
import { FadeIn } from "./motion-primitives";

interface PageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  eyebrow = "NovaPay",
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex w-full max-w-[1280px] items-end justify-between gap-6 px-8 pb-6 pt-7">
          <FadeIn y={6} duration={0.45}>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]"
            >
              <span className="text-zinc-400">{eyebrow}</span>
              <span className="text-zinc-300">/</span>
              <span className="text-zinc-700">{title}</span>
            </nav>
            <h1 className="mt-2 text-[22px] font-medium leading-tight tracking-tight text-zinc-900">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-[640px] text-[13px] text-zinc-500">
                {description}
              </p>
            )}
          </FadeIn>
          {actions && (
            <FadeIn y={6} delay={0.08} duration={0.45}>
              <div className="flex items-center gap-2">{actions}</div>
            </FadeIn>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <FadeIn y={10} delay={0.06} duration={0.6}>
          <div className="mx-auto w-full max-w-[1280px] px-8 py-8">
            {children}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
