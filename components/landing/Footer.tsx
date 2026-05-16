import Image from "next/image";
import { SubscribeForm } from "./SubscribeForm";

const columns = [
  {
    heading: "Product",
    links: [
      "Dashboard",
      "Forecast",
      "Radar",
      "Compass",
      "Lab",
      "Pricing",
    ],
  },
  {
    heading: "Solutions",
    links: ["Neobanks", "Payment ops", "Crypto exchanges", "Marketplaces"],
  },
  {
    heading: "Resources",
    links: [
      "Documentation",
      "API reference",
      "Changelog",
      "Status",
      "System health",
    ],
  },
  {
    heading: "Company",
    links: ["About", "Careers (3 open)", "Blog", "Contact"],
  },
  {
    heading: "Legal",
    links: ["Privacy", "Terms", "Security", "SOC 2 (in progress)"],
  },
];

const socials = [
  {
    label: "X",
    href: "#x",
    path: "M18.244 2H21.5l-7.5 8.57L23 22h-6.81l-5.33-6.97L4.78 22H1.52l8.04-9.19L1 2h6.91l4.81 6.36L18.244 2Zm-1.19 18h1.88L7.04 4H5.04l12.013 16Z",
  },
  {
    label: "LinkedIn",
    href: "#linkedin",
    path: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z",
  },
  {
    label: "GitHub",
    href: "#github",
    path: "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.88-1.36-3.88-1.36-.53-1.35-1.3-1.71-1.3-1.71-1.06-.72.08-.71.08-.71 1.18.08 1.8 1.21 1.8 1.21 1.04 1.79 2.74 1.27 3.41.97.1-.76.41-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.2-3.08-.12-.3-.52-1.47.11-3.06 0 0 .98-.31 3.2 1.18a11 11 0 0 1 5.83 0c2.21-1.49 3.19-1.18 3.19-1.18.63 1.59.23 2.76.11 3.06.75.8 1.2 1.82 1.2 3.08 0 4.42-2.7 5.39-5.27 5.68.42.36.79 1.07.79 2.17v3.21c0 .31.21.67.8.56C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z",
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-zinc-200 px-6 pb-10 pt-16 md:px-10 md:pt-20 lg:px-16">
      <div className="mx-auto max-w-[1280px]">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none text-center leading-[0.85]"
          style={{
            fontSize: "clamp(80px, 12vw, 180px)",
            fontWeight: 500,
            letterSpacing: "-0.05em",
            color: "transparent",
            WebkitTextStroke: "1px rgba(0,0,0,0.12)",
          }}
        >
          SIGHT
        </div>
        <p className="mt-4 text-center font-mono text-[12px] uppercase tracking-[0.22em] text-muted-foreground">
          See your money&rsquo;s future · trysight.com
        </p>

        <div className="mt-14 grid grid-cols-2 gap-10 md:grid-cols-6">
          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-5 text-[13px] font-medium text-foreground">
                {col.heading}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href={`#${link.toLowerCase().split(" ")[0]}`}
                      className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-900"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 md:col-span-1">
            <h4 className="mb-5 text-[13px] font-medium text-foreground">
              The Sight letter
            </h4>
            <p className="mb-4 text-[12px] text-zinc-500">
              Quarterly notes from our team on liquidity, treasury, and ML.
            </p>
            <SubscribeForm />
            <p className="mt-3 font-mono text-[10px] text-muted-foreground">
              No spam. Unsubscribe in one click.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
            <Image
              src="/sight-logo.svg"
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5"
            />
            <span>&copy; 2026 Sight Inc.</span>
          </div>
          <a
            href="#status"
            className="inline-flex items-center gap-2 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            All systems operational →
          </a>
          <div className="flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
