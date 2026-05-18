from __future__ import annotations

import argparse
import json
import logging
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT, PUBLIC_DATA, load_accounts  # noqa: E402
from ensemble_inference import predict_with_model, shap_for_account  # noqa: E402


MODEL_VERSION = "sight-v3-ensemble"
HISTORY_DAYS = 90
FORECAST_DAYS = 14


def silence_logs() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models", "statsmodels"):
        logging.getLogger(name).setLevel(logging.ERROR)


def build_points(history: pd.DataFrame, forecast: pd.DataFrame, shap_per_horizon: list[list[dict]], history_days: int) -> list[dict]:
    hist = history.tail(history_days).copy()
    hist["date"] = pd.to_datetime(hist["date"])
    points: list[dict] = []
    for _, row in hist.iterrows():
        b = float(row["balance"])
        points.append(
            {
                "date": row["date"].date().isoformat(),
                "balance": round(b, 2),
                "p10": round(b, 2),
                "p90": round(b, 2),
                "isHistorical": True,
            }
        )
    forecast = forecast.copy()
    forecast["date"] = pd.to_datetime(forecast["date"])
    for i, (_, row) in enumerate(forecast.iterrows()):
        point: dict = {
            "date": row["date"].date().isoformat(),
            "balance": round(float(row["balance"]), 2),
            "p10": round(float(row["p10"]), 2),
            "p90": round(float(row["p90"]), 2),
            "isHistorical": False,
        }
        if i < len(shap_per_horizon) and shap_per_horizon[i]:
            point["shap"] = shap_per_horizon[i]
        points.append(point)
    return points


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--daily", type=str, default=str(ML_ROOT / "data" / "daily_balances.parquet")
    )
    parser.add_argument(
        "--models-dir", type=str, default=str(ML_ROOT / "models")
    )
    parser.add_argument(
        "--selection", type=str, default=str(ML_ROOT / "models" / "selection.json")
    )
    parser.add_argument(
        "--output", type=str, default=str(PUBLIC_DATA / "forecasts.json")
    )
    parser.add_argument("--history-days", type=int, default=HISTORY_DAYS)
    parser.add_argument("--forecast-days", type=int, default=FORECAST_DAYS)
    args = parser.parse_args()

    silence_logs()

    daily = pd.read_parquet(args.daily)
    daily["date"] = pd.to_datetime(daily["date"])
    accounts = load_accounts()
    accounts_meta = {
        a.id: {
            "currency": a.currency,
            "type": a.type,
            "min_balance": a.min_balance,
            "country_for_holidays": a.country_for_holidays,
        }
        for a in accounts
    }

    selections: dict[str, dict] = {}
    selection_path = Path(args.selection)
    if selection_path.exists():
        selections = json.loads(selection_path.read_text())

    models_dir = Path(args.models_dir)
    payload: dict[str, list[dict]] = {}
    chosen_by_account: dict[str, str] = {}

    for account in accounts:
        sub = daily[daily["account_id"] == account.id].copy()
        if sub.empty:
            continue
        sub = sub.sort_values("date").reset_index(drop=True)
        chosen = selections.get(account.id, {}).get("chosen", "prophet")
        try:
            forecast = predict_with_model(
                chosen,
                account.id,
                sub,
                accounts_meta,
                models_dir,
                args.forecast_days,
                daily_all=daily,
            )
            shap_top = shap_for_account(
                chosen,
                account.id,
                sub,
                accounts_meta,
                models_dir,
                args.forecast_days,
                daily_all=daily,
            )
        except Exception as e:
            print(f"  {account.id} [{chosen}] failed: {e}, falling back to prophet")
            chosen = "prophet"
            forecast = predict_with_model(
                "prophet",
                account.id,
                sub,
                accounts_meta,
                models_dir,
                args.forecast_days,
                daily_all=daily,
            )
            shap_top = [[] for _ in range(args.forecast_days)]

        history = sub[["date", "balance"]].copy()
        points = build_points(history, forecast, shap_top, args.history_days)
        payload[account.id] = points
        chosen_by_account[account.id] = chosen
        print(f"  {account.id}: {chosen}, {len(points)} points")

    output_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model_version": MODEL_VERSION,
        "ensemble_members": ["prophet", "lightgbm", "arima", "ets", "chronos", "stacker"],
        "history_days": args.history_days,
        "forecast_days": args.forecast_days,
        "model_per_account": chosen_by_account,
        "accounts": payload,
    }
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output_payload, indent=2))
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
