import { FadeIn } from "./FadeIn";

const logos = [
  {
    name: "NovaPay",
    mark: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="6" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Helix",
    mark: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <rect x="2" y="2" width="12" height="12" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Orbit Bank",
    mark: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <path d="M8 2 L14 14 L2 14 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Lyra",
    mark: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <path
          d="M8 1.5 L9.5 6.5 L14.5 8 L9.5 9.5 L8 14.5 L6.5 9.5 L1.5 8 L6.5 6.5 Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: "Vector Finance",
    mark: (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <path
          d="M8 1.5 L14.5 5 L14.5 11 L8 14.5 L1.5 11 L1.5 5 Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export function LogoStrip() {
  return (
    <section className="bg-subtle px-6 py-12 md:px-8">
      <FadeIn className="mx-auto max-w-6xl">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by treasury teams at
        </p>
        <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-6 md:gap-x-16">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="group flex h-10 items-center gap-2 text-zinc-400 opacity-80 transition-all duration-300 hover:text-zinc-700 hover:opacity-100"
            >
              {logo.mark}
              <span className="text-base font-medium tracking-tight">
                {logo.name}
              </span>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
