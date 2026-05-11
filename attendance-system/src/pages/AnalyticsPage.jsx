// src/pages/AnalyticsPage.jsx
import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

export default function AnalyticsPage() {
  const { professor, pin } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState("day");    // day | week | month | semester
  const [mode,    setMode]    = useState("class");  // class | student

  useEffect(() => {
    api.getAttendance(professor.id, pin)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [professor.id, pin]);

  if (loading) return <p style={{ color: "#888", padding: "2rem" }}>Loading analytics…</p>;
  if (!data)   return <p style={{ color: "#d32f2f", padding: "2rem" }}>Could not load data.</p>;

  const { attendance, students } = data;
  const dates = Object.keys(attendance).sort();

  return (
    <div style={{ padding: "1.5rem 0" }}>
      <h2 style={styles.heading}>Analytics</h2>

      <div style={styles.toolbar}>
        <TabGroup tabs={["day","week","month","semester"]} active={view} onChange={setView} />
        <select style={styles.select} value={mode} onChange={e => setMode(e.target.value)}>
          <option value="class">Class overview</option>
          <option value="student">Per student</option>
        </select>
      </div>

      {dates.length === 0 ? (
        <div style={styles.empty}>No attendance data yet. Run a session first.</div>
      ) : mode === "class" ? (
        <ClassView dates={dates} attendance={attendance} students={students} view={view} />
      ) : (
        <StudentView dates={dates} attendance={attendance} students={students} view={view} />
      )}
    </div>
  );
}

// ── Class overview table ──────────────────────────────────────
function ClassView({ dates, attendance, students, view }) {
  const groups = groupDates(dates, view);
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.thead}>
            <Th w={140}>{view.charAt(0).toUpperCase() + view.slice(1)}</Th>
            <Th w={80}>Sessions</Th>
            <Th w={120}>Present / Possible</Th>
            <Th w={80}>Avg %</Th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).reverse().map(([key, ds]) => {
            let tp = 0, tot = 0;
            ds.forEach(d => {
              const rec = attendance[d] || {};
              students.forEach(s => { tot++; if (rec[s.id]) tp++; });
            });
            const pct = tot ? Math.round(tp / tot * 100) : 0;
            return (
              <tr key={key} style={styles.tr}>
                <Td>{key}</Td>
                <Td>{ds.length}</Td>
                <Td>{tp} / {tot}</Td>
                <Td><Badge pct={pct} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Per-student breakdown ─────────────────────────────────────
function StudentView({ dates, attendance, students, view }) {
  const groups = groupDates(dates, view);
  const keys   = Object.keys(groups).reverse().slice(0, 6);
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.thead}>
            <Th w={40}>ID</Th>
            <Th>Name</Th>
            <Th w={90}>Overall</Th>
            {keys.map(k => <Th key={k} w={80}>{k}</Th>)}
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const overall = dates.length
              ? Math.round(dates.filter(d => attendance[d]?.[s.id]).length / dates.length * 100)
              : 0;
            return (
              <tr key={s.id} style={styles.tr}>
                <Td><code style={{ fontSize: 12 }}>{s.id}</code></Td>
                <Td><span style={{ fontWeight: 500 }}>{s.name}</span></Td>
                <Td><Badge pct={overall} /></Td>
                {keys.map(k => {
                  const ds  = groups[k];
                  const prs = ds.filter(d => attendance[d]?.[s.id]).length;
                  const pct = ds.length ? Math.round(prs / ds.length * 100) : 0;
                  return <Td key={k}><Badge pct={pct} small /></Td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function groupDates(dates, view) {
  const g = {};
  dates.forEach(d => {
    let key;
    if (view === "day") {
      key = d;
    } else if (view === "week") {
      const dt  = new Date(d);
      const mon = new Date(dt);
      const day = dt.getDay();
      mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
      key = "Wk " + mon.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } else if (view === "month") {
      key = new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    } else {
      const mo = new Date(d).getMonth();
      key = mo < 6 ? "Sem I" : "Sem II";
    }
    if (!g[key]) g[key] = [];
    g[key].push(d);
  });
  return g;
}

function Badge({ pct, small }) {
  const color = pct >= 75 ? "#34a853" : pct >= 50 ? "#f57c00" : "#ea4335";
  const bg    = pct >= 75 ? "#e8f5e9" : pct >= 50 ? "#fff3e0" : "#fce4ec";
  return (
    <span style={{ background: bg, color, padding: small ? "2px 7px" : "3px 10px",
      borderRadius: 99, fontSize: small ? 11 : 12, fontWeight: 600 }}>
      {pct}%
    </span>
  );
}

function TabGroup({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#f1f3f4", borderRadius: 8, padding: 3 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: "5px 14px", border: "none", borderRadius: 6, cursor: "pointer",
          fontSize: 13, background: active === t ? "#fff" : "transparent",
          color: active === t ? "#1a1a2e" : "#666", fontWeight: active === t ? 600 : 400,
          boxShadow: active === t ? "0 1px 3px rgba(0,0,0,.1)" : "none",
        }}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

function Th({ children, w }) {
  return <th style={{ ...styles.th, ...(w ? { width: w } : {}) }}>{children}</th>;
}
function Td({ children }) {
  return <td style={styles.td}>{children}</td>;
}

const styles = {
  heading:  { fontSize: 20, fontWeight: 600, color: "#1a1a2e", marginBottom: "1rem" },
  toolbar:  { display: "flex", gap: 12, alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" },
  select:   { padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, cursor: "pointer" },
  tableWrap:{ background: "#fff", border: "1px solid #e8eaf6", borderRadius: 14, overflow: "hidden" },
  table:    { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead:    { background: "#f8f9fa" },
  th:       { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", borderBottom: "1px solid #eee" },
  tr:       { borderBottom: "1px solid #f0f0f0" },
  td:       { padding: "9px 12px", color: "#333" },
  empty:    { background: "#fff", border: "1px solid #e8eaf6", borderRadius: 14, padding: "3rem",
    textAlign: "center", color: "#888", fontSize: 14 },
};
