// src/App.jsx
import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import LoginPage     from "./pages/LoginPage.jsx";
import SessionPage   from "./pages/SessionPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import StudentsPage  from "./pages/StudentsPage.jsx";
import ScanPage      from "./pages/ScanPage.jsx";

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
  const [tab,        setTab]        = useState("session");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  if (!professor) return <LoginPage />;

  const initials = professor.name.split(" ").map(w => w[0]).slice(0, 2).join("");
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const tabs = [
    { id: "session",   label: "Take Attendance", icon: "📋", desc: "Generate QR & mark attendance" },
    { id: "analytics", label: "Analytics",        icon: "📊", desc: "View attendance reports" },
    { id: "students",  label: "Students",         icon: "👥", desc: "Manage your roster" },
  ];

  return (
    <div style={S.shell}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={S.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{ ...S.sidebar, ...(sidebarOpen ? S.sidebarOpen : {}) }}>
        {/* Brand */}
        <div style={S.brand}>
          <div style={S.brandLogo}>🏥</div>
          <div>
            <div style={S.brandName}>AttendEase</div>
            <div style={S.brandSub}>Medical College</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navLabel}>Menu</div>
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); setSidebarOpen(false); setShowWelcome(false); }}
              style={{ ...S.navItem, ...(tab === t.id && !showWelcome ? S.navActive : {}) }}>
              <span style={S.navIcon}>{t.icon}</span>
              <div style={S.navText}>
                <div style={S.navLabel2}>{t.label}</div>
                <div style={S.navDesc}>{t.desc}</div>
              </div>
              {tab === t.id && !showWelcome && <span style={S.navDot} />}
            </button>
          ))}
        </nav>

        {/* Help */}
        <div style={S.helpBox}>
          <div style={S.helpTitle}>💡 Quick tip</div>
          <div style={S.helpText}>
            Generate a new QR every class. Each code is unique and expires in 15 minutes.
          </div>
        </div>

        {/* Professor card */}
        <div style={S.profCard}>
          <div style={S.profAvatar}>{initials}</div>
          <div style={S.profInfo}>
            <div style={S.profName}>{professor.name}</div>
            <div style={S.profEmail}>{professor.email}</div>
          </div>
          <button onClick={logout} style={S.logoutBtn} title="Sign out">↩</button>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        {/* Top bar */}
        <div style={S.topBar}>
          <button style={S.menuBtn} onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div style={S.topBarTitle}>
            {showWelcome ? "Dashboard" : tabs.find(t => t.id === tab)?.label}
          </div>
          <div style={S.topBarRight}>
            <div style={S.topBarAvatar}>{initials}</div>
          </div>
        </div>

        <div style={S.content}>
          {/* Welcome banner */}
          {showWelcome && (
            <div style={S.welcomeBanner} className="fade-in">
              <div style={S.welcomeLeft}>
                <div style={S.welcomeGreeting}>{greeting}, {professor.name.split(" ")[0]}! 👋</div>
                <div style={S.welcomeSub}>
                  Here's your attendance dashboard. What would you like to do today?
                </div>
                <div style={S.welcomeCards}>
                  {tabs.map(t => (
                    <button key={t.id} style={S.welcomeCard}
                      onClick={() => { setTab(t.id); setShowWelcome(false); }}>
                      <span style={S.welcomeCardIcon}>{t.icon}</span>
                      <div>
                        <div style={S.welcomeCardTitle}>{t.label}</div>
                        <div style={S.welcomeCardDesc}>{t.desc}</div>
                      </div>
                      <span style={S.welcomeCardArrow}>→</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={S.welcomeRight}>
                <div style={S.welcomeIllustration}>
                  <div style={S.illustrationDate}>
                    {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
                  </div>
                  <div style={S.illustrationDay}>
                    {new Date().getDate()}
                  </div>
                  <div style={S.illustrationMonth}>
                    {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </div>
                  <div style={S.illustrationDivider} />
                  <div style={S.illustrationHint}>Tap "Take Attendance" to begin</div>
                </div>
              </div>
            </div>
          )}

          {/* Page content */}
          {!showWelcome && (
            <div className="fade-in">
              {tab === "session"   && <SessionPage />}
              {tab === "analytics" && <AnalyticsPage />}
              {tab === "students"  && <StudentsPage />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const S = {
  shell:              { display: "flex", minHeight: "100vh", background: "#f8fafc" },
  overlay:            { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 },
  sidebar:            { width: 260, background: "#fff", borderRight: "1px solid #f1f5f9",
                        display: "flex", flexDirection: "column", flexShrink: 0,
                        position: "relative", zIndex: 41 },
  sidebarOpen:        { position: "fixed", height: "100vh", top: 0, left: 0, boxShadow: "4px 0 24px rgba(0,0,0,0.15)" },
  brand:              { display: "flex", alignItems: "center", gap: 10, padding: "20px 20px 16px",
                        borderBottom: "1px solid #f1f5f9" },
  brandLogo:          { fontSize: 28, width: 44, height: 44, background: "#e8f0fe",
                        borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  brandName:          { fontSize: 16, fontWeight: 800, color: "#1e293b" },
  brandSub:           { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  nav:                { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 },
  navLabel:           { fontSize: 10, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase",
                        letterSpacing: "0.08em", padding: "0 8px", marginBottom: 4 },
  navItem:            { display: "flex", alignItems: "center", gap: 12, padding: "10px 10px",
                        borderRadius: 12, border: "none", background: "transparent",
                        cursor: "pointer", textAlign: "left", transition: "background .15s",
                        position: "relative" },
  navActive:          { background: "#e8f0fe" },
  navIcon:            { fontSize: 20, width: 32, height: 32, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        background: "#f8fafc", borderRadius: 8, flexShrink: 0 },
  navText:            { flex: 1 },
  navLabel2:          { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  navDesc:            { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  navDot:             { width: 6, height: 6, borderRadius: "50%", background: "#1a73e8" },
  helpBox:            { margin: "8px 12px", background: "#fffbeb", borderRadius: 12,
                        padding: "12px 14px", border: "1px solid #fde68a" },
  helpTitle:          { fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 },
  helpText:           { fontSize: 12, color: "#a16207", lineHeight: 1.5 },
  profCard:           { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                        borderTop: "1px solid #f1f5f9", margin: "0" },
  profAvatar:         { width: 36, height: 36, borderRadius: "50%", background: "#e8f0fe",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: "#1a73e8", flexShrink: 0 },
  profInfo:           { flex: 1, minWidth: 0 },
  profName:           { fontSize: 12, fontWeight: 700, color: "#1e293b",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  profEmail:          { fontSize: 10, color: "#94a3b8", marginTop: 1,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  logoutBtn:          { background: "none", border: "none", cursor: "pointer",
                        fontSize: 18, color: "#cbd5e1", padding: 4, flexShrink: 0 },
  main:               { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topBar:             { display: "flex", alignItems: "center", gap: 12, padding: "0 24px",
                        height: 56, borderBottom: "1px solid #f1f5f9",
                        background: "#fff", position: "sticky", top: 0, zIndex: 10 },
  menuBtn:            { background: "none", border: "none", fontSize: 20, cursor: "pointer",
                        color: "#64748b", display: "none", padding: 4 },
  topBarTitle:        { flex: 1, fontSize: 15, fontWeight: 700, color: "#1e293b" },
  topBarRight:        {},
  topBarAvatar:       { width: 32, height: 32, borderRadius: "50%", background: "#e8f0fe",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#1a73e8" },
  content:            { flex: 1, padding: "24px", maxWidth: 960, margin: "0 auto", width: "100%" },
  welcomeBanner:      { display: "grid", gridTemplateColumns: "1fr auto", gap: 24,
                        background: "#fff", borderRadius: 24, padding: "2rem",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: 0 },
  welcomeLeft:        {},
  welcomeGreeting:    { fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 6 },
  welcomeSub:         { fontSize: 15, color: "#64748b", marginBottom: 24 },
  welcomeCards:       { display: "flex", flexDirection: "column", gap: 10 },
  welcomeCard:        { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                        background: "#f8fafc", border: "1.5px solid #f1f5f9",
                        borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "border-color .15s" },
  welcomeCardIcon:    { fontSize: 24, width: 44, height: 44, background: "#fff",
                        borderRadius: 12, display: "flex", alignItems: "center",
                        justifyContent: "center", flexShrink: 0 },
  welcomeCardTitle:   { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  welcomeCardDesc:    { fontSize: 12, color: "#64748b", marginTop: 1 },
  welcomeCardArrow:   { marginLeft: "auto", fontSize: 16, color: "#94a3b8" },
  welcomeRight:       { display: "flex", alignItems: "center" },
  welcomeIllustration:{ background: "linear-gradient(135deg, #1a73e8, #7c3aed)", borderRadius: 20,
                        padding: "28px 32px", textAlign: "center", color: "#fff", minWidth: 160 },
  illustrationDate:   { fontSize: 12, color: "rgba(255,255,255,0.7)", textTransform: "uppercase",
                        letterSpacing: "0.08em", marginBottom: 4 },
  illustrationDay:    { fontSize: 52, fontWeight: 900, lineHeight: 1, marginBottom: 4 },
  illustrationMonth:  { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 16 },
  illustrationDivider:{ height: 1, background: "rgba(255,255,255,0.2)", marginBottom: 12 },
  illustrationHint:   { fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 },
};
