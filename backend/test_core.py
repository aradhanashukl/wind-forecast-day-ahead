import pandas as pd
import core

def ts(s):
    return pd.Timestamp(s, tz="UTC")

def forecasts():
    return pd.DataFrame({
        "startTime": [ts("2026-01-15 12:00")] * 4,
        "publishTime": [ts("2026-01-13 18:00"), ts("2026-01-14 08:30"),
                        ts("2026-01-14 12:00"), ts("2026-01-15 06:00")],
        "generation": [6800, 6200, 5700, 5500],
    })

def actuals():
    return pd.DataFrame({"startTime": [ts("2026-01-15 12:00")], "actual": [5400.0]})

def test_picks_latest_before_cutoff():
    t = core.day_table(forecasts(), actuals(), "2026-01-15")
    assert t.forecast.iloc[0] == 6200

def test_forecast_exactly_at_cutoff_is_allowed():
    f = forecasts()
    f.loc[1, "publishTime"] = core.cutoff_for("2026-01-15")
    assert core.day_table(f, actuals(), "2026-01-15").forecast.iloc[0] == 6200

def test_later_forecasts_are_ignored():
    f = forecasts().iloc[[2, 3]]          # both published after the cutoff
    assert core.day_table(f, actuals(), "2026-01-15").empty

def test_error_is_forecast_minus_actual():
    t = core.day_table(forecasts(), actuals(), "2026-01-15")
    assert t.error.iloc[0] == 800

def test_hourly_actuals_average_two_half_hours():
    a = pd.DataFrame({"startTime": [ts("2026-01-15 12:00"), ts("2026-01-15 12:30")],
                      "generation": [100, 200]})
    assert core.hourly_actuals(a).actual.iloc[0] == 150

def test_missing_actual_gives_nan_error_and_is_skipped_in_metrics():
    f = pd.DataFrame({
        "startTime": [ts("2026-01-15 00:00"), ts("2026-01-15 01:00")],
        "publishTime": [ts("2026-01-14 07:30"), ts("2026-01-14 07:30")],
        "generation": [1000.0, 2000.0],
    })
    a_hourly = pd.DataFrame({"startTime": [ts("2026-01-15 00:00")], "actual": [800.0]})  # no actual at 01:00
    t = core.day_table(f, a_hourly, "2026-01-15")
    assert len(t) == 2                    # the hour is kept, so the buyer still sees the forecast
    assert t.error.iloc[0] == 200.0
    assert pd.isna(t.error.iloc[1])       # but it has no error
    m = core.metrics(t)
    assert m["n"] == 1                    # and it is skipped in the statistics
    assert m["mae"] == 200.0

def test_load_works_from_any_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)           # somewhere with no data folder
    a, f = core.load()
    assert len(a) > 0 and len(f) > 0