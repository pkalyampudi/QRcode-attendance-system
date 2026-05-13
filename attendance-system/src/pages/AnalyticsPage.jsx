// src/pages/AnalyticsPage.jsx
import { useState, useEffect } from "react";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

export default function AnalyticsPage() {
  const { professor, pin } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState("day");
  const [mode,    setMode]    = useState("class");

  useEffect(() => {
    api.getAttendance(professor.id, pin)
      .then(d => setData(d)).catch(() => {})
      .finally(() => setLoading(false));
  }, [professor.id, pin]);

  if (loading) return (
    <div style={S.loadingWrap}>
      <div style={S.spinner} />
      <p style={S.loadingText}>Loading analytics…</p>
    </div>
  );

  if (!data) return <div style={S.error}>Could not load data. Please refresh.</div>;

  const { attendance, students } = data;
  const dates = Object.keys(attendance).sort();
  const totalSessions = dates.length;

  // Overall stats
  let totalPresent = 0, totalPossible = 0;
  dates.forEach(d => {
    students.forEach(s => { totalPossible++; if (attendance[d]?.[s.id]) totalPresent++; });
  });
  const overallPct = totalPossible ? Math.round(totalPresent / totalPossible * 100) : 0;
  const atRisk = students.filter(s => {
    const pres = dates.filter(d => attendance[d]?.[s.id]).length;
    return dates.length > 0 && Math.round(pres / dates.length * 100) < 75;
  });

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.pageTitle}>Analytics</h2>
          <p style={S.pageSub}>{totalSessions} sessions recorded</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={S.summaryGrid}>
        <SummaryCard icon="📅" label="Total sessions" value={totalSessions} color="#1a73e8" bg="#e8f0fe" />
        <SummaryCard icon="👥" label="Students" value={students.length} color="#7c3aed" bg="#f5f3ff" />
        <SummaryCard icon="✅" label="Overall attendance" value={overallPct + "%"}
          color={overallPct >= 75 ? "#34a853" : overallPct >= 50 ? "#f59e0b" : "#ea4335"}
          bg={overallPct >= 75 ? "#e8f5e9" : overallPct >= 50 ? "#fffbeb" : "#fce8e6"} />
        <SummaryCard icon="⚠️" label="At risk (<75%)" value={atRisk.length} color="#ea4335" bg="#fce8e6" />
      </div>

      {/* At-risk alert */}
      {atRisk.length > 0 && (
        <div style={S.atRiskBanner}>
          <span style={S.atRiskIcon}>⚠️</span>
          <div>
            <strong>{atRisk.length} student{atRisk.length > 1 ? "s" : ""} below 75% attendance:</strong>{" "}
            {atRisk.map(s => s.name).join(", ")}
          </div>
        </div>
      )}

      {dates.length === 0 ? (
        <div style={S.emptyCard}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <h3 style={S.emptyTitle}>No data yet</h3>
          <p style={S.emptySub}>Take your first attendance session to see analytics here.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div style={S.controls}>
            <div style={S.tabGroup}>
              {["day","week","month","semester"].map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ ...S.tab, ...(view === v ? S.tabActive : {}) }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <select style={S.select} value={mode} onChange={e => setMode(e.target.value)}>
              <option value="class">Class overview</option>
              <option value="student">Per student</option>
            </select>
          </div>

          {/* Table */}
          <div style={S.tableCard}>
            {mode === "class"
              ? <ClassView dates={dates} attendance={attendance} students={students} view={view} />
              : <StudentView dates={dates} attendance={attendance} students={students} view={view} />
            }
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ ...S.summaryCard, background: bg }} className="fade-in">
      <span style={S.summaryIcon}>{icon}</span>
      <div style={{ ...S.summaryValue, color }}>{value}</div>
      <div style={S.summaryLabel}>{label}</div>
    </div>
  );
}

function ClassView({ dates, attendance, students, view }) {
  const groups = groupDates(dates, view);
  return (
    <table style={S.table}>
      <thead>
        <tr style={S.thead}>
          <Th>{view.charAt(0).toUpperCase() + view.slice(1)}</Th>
          <Th w={90}>Sessions</Th>
          <Th w={140}>Present / Total</Th>
          <Th w={90}>Rate</Th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(groups).reverse().map(([key, ds]) => {
          let tp = 0, tot = 0;
          ds.forEach(d => { const rec = attendance[d]||{}; students.forEach(s => { tot++; if (rec[s.id]) tp++; }); });
          const pct = tot ? Math.round(tp / tot * 100) : 0;
          return (
            <tr key={key} style={S.tr}>
              <Td><strong>{key}</strong></Td>
              <Td>{ds.length}</Td>
              <Td>{tp} / {tot}</Td>
              <Td><Badge pct={pct} /></Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StudentView({ dates, attendance, students, view }) {
  const groups = groupDates(dates, view);
  const keys   = Object.keys(groups).reverse().slice(0, 5);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead>
          <tr style={S.thead}>
            <Th w={40}>ID</Th>
            <Th>Name</Th>
            <Th w={90}>Overall</Th>
            {keys.map(k => <Th key={k} w={90}>{k}</Th>)}
          </tr>
        </thead>
        <tbody>
          {students.map(s => {
            const overall = dates.length
              ? Math.round(dates.filter(d => attendance[d]?.[s.id]).length / dates.length * 100) : 0;
            return (
              <tr key={s.id} style={S.tr}>
                <Td><code style={S.idCode}>{s.id}</code></Td>
                <Td>
                  <div style={S.studentRow}>
                    <div style={S.studentAvatar}>
                      {s.name.charAt(0)}
                    </div>
                    <span style={S.studentName}>{s.name}</span>
                  </div>
                </Td>
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

function Badge({ pct, small }) {
  const color = pct >= 75 ? "#34a853" : pct >= 50 ? "#f59e0b" : "#ea4335";
  const bg    = pct >= 75 ? "#e8f5e9" : pct >= 50 ? "#fffbeb" : "#fce8e6";
  const label = pct >= 75 ? "Good" : pct >= 50 ? "Low" : "At risk";
  return (
    <span style={{ background: bg, color, padding: small ? "3px 8px" : "4px 12px",
      borderRadius: 99, fontSize: small ? 11 : 13, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 4 }}>
      {!small && (pct >= 75 ? "✓ " : pct >= 50 ? "↓ " : "⚠ ")}{pct}%
    </span>
  );
}

function groupDates(dates, view) {
  const g = {};
  dates.forEach(d => {
    let key;
    if (view === "day") { key = d; }
    else if (view === "week") {
      const dt = new Date(d); const mon = new Date(dt);
      const day = dt.getDay(); mon.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
      key = "Wk " + mon.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    } else if (view === "month") {
      key = new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    } else {
      key = new Date(d).getMonth() < 6 ? "Sem I" : "Sem II";
    }
    if (!g[key]) g[key] = [];
    g[key].push(d);
  });
  return g;
}

function Th({ children, w }) {
  return <th style={{ ...S.th, ...(w ? { width: w } : {}) }}>{children}</th>;
}
function Td({ children }) { return <td style={S.td}>{children}</td>; }

const S = {
  page:           { padding: 0 },
  pageHeader:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  pageTitle:      { fontSize: 24, fontWeight: 700, color: "#1e293b" },
  pageSub:        { fontSize: 14, color: "#64748b", marginTop: 2 },
  loadingWrap:    { padding: "4rem", textAlign: "center" },
  spinner:        { width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#1a73e8",
                    borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" },
  loadingText:    { color: "#64748b", fontSize: 15 },
  error:          { padding: "2rem", color: "#dc2626", fontSize: 15 },
  summaryGrid:    { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 },
  summaryCard:    { borderRadius: 16, padding: "18px 16px", textAlign: "center" },
  summaryIcon:    { fontSize: 24, display: "block", marginBottom: 8 },
  summaryValue:   { fontSize: 28, fontWeight: 800, marginBottom: 4 },
  summaryLabel:   { fontSize: 12, color: "#64748b", fontWeight: 600 },
  atRiskBanner:   { display: "flex", gap: 12, background: "#fef3cd", border: "1px solid #fde68a",
                    borderRadius: 14, padding: "14px 16px", marginBottom: 16,
                    fontSize: 14, color: "#92400e", lineHeight: 1.5 },
  atRiskIcon:     { fontSize: 20, flexShrink: 0 },
  emptyCard:      { background: "#fff", borderRadius: 20, padding: "4rem 2rem",
                    textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  emptyTitle:     { fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 8 },
  emptySub:       { fontSize: 14, color: "#64748b" },
  controls:       { display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" },
  tabGroup:       { display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4 },
  tab:            { padding: "7px 16px", border: "none", borderRadius: 8, cursor: "pointer",
                    fontSize: 13, background: "transparent", color: "#64748b",
                    fontWeight: 500, transition: "all .15s" },
  tabActive:      { background: "#fff", color: "#1a73e8", fontWeight: 700,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  select:         { padding: "8px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
                    fontSize: 13, cursor: "pointer", background: "#fff", fontFamily: "inherit" },
  tableCard:      { background: "#fff", borderRadius: 20, overflow: "hidden",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  table:          { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead:          { background: "#f8fafc" },
  th:             { padding: "12px 16px", textAlign: "left", fontWeight: 700, fontSize: 11,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    color: "#94a3b8", borderBottom: "1px solid #f1f5f9" },
  tr:             { borderBottom: "1px solid #f8fafc", transition: "background .1s" },
  td:             { padding: "12px 16px", color: "#334155", verticalAlign: "middle" },
  idCode:         { background: "#f1f5f9", padding: "2px 8px", borderRadius: 6,
                    fontSize: 11, fontFamily: "monospace", color: "#64748b" },
  studentRow:     { display: "flex", alignItems: "center", gap: 10 },
  studentAvatar:  { width: 30, height: 30, borderRadius: "50%", background: "#e8f0fe",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "#1a73e8", flexShrink: 0 },
  studentName:    { fontWeight: 600, color: "#1e293b" },
};
