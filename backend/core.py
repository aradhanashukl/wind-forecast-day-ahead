from pathlib import Path

import pandas as pd

CUTOFF_HOUR = 9  # hour of D-1 (UTC = UK time in January); configurable
DATA_DIR = Path(__file__).resolve().parent / "data"  # works from any working directory


def load(folder=DATA_DIR):
    folder = Path(folder)
    a = pd.read_csv(folder / "actuals.csv")
    f = pd.read_csv(folder / "forecasts.csv")
    a["startTime"] = pd.to_datetime(a["startTime"], utc=True)
    f["startTime"] = pd.to_datetime(f["startTime"], utc=True)
    f["publishTime"] = pd.to_datetime(f["publishTime"], utc=True)
    return a, f

def hourly_actuals(a):
    """Average the two half-hour values inside each hour."""
    h = a.assign(startTime=a.startTime.dt.floor("h"))
    h = h.groupby("startTime", as_index=False).generation.mean()
    return h.rename(columns={"generation": "actual"})

def cutoff_for(day, hour=CUTOFF_HOUR):
    return pd.Timestamp(day, tz="UTC") - pd.Timedelta(days=1) + pd.Timedelta(hours=hour)

def latest_before_cutoff(f, cutoff):
    """For each target hour keep the newest forecast published at or before cutoff."""
    ok = f[f.publishTime <= cutoff]
    return ok.sort_values("publishTime").drop_duplicates("startTime", keep="last")

def day_table(f, a_hourly, day, hour=CUTOFF_HOUR):
    start = pd.Timestamp(day, tz="UTC")
    end = start + pd.Timedelta(days=1)
    f_day = f[(f.startTime >= start) & (f.startTime < end)]
    t = latest_before_cutoff(f_day, cutoff_for(day, hour))
    t = t.rename(columns={"generation": "forecast"})
    t = t.merge(a_hourly, on="startTime", how="left")
    t["error"] = t.forecast - t.actual          # + = over-forecast
    t["horizon_h"] = (t.startTime - t.publishTime).dt.total_seconds() / 3600
    return t.sort_values("startTime").reset_index(drop=True)

def month_table(f, a_hourly, hour=CUTOFF_HOUR):
    days = pd.date_range("2026-01-02", "2026-02-01").strftime("%Y-%m-%d")
    return pd.concat([day_table(f, a_hourly, d, hour) for d in days], ignore_index=True)

def metrics(t):
    e = t.error.dropna()
    return {
        "n": int(len(e)),
        "mae": round(e.abs().mean(), 1),
        "rmse": round((e ** 2).mean() ** 0.5, 1),
        "bias": round(e.mean(), 1),
        "p10": round(e.quantile(0.10), 1),
        "p50": round(e.quantile(0.50), 1),
        "p90": round(e.quantile(0.90), 1),
    }