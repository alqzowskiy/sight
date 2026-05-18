export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF ",
  SGD: "S$",
};

export function formatCompact(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  let value: number;
  let suffix: string;
  if (abs >= 1_000_000_000) {
    value = abs / 1_000_000_000;
    suffix = "B";
  } else if (abs >= 1_000_000) {
    value = abs / 1_000_000;
    suffix = "M";
  } else if (abs >= 1_000) {
    value = abs / 1_000;
    suffix = "K";
  } else {
    value = abs;
    suffix = "";
  }

  const rounded = Math.round(value * 10) / 10;
  const display =
    suffix === "" || rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);

  return `${sign}${symbol}${display}${suffix}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatRelativeDate(date: string): string {
  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

export function formatDateTime(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
