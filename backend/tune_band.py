import core, pandas as pd

a, f = core.load()
ah = core.hourly_actuals(a)
t = core.month_table(f, ah)
days = pd.date_range("2026-01-02", "2026-02-01").strftime("%Y-%m-%d")

def test_band(lo_q, hi_q, window_days=None, min_hours=24):
    inside = total = width = 0
    for d in days:
        cutoff = core.cutoff_for(d)
        hist = t[t.startTime < cutoff - pd.Timedelta(hours=1)].dropna(subset=["error"])
        if window_days:
            hist = hist[hist.startTime >= cutoff - pd.Timedelta(days=window_days)]
        if len(hist) < min_hours:
            continue
        lo, hi = hist.error.quantile(lo_q), hist.error.quantile(hi_q)
        start = pd.Timestamp(d, tz="UTC")
        day = t[(t.startTime >= start) & (t.startTime < start + pd.Timedelta(days=1))].dropna(subset=["error"])
        inside += ((day.error >= lo) & (day.error <= hi)).sum()
        total += len(day)
        width += (hi - lo) * len(day)
    return inside / total, width / total, total

print("band            window   hit rate   avg width (MW)   hours")
for lo_q, hi_q in [(0.10, 0.90), (0.075, 0.925), (0.05, 0.95)]:
    for w in [None, 14, 7]:
        hit, wid, n = test_band(lo_q, hi_q, w)
        print(f"P{lo_q*100:g}-P{hi_q*100:g}".ljust(16), str(w or "all").ljust(8),
              f"{hit:.0%}".ljust(10), f"{wid:,.0f}".ljust(16), n)