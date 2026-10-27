import core

a, f = core.load()
ah = core.hourly_actuals(a)
for h in (6, 8, 9, 10, 12):
    t = core.month_table(f, ah, h)
    m = core.metrics(t)
    print("cutoff", h, ":00 | hours", m["n"], "| MAE", m["mae"], "| bias", m["bias"])