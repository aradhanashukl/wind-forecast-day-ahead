import core

a, f = core.load()
t = core.month_table(f, core.hourly_actuals(a))

print("hours with a usable forecast:", len(t), "(expected 744)")
print("hours missing an actual:", int(t.actual.isna().sum()))
print("overall metrics:", core.metrics(t))
print("forecast age at decision (hours ahead): min", round(t.horizon_h.min(), 1),
      "max", round(t.horizon_h.max(), 1))

print("\nExample: 15 Jan 2026, 12:00")
row = t[t.startTime == "2026-01-15 12:00"].iloc[0]
print("cutoff:", core.cutoff_for("2026-01-15"))
print(row[["publishTime", "forecast", "actual", "error"]])