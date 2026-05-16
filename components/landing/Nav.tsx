"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Docs", href: "#docs" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-16 transition-all duration-200",
        scrolled
          ? "border-b border-zinc-200/80 bg-white/75 backdrop-blur-2xl shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6 md:px-8">
        <a
          href="#top"
          className="flex items-center gap-1.5 text-[15px] font-medium tracking-tight text-foreground"
        >
          <Image
            src="/sight-logo.svg"
            alt=""
            width={22}
            height={22}
            priority
            className="h-[22px] w-[22px]"
          />
          Sight
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <kbd
            className="inline-flex select-none items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-zinc-100"
            aria-label="Search command palette"
          >
            <span className="text-[11px]">⌘</span>K
          </kbd>
          <a
            href="#signin"
            className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            Sign in
          </a>
          <a
            href="#get-started"
            className="group inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
          >
            Request access
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200 md:hidden">
          <div className="flex h-16 items-center justify-between px-6">
            <a
              href="#top"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-[15px] font-medium tracking-tight"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
              Sight
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-start gap-6 px-8 pt-8">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-3xl font-medium tracking-tight text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-8 flex w-full flex-col gap-3">
              <a
                href="#signin"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-5 py-3 text-center text-sm font-medium"
              >
                Sign in
              </a>
              <a
                href="#get-started"
                onClick={() => setOpen(false)}
                className="rounded-full bg-foreground px-5 py-3 text-center text-sm font-medium text-background"
              >
                Get started
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
