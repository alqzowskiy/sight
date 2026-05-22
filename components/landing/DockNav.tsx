"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Show, UserButton, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Models", href: "#models" },
  { label: "Results", href: "#results" },
];

export function DockNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // Signed-in users see a much shorter bar (logo · Dashboard · avatar). Stretching
  // it to the full 760px leaves an awkward empty stretch in the middle, so we
  // shrink the bar to fit the actual content for that state.
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
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
    <>
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: isSignedIn
            ? "min(360px, calc(100vw - 2rem))"
            : "min(760px, calc(100vw - 2rem))",
        }}
        className={cn(
          "fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-all duration-300",
          scrolled ? "scale-[0.97]" : "scale-100",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-full border border-zinc-200/80 bg-white/75 px-2 py-2 backdrop-blur-xl transition-shadow duration-300",
            scrolled
              ? "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]"
              : "shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)]",
          )}
        >
          <a
            href="#top"
            className="flex items-center gap-0.5 rounded-full px-3 py-1 text-[15px] font-medium tracking-tight text-foreground"
          >
            <Image
              src="/sight-logo.svg"
              alt=""
              width={28}
              height={28}
              priority
              className="h-[28px] w-[28px]"
            />
            <span>Sight</span>
          </a>

          {/* Section links are landing-page navigation — only relevant for
              prospects. Signed-in users get a clean bar with just Dashboard. */}
          <Show when="signed-out">
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </Show>

          <Show when="signed-in">
            {/* Group Dashboard + Avatar tight on the right; without this they
                end up centered by `justify-between` when no section nav is
                rendered, which leaves awkward empty space in the middle. */}
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-all duration-200 hover:bg-foreground/90 md:inline-flex"
              >
                Dashboard
                <ArrowRight className="h-3 w-3" />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8",
                    userButtonTrigger:
                      "rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-900",
                  },
                }}
              />
            </div>
          </Show>
          <Show when="signed-out">
            <Link
              href="/sign-up"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-all duration-200 hover:bg-foreground/90 md:inline-flex"
            >
              Sign up free
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Show>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-full p-2 text-foreground md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </motion.header>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex h-16 items-center justify-between px-6">
            <a
              href="#top"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 text-[15px] font-medium tracking-tight"
            >
              <Image
                src="/sight-logo.svg"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              Sight
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-full p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-start gap-5 px-8 pt-8">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-2xl font-medium tracking-tight text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Show when="signed-in">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-5 py-3 text-center text-sm font-medium text-background"
              >
                Open dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-4 flex items-center gap-3 self-start">
                <UserButton
                  appearance={{
                    elements: { avatarBox: "h-8 w-8" },
                  }}
                />
                <span className="text-sm text-zinc-500">Your account</span>
              </div>
            </Show>
            <Show when="signed-out">
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-5 py-3 text-center text-sm font-medium text-background"
              >
                Sign up free
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-900"
              >
                Sign in
              </Link>
            </Show>
          </div>
        </div>
      )}
    </>
  );
}
