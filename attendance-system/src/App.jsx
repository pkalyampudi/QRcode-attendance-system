// src/App.jsx
import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage    from "./pages/LoginPage";
import SessionPage  from "./pages/SessionPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StudentsPage  from "./pages/StudentsPage";
import ScanPage     from "./pages/ScanPage";

// Route /scan directly to student scan page regardless of auth
const isScanPage = window.location.pathname.startsWith("/scan");

export default function App() {
  return (
    <AuthProvider>
      {isScanPage ? <ScanPage /> : <MainApp />}
    </AuthProvider>
  );
}

function MainApp() {
  const { professor, logout } = useAuth();
  const [tab, setTab] = useState("session");

  if (!professor) return <LoginPage />;

  const tabs = [
    { id: "session",   label: "Take attendance", icon: "📋" },
    { id: "analytics", label: "Analytics",        icon: "📊" },
    { id: "students",  label: "Students",         icon: "👥" },
  ];

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>📋</span>
          <div>
            <div style={styles.brandTitle}>Attendance</div>
            <div style={styles.brandSub}>Medical College</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...styles.navItem, ...(tab === t.id ? styles.navActive : {}) }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.profCard}>
          <div style={styles.avatar}>
            {professor.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div style={styles.profName}>{professor.name}</div>
            <div style={styles.profEmail}>{professor.email}</div>
          </div>
          <button onClick={logout} style={styles.logoutBtn} title="Sign out">↩</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.content}>
          {tab === "session"   && <SessionPage />}
          {tab === "analytics" && <AnalyticsPage />}
          {tab === "students"  && <StudentsPage />}
        </div>
      </main>
    </div>
  );
}

const styles = {
  shell:       { display: "flex", minHeight: "100vh", background: "#f0f4ff" },
  sidebar:     { width: 220, background: "#fff", borderRight: "1px solid #e8eaf6",
    display: "flex", flexDirection: "column", padding: "1.25rem 0", flexShrink: 0 },
  brand:       { display: "flex", alignItems: "center", gap: 10, padding: "0 1.25rem 1.25rem",
    borderBottom: "1px solid #f0f0f0" },
  brandIcon:   { fontSize: 28 },
  brandTitle:  { fontWeight: 700, fontSize: 15, color: "#1a1a2e" },
  brandSub:    { fontSize: 11, color: "#aaa" },
  nav:         { flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: 2 },
  navItem:     { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10,
    border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#666",
    fontWeight: 400, textAlign: "left", transition: "background 0.15s" },
  navActive:   { background: "#e8f0fe", color: "#1a73e8", fontWeight: 600 },
  profCard:    { padding: "1rem 1.25rem", borderTop: "1px solid #f0f0f0", display: "flex",
    alignItems: "center", gap: 8 },
  avatar:      { width: 34, height: 34, borderRadius: "50%", background: "#e8f0fe",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
    fontWeight: 700, color: "#1a73e8", flexShrink: 0 },
  profName:    { fontSize: 12, fontWeight: 600, color: "#333", lineHeight: 1.2 },
  profEmail:   { fontSize: 10, color: "#aaa", lineHeight: 1.2, marginTop: 1 },
  logoutBtn:   { marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
    fontSize: 16, color: "#ccc", padding: 2 },
  main:        { flex: 1, overflow: "auto" },
  content:     { maxWidth: 900, margin: "0 auto", padding: "1.5rem" },
};
