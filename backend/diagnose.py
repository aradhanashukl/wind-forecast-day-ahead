import core, pandas as pd

a, f = core.load()
ah = core.hourly_actuals(a)
t = core.month_table(f, ah)

print("mean forecast:", round(t.forecast.mean()), "| mean actual:", round(t.actual.mean()))

print("\nbias by day (first 10 days):")
print(t.groupby(t.startTime.dt.date).error.mean().round(0).head(10))

print("\nbias by hour of day:")
print(t.groupby(t.startTime.dt.hour).error.mean().round(0))

# Test 1: is the bias there even for the newest-ever forecast (ignoring the cutoff)?
best = f.sort_values("publishTime").drop_duplicates("startTime", keep="last").merge(ah, on="startTime")
best = best[(best.startTime >= "2026-01-01") & (best.startTime < "2026-02-01")]
print("\nbias of newest-ever forecast:", round((best.generation - best.actual).mean()))

# Test 2: is the time alignment right? Shift actuals by 1 hour each way
for s in (-1, 0, 1):
    sh = ah.assign(startTime=ah.startTime + pd.Timedelta(hours=s))
    m = t.drop(columns="actual").merge(sh, on="startTime")
    print(f"MAE with actuals shifted {s:+d}h:", round((m.forecast - m.actual).abs().mean()))