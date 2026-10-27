import { useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useApi } from "./useApi.js";

const BLUE = "#1f6feb";
const ORANGE = "#e5702a";

const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString("en-GB"));
const signed = (n) => (n == null || Number.isNaN(n) ? "–" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("en-GB")}`);
const shortDay = (d) => String(Number(d.slice(8, 10)));

function Tile({ label, value, unit, hint }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value} {unit && <span className="unit">{unit}</span>}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, note, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">{note}</p>
      <div className="chart short">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </section>
  );
}

const gw = (v) => (v / 1000).toFixed(0);
const axisLabel = { value: "GW", angle: -90, position: "insideLeft", offset: 12, fontSize: 12 };

function ValidTip({ active, payload, label, labelPrefix = "", unit = "MW" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tip">
      <div><strong>{labelPrefix}{label}</strong></div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey}>{p.name}: {signed(p.value)} {unit}</div>
      ))}
    </div>
  );
}

function HistTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <div><strong>{signed(p.from)} to {signed(p.to)} MW</strong></div>
      <div>{p.n} hours</div>
    </div>
  );
}

export default function AccuracyView() {
  const [attempt, setAttempt] = useState(0);
  const state = useApi("/api/accuracy", attempt);

  if (state.status === "loading") return <div className="card state">Loading accuracy results…</div>;
  if (state.status === "error") {
    return (
      <div className="card state error">
        <p>{state.message}</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
      </div>
    );
  }

  const d = state.data;
  const ok = d && d.summary && Array.isArray(d.by_hour) && Array.isArray(d.by_day) && Array.isArray(d.histogram);
  if (!ok) {
    return (
      <div className="card state error">
        <p>The accuracy data came back in an unexpected shape.</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Try again</button>
      </div>
    );
  }

  const s = d.summary;
  const over = d.over_share == null ? null : Math.round(d.over_share * 100);
  const direction = s.bias >= 0 ? "above" : "below";
  const hours = d.by_hour.map((r) => ({ ...r, label: `${String(r.hour).padStart(2, "0")}:00` }));
  const days = d.by_day.map((r) => ({ ...r, label: shortDay(r.day) }));

  return (
    <>
      <section className="card">
        <p className="headline">
          Across January 2026, the forecast averaged <strong>{fmt(Math.abs(s.bias))} MW {direction}</strong> actual
          wind output{over != null && <> and was too high in <strong>{over}% of hours</strong></>}.
          A typical miss was <strong>{fmt(s.mae)} MW</strong>. A buyer who wants to be covered should
          plan with a margin below the raw forecast.
        </p>
        <div className="tiles tight">
          <Tile label="Typical miss (MAE)" value={fmt(s.mae)} unit="MW" hint="Average size of the error" />
          <Tile label="Big misses (RMSE)" value={fmt(s.rmse)} unit="MW" hint="Counts large errors more" />
          <Tile label="Bias" value={signed(s.bias)} unit="MW" hint="Positive = forecast too high" />
          <Tile label="Median error (P50)" value={signed(s.p50)} unit="MW" hint="Half of hours were above this" />
          <Tile label="Range of 80% of errors" value={`${signed(s.p10)} to ${signed(s.p90)}`}
            hint="MW, from P10 to P90" />
          <Tile label="Hours analysed" value={fmt(s.n)} hint="31 days × 24 hours" />
        </div>
        <p className="muted">Error = forecast − actual. All numbers use the forecast the buyer could see at the deadline.</p>
      </section>

      <ChartCard title="Error by hour of day" note="Average miss (MAE) and bias for each hour of the delivery day. Taller bars mean a worse hour.">
        <BarChart data={hours} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#e6eaef" vertical={false} />
          <XAxis dataKey="label" interval={2} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={gw} width={36} label={axisLabel} />
          <Tooltip content={<ValidTip />} />
          <Legend verticalAlign="top" height={30} />
          <Bar dataKey="mae" name="Typical miss (MAE)" fill={BLUE} isAnimationActive={false} />
          <Bar dataKey="bias" name="Bias" fill={ORANGE} isAnimationActive={false} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Error by day" note="Bias for each day (bars: blue = forecast too high, orange = too low) and the typical miss (line). A few bad days drive much of the average.">
        <ComposedChart data={days} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#e6eaef" vertical={false} />
          <XAxis dataKey="label" interval={1} tick={{ fontSize: 12 }}
            label={{ value: "Day of January", position: "insideBottom", offset: -2, fontSize: 12 }} height={40} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={gw} width={36} label={axisLabel} />
          <Tooltip content={<ValidTip labelPrefix="Jan " />} />
          <Legend verticalAlign="top" height={30} />
          <ReferenceLine y={0} stroke="#8a97a6" />
          <Bar dataKey="bias" name="Bias" fill={BLUE} isAnimationActive={false}>
            {days.map((r) => <Cell key={r.day} fill={r.bias >= 0 ? BLUE : ORANGE} />)}
          </Bar>
          <Line dataKey="mae" name="Typical miss (MAE)" stroke="#1b2430" strokeWidth={2} dot={false}
            isAnimationActive={false} />
        </ComposedChart>
      </ChartCard>

      <ChartCard title="How big were the errors?" note="Number of hours at each error size. Blue bars are hours where the forecast was too high, orange bars where it was too low.">
        <BarChart data={d.histogram.map((b) => ({ ...b, label: signed(b.from / 1000) }))}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#e6eaef" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }}
            label={{ value: "Error, GW (start of each 1 GW bucket)", position: "insideBottom", offset: -2, fontSize: 12 }}
            height={40} />
          <YAxis tick={{ fontSize: 12 }} width={36} allowDecimals={false}
            label={{ value: "Hours", angle: -90, position: "insideLeft", offset: 12, fontSize: 12 }} />
          <Tooltip content={<HistTip />} />
          <Bar dataKey="n" isAnimationActive={false}>
            {d.histogram.map((b) => <Cell key={b.from} fill={b.from >= 0 ? BLUE : ORANGE} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <section className="card">
        <h2>Method and limits, in plain English</h2>
        <details>
          <summary>What data and what rule?</summary>
          <p>
            Forecasts are the Elexon wind forecast (WINDFOR). Actuals are Elexon metered wind output (FUELHH). Both are
            national, Great Britain wide. For each delivery day we use, for every hour, the newest forecast published
            before 09:00 UTC on the day before. The 09:00 deadline is our working assumption and has not yet been
            checked against the real auction timing.
          </p>
        </details>
        <details>
          <summary>What do the numbers mean?</summary>
          <p>
            Error is forecast minus actual, so positive means the forecast was too high. MAE is the average size of the
            error. RMSE is similar but punishes big misses more. Bias is the average error. P10, P50 and P90 are the
            error sizes that 10%, 50% and 90% of hours stayed below.
          </p>
        </details>
        <details>
          <summary>How is the likely range on the Decision screen made?</summary>
          <p>
            It is the forecast shifted by the 5th and 95th percentile of past errors, chosen using January results. Only hours whose actual output
            was already known at the deadline are used, so nothing from the future leaks in.
          </p>
        </details>
        <details>
          <summary>What should I be careful about?</summary>
          <p>
            There are only 31 days of evidence, and errors within one day move together, so the range is a rough guide,
            not a guarantee. The forecast was too high in most hours, and we have not established why: it could be a real
            forecast weakness or a difference in what the two datasets measure. Forecasts are hourly and actuals are
            half-hourly, so each pair of half-hours is averaged. Because every forecast is taken at one fixed deadline,
            how far ahead it was made is almost fully set by the hour of the day, so a separate chart by horizon would
            repeat the hour-of-day chart.
          </p>
        </details>
      </section>
    </>
  );
}