"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  Bell,
  Compass,
  Eye,
  FlaskConical,
  LayoutDashboard,
  Radar,
  Settings,
  Wallet,
} from "lucide-react";

const sidebar = [
  { Icon: LayoutDashboard, label: "Dashboard" },
  { Icon: Wallet, label: "Accounts" },
  { Icon: Eye, label: "Forecast", active: true },
  { Icon: Radar, label: "Radar" },
  { Icon: Compass, label: "Compass" },
  { Icon: FlaskConical, label: "Lab" },
  { Icon: Settings, label: "Settings" },
];

const kpis = [
  { label: "Total liquidity", value: "$42.8M", delta: "+3.2%", up: true },
  { label: "Idle reserve", value: "$11.4M", delta: "−$2.1M", up: false },
  { label: "Active alerts", value: "3", delta: "1 critical", up: false },
  { label: "Liquidity score", value: "84", delta: "+6", up: true },
];

const alerts = [
  {
    sev: "danger",
    title: "EUR-BNP · projected overdraft Fri 14:00",
    time: "in 3d",
  },
  {
    sev: "warning",
    title: "SWIFT batch delayed · Settlement T+1",
    time: "in 1d",
  },
  {
    sev: "info",
    title: "Quarter-end FX exposure outside policy band",
    time: "today",
  },
];

const accounts = [
  { name: "JPM · USD-NYC", ccy: "USD", bal: "$18,422,108", st: "success" },
  { name: "BNP · EUR-PAR", ccy: "EUR", bal: "€9,108,544", st: "warning" },
  { name: "HSBC · GBP-LON", ccy: "GBP", bal: "£6,247,891", st: "success" },
  { name: "DBS · SGD-SIN", ccy: "SGD", bal: "S$3,401,200", st: "success" },
  { name: "Mizuho · JPY-TYO", ccy: "JPY", bal: "¥412,000,000", st: "info" },
];

const chartPoints = [38, 42, 40, 44, 47, 41, 36, 32, 28, 30, 34, 39, 44, 47];
const noise = [1.2, 1.8, 0.9, 1.5, 2.0, 1.1, 1.7, 1.3, 1.9, 1.0, 1.6, 1.4, 1.8, 1.2];
const upperPoints = chartPoints.map((v, i) => v + 7 + noise[i]);
const lowerPoints = chartPoints.map((v, i) => v - 7 - noise[(i + 7) % noise.length]);

function buildPath(values: number[], w: number, h: number) {
  const min = 18;
  const max = 60;
  const step = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildArea(upper: number[], lower: number[], w: number, h: number) {
  const top = buildPath(upper, w, h);
  const step = w / (lower.length - 1);
  const min = 18;
  const max = 60;
  const bottom = lower
    .slice()
    .reverse()
    .map((v, i) => {
      const x = (lower.length - 1 - i) * step;
      const y = h - ((v - min) / (max - min)) * h;
      return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return `${top} ${bottom} Z`;
}

const W = 720;
const H = 200;
const linePath = buildPath(chartPoints, W, H);
const areaPath = buildArea(upperPoints, lowerPoints, W, H);

const stagger = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const dotClass = (sev: string) =>
  sev === "danger"
    ? "bg-danger"
    : sev === "warning"
      ? "bg-warning"
      : sev === "info"
        ? "bg-sky-400"
        : "bg-success";

export function ProductMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-[0_40px_80px_-24px_rgba(0,0,0,0.4)]">
      <div className="flex">
        <motion.aside
          {...stagger(0)}
          className="hidden w-44 flex-none border-r border-zinc-800/80 py-5 md:block"
        >
          <div className="px-5 pb-5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Workspace
          </div>
          <nav className="space-y-0.5 px-2">
            {sidebar.map(({ Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-900/50 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            ))}
          </nav>
        </motion.aside>

        <div className="flex-1">
          <motion.header
            {...stagger(0.05)}
            className="flex items-center justify-between gap-4 border-b border-zinc-800/80 px-5 py-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                Forecast
              </span>
              <span className="text-zinc-700">/</span>
              <span className="text-[13px] text-white">All accounts</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden h-7 w-44 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-2.5 text-[11px] text-zinc-500 md:flex">
                <span className="text-zinc-600">/</span>
                Search accounts, rules…
              </div>
              <Bell className="h-3.5 w-3.5 text-zinc-500" />
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700" />
            </div>
          </motion.header>

          <div className="space-y-5 p-5">
            <motion.div
              {...stagger(0.15)}
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5"
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {k.label}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xl font-medium tracking-tight md:text-2xl">
                      {k.value}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${k.up ? "text-success" : "text-danger"}`}
                    >
                      {k.delta}
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 80 14"
                    preserveAspectRatio="none"
                    className="mt-2 h-3 w-full"
                  >
                    <path
                      d="M 0 8 L 10 6 L 20 9 L 30 5 L 40 7 L 50 3 L 60 6 L 70 2 L 80 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-zinc-500"
                    />
                  </svg>
                </div>
              ))}
            </motion.div>

            <motion.div
              {...stagger(0.25)}
              className="grid grid-cols-1 gap-3 md:grid-cols-3"
            >
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      7-day cash flow forecast
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="font-mono text-base font-medium md:text-lg">
                        $42.8M projected
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        P50 · 95% band
                      </span>
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 font-mono text-[10px] text-zinc-500 md:flex">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    Median
                    <span className="ml-3 inline-flex h-1.5 w-3 rounded-full bg-white/20" />
                    Confidence
                  </div>
                </div>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  className="mt-3 h-32 w-full md:h-40"
                  aria-hidden="true"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                    <line
                      key={p}
                      x1={0}
                      x2={W}
                      y1={H * p}
                      y2={H * p}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={1}
                    />
                  ))}
                  <path d={areaPath} fill="rgba(255,255,255,0.08)" />
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.5}
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </svg>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Alerts
                  </div>
                  <span className="font-mono text-[10px] text-danger">
                    3 active
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {alerts.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-md border border-zinc-800/60 bg-zinc-950 p-2.5"
                    >
                      <span
                        className={`mt-1 inline-flex h-1.5 w-1.5 flex-none rounded-full ${dotClass(a.sev)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-white">
                          {a.title}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          {a.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              {...stagger(0.35)}
              className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900/30"
            >
              <div className="grid grid-cols-[1.6fr_60px_1fr_80px] gap-2 border-b border-zinc-800/80 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <div>Account</div>
                <div>Ccy</div>
                <div className="text-right">Balance</div>
                <div className="text-right">Status</div>
              </div>
              {accounts.map((a) => (
                <div
                  key={a.name}
                  className="grid grid-cols-[1.6fr_60px_1fr_80px] items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5 text-[12px] last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-3 w-3 ${a.st === "warning" ? "text-warning" : "opacity-0"}`}
                    />
                    <span className="text-white">{a.name}</span>
                  </div>
                  <div className="font-mono text-zinc-400">{a.ccy}</div>
                  <div className="text-right font-mono text-white">{a.bal}</div>
                  <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] text-zinc-400">
                    <span
                      className={`inline-flex h-1.5 w-1.5 rounded-full ${dotClass(a.st)}`}
                    />
                    {a.st === "warning" ? "watch" : "ok"}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
