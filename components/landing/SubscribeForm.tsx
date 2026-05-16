"use client";

import { ArrowRight } from "lucide-react";

export function SubscribeForm() {
  return (
    <form
      className="flex max-w-xs items-center gap-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder="Email address"
        aria-label="Email address"
        className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm placeholder:text-muted-foreground focus:border-zinc-400 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Subscribe"
        className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
