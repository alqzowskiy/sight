from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent

# Loading Chronos (PyTorch + HF) after Prophet (cmdstanpy) can segfault on macOS
# due to thread-pool / OpenMP conflicts. Forcing single-threaded OMP and disabling
# tokenizer parallelism keeps both libraries happy.
SAFE_ENV = {
    "OMP_NUM_THREADS": "1",
    "TOKENIZERS_PARALLELISM": "false",
    "KMP_DUPLICATE_LIB_OK": "TRUE",
}


def run(label: str, args: list[str]) -> None:
    start = time.time()
    print()
    print(f"==> {label}")
    env = {**os.environ, **SAFE_ENV}
    proc = subprocess.run([sys.executable, *args], cwd=SCRIPTS_DIR, env=env)
    if proc.returncode != 0:
        raise SystemExit(f"{label} failed with exit code {proc.returncode}")
    print(f"<== {label} done in {time.time() - start:.1f}s")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the full Sight ML pipeline: generate -> train -> export -> backtest.",
    )
    parser.add_argument("--days", type=int, default=365, help="Days of history to generate")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed")
    parser.add_argument(
        "--today",
        type=str,
        default=None,
        help="ISO date for 'today' (defaults to current UTC date)",
    )
    parser.add_argument("--skip-generate", action="store_true")
    parser.add_argument("--skip-train", action="store_true")
    parser.add_argument("--skip-anomaly", action="store_true")
    parser.add_argument("--skip-export", action="store_true")
    parser.add_argument("--skip-backtest", action="store_true")
    parser.add_argument("--skip-calibrate", action="store_true")
    args = parser.parse_args()

    if not args.skip_generate:
        gen_args = ["generate_history.py", "--days", str(args.days), "--seed", str(args.seed)]
        if args.today:
            gen_args.extend(["--today", args.today])
        run("generate_history", gen_args)
    if not args.skip_train:
        run("train_ensemble", ["train_ensemble.py"])
    # Anomaly detection runs BEFORE export so its findings can be embedded in
    # the JSON contract consumed by the UI.
    if not args.skip_anomaly:
        run("anomaly", ["anomaly.py"])
    if not args.skip_export:
        run("export_for_frontend", ["export_for_frontend.py"])
    if not args.skip_backtest:
        run("backtest", ["backtest.py"])
    if not args.skip_calibrate:
        run("calibrate", ["calibrate.py"])

    print()
    print("All steps complete. JSON outputs in public/data/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
