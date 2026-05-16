import { ProductMockup } from "./ProductMockup";
import { FadeIn } from "./FadeIn";

const factoids = [
  "8 bank integrations",
  "15 currencies",
  "4 clearing channels",
  "99.97% uptime",
  "<200ms forecast latency",
];

export function LiveGlimpseSection() {
  return (
    <section className="relative bg-zinc-950 px-6 pb-16 pt-12 text-white md:px-10 md:pb-20 md:pt-14 lg:px-16 lg:pb-24 lg:pt-16">
      <div className="mx-auto max-w-[1280px]">
        <FadeIn>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Live from the terminal
          </p>
          <h2
            className="mt-5 max-w-[820px] font-medium leading-[1.05] tracking-[-0.035em]"
            style={{ fontSize: "clamp(28px, 3.5vw, 52px)" }}
          >
            <span className="text-zinc-500">
              Every account. Every currency. Every clearing channel.
            </span>{" "}
            <span className="text-white">One screen.</span>
          </h2>
        </FadeIn>

        <FadeIn className="mt-10 md:mt-14">
          <div className="-mx-6 overflow-x-auto md:mx-0">
            <div className="min-w-[760px] px-6 md:min-w-0 md:px-0">
              <ProductMockup />
            </div>
          </div>
        </FadeIn>

        <FadeIn className="mt-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[12px] text-zinc-500">
            {factoids.map((f, i) => (
              <span key={f} className="flex items-center gap-x-3">
                <span>{f}</span>
                {i < factoids.length - 1 && (
                  <span className="text-zinc-700" aria-hidden="true">·</span>
                )}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
