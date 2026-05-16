"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const links = [
  { label: "Product", href: "#engines" },
  { label: "Architecture", href: "#architecture" },
  { label: "Customers", href: "#voices" },
  { label: "Pricing", href: "#pricing" },
];

export function DockNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
        style={{ width: "min(720px, calc(100vw - 2rem))" }}
        className={cn(
          "fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-all duration-300",
          scrolled ? "scale-[0.97]" : "scale-100"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-full border border-zinc-200/80 bg-white/75 px-2 py-2 backdrop-blur-xl transition-shadow duration-300",
            scrolled
              ? "shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]"
              : "shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)]"
          )}
        >
          <a
            href="#top"
            className="flex items-center gap-0.5 rounded-full px-3 py-1 text-[15px] font-medium tracking-tight text-foreground"
          >
            <Image
              src="/sight-logo.svg"
              alt=""
              width={30}
              height={30}
              priority
              className="h-[30px] w-[30px]"
            />
            <span>Sight</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href="#request"
            className="hidden rounded-full bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.12)] md:inline-flex"
          >
            Request access
          </a>

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
        <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200 md:hidden">
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
            <a
              href="#request"
              onClick={() => setOpen(false)}
              className="mt-8 w-full rounded-full bg-foreground px-5 py-3 text-center text-sm font-medium text-background"
            >
              Request access
            </a>
          </div>
        </div>
      )}
    </>
  );
}
