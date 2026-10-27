import os
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import core

app = FastAPI(title="Wind forecast day-ahead API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["GET"], allow_headers=["*"])

A, F = core.load()
AH = core.hourly_actuals(A)
# Decisions made in January 2026 are for delivery days 2 Jan to 1 Feb.
DAYS = [d.strftime("%Y-%m-%d") for d in pd.date_range("2026-01-02", "2026-02-01")]
MIN_HISTORY = 24  # hours of known past errors needed before we show a band
ISO = "%Y-%m-%dT%H:%M:%SZ"


@lru_cache(maxsize=24)
def month(hour):
    return core.month_table(F, AH, hour)


def check_day(day):
    if day not in DAYS:
        raise HTTPException(400, "day must be YYYY-MM-DD from 2026-01-02 to 2026-02-01")


def num(x):
    return None if pd.isna(x) else float(x)


@app.get("/api/forecast/{day}")
def forecast(day: str, cutoff_hour: int = Query(9, ge=0, le=23)):
    check_day(day)
    cutoff = core.cutoff_for(day, cutoff_hour)
    t = core.day_table(F, AH, day, cutoff_hour)

    # Only hours whose actual was fully known before the cutoff
    hist = month(cutoff_hour)
    hist = hist[hist.startTime < cutoff - pd.Timedelta(hours=1)].dropna(subset=["error"])
    band = None
    if len(hist) >= MIN_HISTORY:
        band = {"based_on_hours": int(len(hist)),
                "p05_error": float(hist.error.quantile(0.05)),
                "p95_error": float(hist.error.quantile(0.95))}

    rows = []
    for r in t.itertuples():
        rows.append({
            "startTime": r.startTime.strftime(ISO),
            "publishTime": r.publishTime.strftime(ISO),
            "forecast": float(r.forecast),
            "actual": num(r.actual),
            "low": float(r.forecast - band["p95_error"]) if band else None,
            "high": float(r.forecast - band["p05_error"]) if band else None,
        })
    return {"day": day, "cutoff": cutoff.strftime(ISO), "band": band, "rows": rows}


@app.get("/api/accuracy")
def accuracy(start: str = "2026-01-02", end: str = "2026-02-01",
             cutoff_hour: int = Query(9, ge=0, le=23)):
    check_day(start)
    check_day(end)
    t = month(cutoff_hour)
    lo = pd.Timestamp(start, tz="UTC")
    hi = pd.Timestamp(end, tz="UTC") + pd.Timedelta(days=1)
    t = t[(t.startTime >= lo) & (t.startTime < hi)].dropna(subset=["error"])
    if t.empty:
        raise HTTPException(400, "no data in that range")

    agg = dict(mae=lambda s: s.abs().mean(), bias="mean")
    by_hour = t.groupby(t.startTime.dt.hour).error.agg(**agg)
    by_day = t.groupby(t.startTime.dt.strftime("%Y-%m-%d")).error.agg(**agg)
    bins = pd.cut(t.horizon_h, [12, 18, 24, 30, 36, 42])
    by_hor = t.groupby(bins, observed=True).error.agg(n="size", **agg)
    lo_edge = np.floor(t.error.min() / 1000) * 1000
    n_bins = int(np.floor((t.error.max() - lo_edge) / 1000)) + 1
    counts, edges = np.histogram(t.error, bins=lo_edge + 1000 * np.arange(n_bins + 1))
    histogram = [{"from": float(a), "to": float(b), "n": int(c)}
                 for a, b, c in zip(edges[:-1], edges[1:], counts)]

    return {
        "summary": {k: float(v) for k, v in core.metrics(t).items()},
        "over_share": float((t.error > 0).mean()),
        "histogram": histogram,
        "by_hour": [{"hour": int(h), "mae": float(r.mae), "bias": float(r.bias)}
                    for h, r in by_hour.iterrows()],
        "by_day": [{"day": d, "mae": float(r.mae), "bias": float(r.bias)}
                   for d, r in by_day.iterrows()],
        "by_horizon": [{"range": f"{int(i.left)}-{int(i.right)}h", "n": int(r.n),
                        "mae": float(r.mae), "bias": float(r.bias)}
                       for i, r in by_hor.iterrows()],
    }


# Serve the built React website. This MUST stay at the very bottom,
# after all the /api routes, otherwise it would swallow them.
if os.path.isdir("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")