# Sight ML pipeline

Generates synthetic NovaPay treasury history, trains a Prophet forecast model per account, and writes the JSON files the Next.js frontend reads.

The frontend never calls Python at runtime. It reads:

- `public/data/accounts.json` — static metadata for the 11 accounts (committed to the repo)
- `public/data/forecasts.json` — produced by `export_for_frontend.py`
- `public/data/backtest_results.json` — produced by `backtest.py`

Commit the generated JSON to the repo after a successful run.

## Layout

```
ml/
  scripts/
    accounts_config.py       account metadata + per-account behavioral profiles
    generate_history.py      synthesize 180d of transactions + daily balances
    train_models.py          fit Prophet per account
    export_for_frontend.py   write public/data/forecasts.json
    backtest.py              walk-forward eval -> public/data/backtest_results.json
    run_all.py               orchestrator
  data/                      intermediate parquet files (gitignored)
  models/                    trained Prophet pickles (gitignored)
  pyproject.toml
  README.md
```

## Prereqs

Python 3.10–3.13 and either `uv` or `pip`. Prophet needs a working C++ toolchain (cmdstan is bundled).

## Setup with uv (recommended)

```bash
cd ml
uv venv
uv sync
```

## Setup with pip

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Regenerate everything

```bash
cd ml
python scripts/run_all.py
```

This will, in order:

1. Generate 180 days of synthetic NovaPay transactions and daily balances → `ml/data/`
2. Train one Prophet model per account → `ml/models/{account}_prophet.pkl`
3. Export the last 90 days of history + a 14-day forecast → `public/data/forecasts.json`
4. Run a walk-forward backtest over the last 30 days → `public/data/backtest_results.json`

Total runtime is roughly 2–5 minutes on a modern laptop.

## Step-by-step

```bash
python scripts/generate_history.py            # writes ml/data/*.parquet
python scripts/train_models.py                # writes ml/models/*.pkl
python scripts/export_for_frontend.py         # writes public/data/forecasts.json
python scripts/backtest.py                    # writes public/data/backtest_results.json
```

`run_all.py` accepts `--skip-generate`, `--skip-train`, `--skip-export`, `--skip-backtest` for iterating on a single stage.

## What the forecast must look like

USD-NYC is configured to drift below its minimum balance over the 180-day history. Its target balance is ~$460K against a $800K minimum, so by day 180 the daily balance should be in the $400–600K range. Prophet learns this trajectory and projects continued weakness over the next 14 days — that drives the demo's "USD-NYC is in trouble" story.

If the forecast looks too bland after a fresh run, increase `mean_reversion` for `usd-nyc` in `accounts_config.py` and retrain.

## Determinism

`generate_history.py` accepts `--seed` (default 42). Same seed → same transactions → same Prophet fits → same JSON.

## Resetting

Delete `ml/data/`, `ml/models/`, `public/data/forecasts.json`, and `public/data/backtest_results.json` to start clean. Do not delete `public/data/accounts.json` — that is the canonical static metadata.
