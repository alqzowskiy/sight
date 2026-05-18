export type FlowChannel =
  | "SEPA_INSTANT"
  | "SEPA_STANDARD"
  | "VISA"
  | "MASTERCARD"
  | "SWIFT"
  | "INTERNAL";

export interface TypicalFlow {
  from: string;
  to: string;
  weight: number;
  channels: FlowChannel[];
  amounts: [number, number];
}

export const TYPICAL_FLOWS: TypicalFlow[] = [
  { from: "eur-frankfurt", to: "eur-paris", weight: 8, channels: ["SEPA_INSTANT", "SEPA_STANDARD"], amounts: [50000, 1500000] },
  { from: "eur-paris", to: "eur-frankfurt", weight: 6, channels: ["SEPA_INSTANT"], amounts: [20000, 800000] },
  { from: "usd-nyc", to: "usd-sf", weight: 5, channels: ["SWIFT"], amounts: [100000, 2000000] },
  { from: "usd-sf", to: "usd-nyc", weight: 3, channels: ["SWIFT"], amounts: [50000, 1000000] },
  { from: "visa-eur", to: "eur-frankfurt", weight: 12, channels: ["VISA"], amounts: [5000, 200000] },
  { from: "visa-eur", to: "eur-paris", weight: 9, channels: ["VISA"], amounts: [4000, 180000] },
  { from: "mc-usd", to: "usd-nyc", weight: 10, channels: ["MASTERCARD"], amounts: [3000, 150000] },
  { from: "mc-usd", to: "usd-sf", weight: 7, channels: ["MASTERCARD"], amounts: [3000, 120000] },
  { from: "eur-frankfurt", to: "usd-nyc", weight: 3, channels: ["SWIFT"], amounts: [500000, 5000000] },
  { from: "usd-nyc", to: "eur-frankfurt", weight: 2, channels: ["SWIFT"], amounts: [300000, 3000000] },
  { from: "gbp-london", to: "eur-frankfurt", weight: 4, channels: ["SWIFT"], amounts: [100000, 1200000] },
  { from: "eur-frankfurt", to: "gbp-london", weight: 3, channels: ["SWIFT"], amounts: [80000, 900000] },
  { from: "sgd-singapore", to: "usd-nyc", weight: 2, channels: ["SWIFT"], amounts: [200000, 800000] },
  { from: "usd-nyc", to: "sgd-singapore", weight: 2, channels: ["SWIFT"], amounts: [150000, 700000] },
  { from: "chf-zurich", to: "eur-frankfurt", weight: 3, channels: ["SWIFT"], amounts: [50000, 600000] },
  { from: "eur-frankfurt", to: "chf-zurich", weight: 2, channels: ["SWIFT"], amounts: [40000, 500000] },
  { from: "fx-hedging", to: "usd-nyc", weight: 2, channels: ["INTERNAL"], amounts: [100000, 500000] },
  { from: "regulatory-reserve", to: "eur-frankfurt", weight: 1, channels: ["INTERNAL"], amounts: [200000, 800000] },
];

export interface ResolvedFlow {
  from: string;
  to: string;
  channel: FlowChannel;
  amount: number;
}

export function pickRandomFlow(): TypicalFlow {
  const total = TYPICAL_FLOWS.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const flow of TYPICAL_FLOWS) {
    r -= flow.weight;
    if (r <= 0) return flow;
  }
  return TYPICAL_FLOWS[0];
}

export function sampleAmount(min: number, max: number): number {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + Math.random() * (logMax - logMin));
}

export function resolveFlow(flow: TypicalFlow): ResolvedFlow {
  const channel = flow.channels[Math.floor(Math.random() * flow.channels.length)];
  return {
    from: flow.from,
    to: flow.to,
    channel,
    amount: sampleAmount(flow.amounts[0], flow.amounts[1]),
  };
}

export interface ChannelStyle {
  color: string;
  trailColor: string;
  glowColor: string;
  width: number;
  dashed: boolean;
  shortLabel: string;
}

const ACCENT = "#2563EB";

export const CHANNEL_STYLE: Record<FlowChannel, ChannelStyle> = {
  SEPA_INSTANT: {
    color: ACCENT,
    trailColor: "rgba(37,99,235,0.35)",
    glowColor: "rgba(37,99,235,0.55)",
    width: 1.1,
    dashed: false,
    shortLabel: "SEPA",
  },
  SEPA_STANDARD: {
    color: "#60A5FA",
    trailColor: "rgba(96,165,250,0.32)",
    glowColor: "rgba(96,165,250,0.5)",
    width: 1.0,
    dashed: false,
    shortLabel: "SEPA",
  },
  VISA: {
    color: "#3F3F46",
    trailColor: "rgba(63,63,70,0.3)",
    glowColor: "rgba(63,63,70,0.42)",
    width: 1.0,
    dashed: false,
    shortLabel: "VISA",
  },
  MASTERCARD: {
    color: "#52525B",
    trailColor: "rgba(82,82,91,0.3)",
    glowColor: "rgba(82,82,91,0.42)",
    width: 1.0,
    dashed: false,
    shortLabel: "MC",
  },
  SWIFT: {
    color: "#0A0A0A",
    trailColor: "rgba(10,10,10,0.32)",
    glowColor: "rgba(10,10,10,0.45)",
    width: 1.3,
    dashed: false,
    shortLabel: "SWIFT",
  },
  INTERNAL: {
    color: "#A1A1AA",
    trailColor: "rgba(161,161,170,0.32)",
    glowColor: "rgba(161,161,170,0.4)",
    width: 0.9,
    dashed: true,
    shortLabel: "INTL",
  },
};

export function getDurationForChannel(channel: FlowChannel): number {
  switch (channel) {
    case "SEPA_INSTANT":
      return 1000;
    case "SEPA_STANDARD":
      return 1200;
    case "VISA":
    case "MASTERCARD":
      return 1400;
    case "SWIFT":
      return 1800;
    case "INTERNAL":
      return 800;
  }
}
