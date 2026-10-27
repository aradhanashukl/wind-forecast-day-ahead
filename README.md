# Day-ahead wind forecast and accuracy tool

A web app for a GB energy buyer who purchases power on the day-ahead market. It answers two questions:

1. **What is the latest wind forecast I could see at the moment I had to decide?**
2. **How accurate have those forecasts been, in numbers, so I can allow for the error?**

Data: national (Great Britain) wind only, from Elexon. Scope: purchase decisions made in **January 2026**, which means delivery days **2 Jan to 1 Feb 2026** (a decision is made the day before delivery).

**Live app:** `https://wind-forecast-day-ahead.vercel.app/`

## How it works

For each delivery day, the buyer's decision deadline is **09:00 UTC on the day before**. For every hour of the delivery day, the app takes the **newest forecast published at or before that deadline**. Forecasts published later are ignored, because the buyer could not have seen them.

That forecast is then compared with the actual wind output:

- error = forecast − actual (positive means the forecast was too high)
- the app reports MAE, RMSE, bias and the 10th, 50th and 90th percentiles of the error
- the "likely range" on the Decision screen is the forecast shifted by the 5th and 95th percentile of **past** errors. It only uses hours whose actual output was already known at the deadline, so nothing from the future leaks in.

### Screens

- **Decision:** pick a delivery day. Shows the forecast available at the deadline, the likely range, and the actual output (known only afterwards) for comparison.
- **Accuracy:** headline numbers for the whole period, and error by hour of day, by day, and as a distribution.

## Results (2 Jan to 1 Feb 2026, 744 hours)

| Measure | Value |
|---|---|
| Typical miss (MAE) | 2,039 MW |
| RMSE | 2,505 MW |
| Bias | +1,748 MW (forecast too high) |
| Hours where forecast was too high | 85% |
| Likely range: actual inside it | 83% of 696 hours (9% below, 8% above) |

The first two days have no range, because there are not enough earlier results to learn from.

## Data and design

- Actuals: Elexon `FUELHH`, fuel type `WIND`, half-hourly.
- Forecasts: Elexon `WINDFOR`, hourly, many forecasts per target hour, each with a `publishTime`.
- Data is downloaded once by `backend/ingest.py` and stored as CSV in `backend/data/`, so the app has no live dependency on the Elexon API.
- Backend: Python, FastAPI, pandas. The selection rule and statistics are in `backend/core.py`.
- Frontend: React (Vite) with Recharts.
- Docker: one image builds the React app and serves it together with the API.

## Assumptions

- **Decision deadline: 09:00 UTC on the day before delivery.** This is our assumption, not a confirmed fact. Public exchange notices put the main GB day-ahead auction closes at roughly 09:20 to 09:50, but those sources are dated 2020/2021 and should be checked. The deadline is configurable (`cutoff_hour` on the API). Sensitivity: re-running `backend/sensitivity.py` with cutoffs from 06:00 to 12:00 UTC on the same 744 hours gave the results below. MAE stayed between 1,901 and 2,039 MW, and the forecast was too high in every case.

  | Cutoff (UTC) | MAE (MW) | Bias (MW) |
  |---|---|---|
  | 06:00 | 2,016.1 | +1,671.0 |
  | 08:00 | 2,038.9 | +1,747.9 |
  | 09:00 (used) | 2,038.9 | +1,747.9 |
  | 10:00 | 2,013.0 | +1,729.9 |
  | 12:00 | 1,901.0 | +1,687.2 |

- **Time zone:** Elexon times are UTC. In January UK time equals UTC, so no conversion is applied.
- **Hourly comparison:** forecasts are hourly and actuals half-hourly, so each pair of half-hour actuals is averaged into one hourly value.
- **A forecast published exactly at the deadline is allowed.**
- **Likely range:** P5 to P95 of past errors was chosen after comparing alternatives on the January data (P10 to P90 gave 74% coverage). It is therefore tuned on this month and has not been tested on other months.

## Limitations

- One month of data, and errors within a day move together, so the accuracy figures and the range are rough guides, not guarantees.
- The forecast was too high in most hours. We measured this but have **not established why**: it could be a real forecast weakness or a difference in what the two datasets measure.
- Wind only, national level. There is no demand or price data, so the app shows wind availability and its uncertainty, not how much to buy.

## Run it locally

Requires Docker.

```
docker compose up --build
```

Then open http://localhost:8000.

### Tests and scripts

```
cd backend
pip install -r requirements.txt
pytest
```

Other scripts in `backend/` (`explore.py`, `check.py`, `check_band.py`, `diagnose.py`, `sensitivity.py`) were used to explore the data and check results. They are not part of the app. To refresh the data, run `python ingest.py` inside `backend/`.

## Project layout

```
backend/    API, calculation logic, data, tests
frontend/   React app
Dockerfile, docker-compose.yml
```

## Use of AI tools

AI tools were used to build this project, as the assignment allows:

- **Claude (Anthropic):** used to understand the problem and the data and to interpret the results.
- **Cursor:** used to plan the design and structure of project.

I ran the code and the tests myself and checked the outputs.