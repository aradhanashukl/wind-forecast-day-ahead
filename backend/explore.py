import requests, pandas as pd

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

a = requests.get(f"{BASE}/FUELHH/stream", params={
    "settlementDateFrom": "2026-01-10", "settlementDateTo": "2026-01-11",
    "fuelType": "WIND"}, timeout=60).json()
f = requests.get(f"{BASE}/WINDFOR/stream", params={
    "publishDateTimeFrom": "2026-01-09T00:00:00Z",
    "publishDateTimeTo": "2026-01-10T23:59:59Z"}, timeout=60).json()

A, F = pd.DataFrame(a), pd.DataFrame(f)
print(A.columns.tolist(), F.columns.tolist())
print(A.head(), F.head(), sep="\n\n")
print("rows:", len(A), len(F))
print(F.groupby("startTime").size().describe())