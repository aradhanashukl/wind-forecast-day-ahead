import math
from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_every_day_returns_24_clean_rows():
    for day in main.DAYS:
        r = client.get(f"/api/forecast/{day}")
        assert r.status_code == 200, day
        rows = r.json()["rows"]
        assert len(rows) == 24, day
        for row in rows:
            assert row["forecast"] is not None and not math.isnan(row["forecast"])


def test_first_day_has_no_band():
    body = client.get("/api/forecast/2026-01-02").json()
    assert body["band"] is None


def test_band_grows_with_history_only_from_the_past():
    sizes = []
    for day in main.DAYS[1:]:
        band = client.get(f"/api/forecast/{day}").json()["band"]
        if band:
            sizes.append(band["based_on_hours"])
    assert sizes == sorted(sizes)  # more history each day, never less


def test_bad_day_is_rejected():
    assert client.get("/api/forecast/2026-02-05").status_code == 400


def test_accuracy_works():
    r = client.get("/api/accuracy")
    assert r.status_code == 200
    assert r.json()["summary"]["n"] == 744

def test_accuracy_histogram_and_share():
    body = client.get("/api/accuracy").json()
    assert sum(b["n"] for b in body["histogram"]) == 744
    assert 0 <= body["over_share"] <= 1

def test_window_is_decisions_made_in_january():
    assert main.DAYS[0] == "2026-01-02" and main.DAYS[-1] == "2026-02-01"
    assert client.get("/api/forecast/2026-01-01").status_code == 400
    assert client.get("/api/forecast/2026-02-01").status_code == 200