import { useState } from "react";
import DecisionView from "./DecisionView.jsx";
import AccuracyView from "./AccuracyView.jsx";

const TABS = [
  { id: "decision", label: "Decision" },
  { id: "accuracy", label: "Accuracy" },
];

export default function App() {
  const [tab, setTab] = useState("decision");
  return (
    <div className="page">
      <header>
        <h1>Day-ahead wind forecast</h1>
        <p className="sub">Great Britain, national wind. Decisions for January 2026.</p>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "decision" ? <DecisionView /> : <AccuracyView />}
    </div>
  );
}