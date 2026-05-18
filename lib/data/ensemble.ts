import selectionJson from "@/public/data/selection.json";

export const BASE_MODELS = [
  "prophet",
  "lightgbm",
  "arima",
  "ets",
  "chronos",
] as const;

export type BaseModel = (typeof BASE_MODELS)[number];
export type AllModel = BaseModel | "stacker";

export interface ModelInfo {
  id: AllModel;
  name: string;
  family: string;
  tagline: string;
  paper: string;
}

export const MODEL_INFO: Record<AllModel, ModelInfo> = {
  prophet: {
    id: "prophet",
    name: "Prophet",
    family: "Bayesian time series",
    tagline: "Decomposes signal into trend, seasonality, and holidays.",
    paper: "Facebook, 2017",
  },
  lightgbm: {
    id: "lightgbm",
    name: "LightGBM",
    family: "Quantile gradient boosting",
    tagline: "3 quantile models per account on 35 engineered features.",
    paper: "Microsoft, 2017",
  },
  arima: {
    id: "arima",
    name: "ARIMA",
    family: "Classical autoregressive",
    tagline: "Auto-order via AIC. Captures short-term autocorrelation.",
    paper: "Box & Jenkins, 1976",
  },
  ets: {
    id: "ets",
    name: "ETS",
    family: "Exponential smoothing",
    tagline: "Holt-Winters error / trend / seasonality decomposition.",
    paper: "Hyndman et al., 2008",
  },
  chronos: {
    id: "chronos",
    name: "Chronos",
    family: "Foundation transformer",
    tagline: "60M-param T5 pretrained on millions of series. Zero-shot.",
    paper: "Amazon Science, 2024",
  },
  stacker: {
    id: "stacker",
    name: "Ridge Stacker",
    family: "Meta-learner",
    tagline:
      "Linear combination of base predictions. Positive-constrained weights from holdout.",
    paper: "Wolpert, 1992",
  },
};

interface SelectionEntry {
  chosen: string;
  mape: Partial<Record<AllModel, number | null>>;
}

const SELECTION = selectionJson as Record<string, SelectionEntry>;

export interface EnsembleSnapshot {
  accountId: string;
  chosen: string;
  mapes: Record<BaseModel, number>;
  weights: Record<BaseModel, number>;
  stackerMape: number | null;
}

export function getEnsembleSnapshot(
  accountId: string,
): EnsembleSnapshot | null {
  const entry = SELECTION[accountId];
  if (!entry) return null;
  const mapes = {} as Record<BaseModel, number>;
  for (const m of BASE_MODELS) {
    const v = entry.mape[m];
    mapes[m] = typeof v === "number" && Number.isFinite(v) ? v : 50;
  }
  const inv: Record<BaseModel, number> = {} as Record<BaseModel, number>;
  let total = 0;
  for (const m of BASE_MODELS) {
    const w = 1 / Math.max(mapes[m], 0.1);
    inv[m] = w;
    total += w;
  }
  const weights = {} as Record<BaseModel, number>;
  for (const m of BASE_MODELS) {
    weights[m] = inv[m] / total;
  }
  return {
    accountId,
    chosen: entry.chosen,
    mapes,
    weights,
    stackerMape:
      typeof entry.mape.stacker === "number" ? entry.mape.stacker : null,
  };
}

export function getAllAccountIdsWithSelection(): string[] {
  return Object.keys(SELECTION);
}
