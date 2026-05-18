"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FlaskConical, Siren, Brain } from "lucide-react";
import { SightLogo } from "@/components/sight/sight-logo";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

export function Sidebar() {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Brain", href: "/dashboard/brain", icon: Brain },
    { label: "Lab", href: "/dashboard/lab", icon: FlaskConical },
    { label: "Crisis", href: "/dashboard/crisis", icon: Siren },
  ];

  return (
    <aside className="flex h-screen w-[68px] shrink-0 flex-col items-center border-r border-zinc-200/80 bg-white py-4">
      <Link
        href="/"
        className="mb-6 flex h-9 w-9 items-center justify-center"
        aria-label="Sight home"
      >
        <SightLogo size={28} />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const cls = `group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
            active
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          }`;

          return (
            <Link key={item.label} href={item.href} className={cls}>
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-x-[7px] -translate-y-1/2 rounded-r bg-zinc-900" />
              )}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
