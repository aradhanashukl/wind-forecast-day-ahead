import requests, pandas as pd
from datetime import date, timedelta
from pathlib import Path

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

def get(path, params):
    r = requests.get(f"{BASE}/{path}/stream", params=params, timeout=120)
    r.raise_for_status()
    return r.json()

def chunks(start, end, days=7):
    d = start
    while d <= end:
        yield d, min(d + timedelta(days=days - 1), end)
        d += timedelta(days=days)

actuals, forecasts = [], []
# Actuals: only January 2026
for a, b in chunks(date(2026, 1, 2), date(2026, 2, 1)):
    actuals += get("FUELHH", {"settlementDateFrom": a.isoformat(),
                              "settlementDateTo": b.isoformat(), "fuelType": "WIND"})
# Forecasts: start in late December, because January targets are forecast days earlier
for a, b in chunks(date(2025, 12, 25), date(2026, 1, 31)):
    forecasts += get("WINDFOR", {"publishDateTimeFrom": f"{a}T00:00:00Z",
                                 "publishDateTimeTo": f"{b}T23:59:59Z"})

A = pd.DataFrame(actuals)[["startTime", "generation"]].drop_duplicates()
F = pd.DataFrame(forecasts)[["startTime", "publishTime", "generation"]].drop_duplicates()

Path("data").mkdir(exist_ok=True)
A.to_csv("data/actuals.csv", index=False)
F.to_csv("data/forecasts.csv", index=False)

print("actuals rows:", len(A), "(expected", 31 * 48, ")")
print("forecast rows:", len(F), "| distinct publish times:", F.publishTime.nunique())
print("forecast minutes past the hour:", sorted(set(pd.to_datetime(F.startTime).dt.minute)))
print("forecast targets from", F.startTime.min(), "to", F.startTime.max())