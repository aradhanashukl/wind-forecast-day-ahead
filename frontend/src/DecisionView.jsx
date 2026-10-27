import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useApi } from "./useApi.js";

const DAYS = Array.from({ length: 31 }, (_, i) =>
  new Date(Date.UTC(2026, 0, 2 + i)).toISOString().slice(0, 10));
const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString("en-GB"));
const dayLabel = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
const cutoffLabel = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function Tile({ label, value, unit, hint }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">
        {value} {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function ChartTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div><strong>{p.hour} UTC</strong></div>
      <div>Forecast: {fmt(p.forecast)} MW</div>
      {p.low != null && p.high != null && <div>Likely range: {fmt(p.low)} to {fmt(p.high)} MW</div>}
      <div>Actual (known later): {p.actual == null ? "not available" : `${fmt(p.actual)} MW`}</div>
    </div>
  );
}

export default function DecisionView() {
  const [day, setDay] = useState("2026-01-15");
  const [attempt, setAttempt] = useState(0);
  const raw = useApi(`/api/forecast/${day}`, attempt);
  const state =
    raw.status === "ok" && !(raw.data && Array.isArray(raw.data.rows) && raw.data.rows.length > 0)
      ? { status: "error", message: "No forecast rows were returned for this day." }
      : raw;
  const idx = DAYS.indexOf(day);

  const view = useMemo(() => {
    if (state.status !== "ok") return null;
    const { rows, band } = state.data;
    const chartData = rows.map((r) => {
      const low = r.low == null ? null : Math.max(0, r.low); // wind cannot be negative
      const high = r.high == null ? null : r.high;
      return {
        hour: r.startTime.slice(11, 16),
        forecast: r.forecast,
        actual: r.actual,
        low, high,
        bandBase: low,
        bandSize: low != null && high != null ? Math.max(0, high - low) : null,
        publishTime: r.publishTime,
      };
    });
    const forecasts = rows.map((r) => r.forecast);
    const lows = chartData.map((r) => r.low).filter((x) => x != null);
    const highs = chartData.map((r) => r.high).filter((x) => x != null);
    const lowest = chartData.reduce((a, b) => (b.forecast < a.forecast ? b : a), chartData[0]);
    const missingActuals = rows.filter((r) => r.actual == null).length;
    return { chartData, band, avg: mean(forecasts), avgLow: mean(lows), avgHigh: mean(highs), lowest, missingActuals };
  }, [state]);

  return (
    <>
      <section className="card">
        <div className="picker">
          <label htmlFor="day">Delivery day</label>
          <button onClick={() => setDay(DAYS[idx - 1])} disabled={idx <= 0} aria-label="Previous day">←</button>
          <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
            {DAYS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
          <button onClick={() => setDay(DAYS[idx + 1])} disabled={idx >= DAYS.length - 1} aria-label="Next day">→</button>
        </div>
        {state.status === "ok" && (
          <p className="cutoff">
            Showing the latest forecast published <strong>before {cutoffLabel(state.data.cutoff)}</strong>,
            the decision deadline for this day. Forecasts published later are ignored.
          </p>
        )}
      </section>

      {state.status === "loading" && <div className="card state">Loading forecast…</div>}

      {state.status === "error" && (
        <div className="card state error">
          <p>{state.message}</p>
          <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      )}

      {view && (
        <>
          <div className="tiles">
            <Tile label="Average forecast" value={fmt(view.avg)} unit="MW" hint="Mean over the 24 hours" />
            {view.band ? (
              <Tile
                label="Likely range (average)"
                value={`${fmt(view.avgLow)} to ${fmt(view.avgHigh)}`}
                unit="MW"
                hint="Based on past forecast errors"
              />
            ) : (
              <Tile label="Likely range" value="–" hint="Not enough history yet" />
            )}
            <Tile label="Lowest forecast hour" value={fmt(view.lowest.forecast)} unit="MW" hint={`at ${view.lowest.hour} UTC`} />
          </div>

          <section className="card">
            <h2>Forecast for {dayLabel(day)}, hour by hour</h2>
            {!view.band && (
              <p className="note">
                Not enough earlier results yet to draw a likely range. It needs a day or more of
                past errors first, so the first two days of the period have none. The forecast line is still valid.
              </p>
            )}
            {view.missingActuals > 0 && (
              <p className="note">Actual wind output is not available for {view.missingActuals} hour(s) of this day.</p>
            )}
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={view.chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e6eaef" vertical={false} />
                  <XAxis dataKey="hour" interval={2} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, (max) => Math.max(4000, Math.ceil(max / 4000) * 4000)]} tickCount={5} tick={{ fontSize: 12 }} tickFormatter={(v) => (v / 1000).toFixed(0)} width={36}
                    label={{ value: "GW", angle: -90, position: "insideLeft", offset: 0, fontSize: 12 }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend verticalAlign="top" height={30} />
                  <Area dataKey="bandBase" stackId="band" stroke="none" fill="none" legendType="none"
                    isAnimationActive={false} activeDot={false} />
                  <Area dataKey="bandSize" stackId="band" name="Likely range" legendType="square" stroke="none" fill="#1f6feb"
                    fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
                  <Line dataKey="forecast" name="Forecast (at deadline)" stroke="#1f6feb" strokeWidth={2.5}
                    dot={false} isAnimationActive={false} />
                  <Line dataKey="actual" name="Actual (known only afterwards)" stroke="#e5702a" strokeWidth={2}
                    strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <details>
              <summary>How to read this</summary>
              <p>
                The <strong>blue line</strong> is the newest forecast the buyer could see at the deadline.
                The <strong>shaded range</strong> comes from how far off earlier forecasts were, using only
                results that were already known at the deadline. Tested on January, the actual output landed
                inside it in 83% of hours. The range is deliberately wide and was chosen using January data, 
                so it may hold less well in other months. Treat it as a guide, not a guarantee.
                The <strong>orange dashed line</strong> is what really happened. It is shown for comparison
                and was not available when the decision was made.
              </p>
            </details>

            <details>
              <summary>Show data table</summary>
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Hour (UTC)</th><th>Forecast MW</th><th>Low MW</th><th>High MW</th><th>Actual MW</th><th>Published</th></tr>
                  </thead>
                  <tbody>
                    {view.chartData.map((r) => (
                      <tr key={r.hour}>
                        <td>{r.hour}</td><td>{fmt(r.forecast)}</td><td>{fmt(r.low)}</td>
                        <td>{fmt(r.high)}</td><td>{fmt(r.actual)}</td><td>{r.publishTime.slice(5, 16).replace("T", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </>
      )}
    </>
  );
}
