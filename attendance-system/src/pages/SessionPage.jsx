// src/pages/SessionPage.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const SESSION_SECS = 900;

export default function SessionPage() {
  const { professor, pin } = useAuth();
  const [phase,     setPhase]     = useState("ready");   // ready | active | submitted
  const [session,   setSession]   = useState(null);
  const [secsLeft,  setSecsLeft]  = useState(SESSION_SECS);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [present,   setPresent]   = useState(0);
  const [total,     setTotal]     = useState(0);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const timerRef = useRef(null);
  const pollRef  = useRef(null);

  useEffect(() => {
    api.getStudents(professor.id, pin).then(d => setTotal(d.students.length)).catch(() => {});
  }, [professor.id, pin]);

  const startTimer = useCallback((expISO) => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((new Date(expISO) - Date.now()) / 1000));
      setSecsLeft(left);
      if (left === 0) clearInterval(timerRef.current);
    }, 1000);
  }, []);

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d     = await api.getAttendance(professor.id, pin);
        const today = new Date().toISOString().slice(0, 10);
        const rec   = d.attendance[today] || {};
        setPresent(Object.values(rec).filter(Boolean).length);
        setTotal(d.students.length);
      } catch (_) {}
    }, 5000);
  }, [professor.id, pin]);

  const generateQR = async () => {
    setLoading(true); setError("");
    try {
      const d       = await api.createSession(professor.id, pin);
      const ses     = d.session;
      setSession(ses);
      const scanUrl = `${window.location.origin}/scan?token=${ses.token}`;
      const url     = await QRCode.toDataURL(scanUrl, {
        width: 260, margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(url);
      setPresent(0);
      const secs = Math.round((new Date(ses.expiresAt) - Date.now()) / 1000);
      setSecsLeft(secs);
      startTimer(ses.expiresAt);
      startPolling();
      setPhase("active");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submitAttendance = async () => {
    if (!session) return;
    setLoading(true); setError("");
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    try {
      const d = await api.submitSession(professor.id, pin, session.sessionId);
      setSummary(d.summary);
      setPhase("submitted");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const m   = Math.floor(secsLeft / 60);
  const s   = secsLeft % 60;
  const pct = Math.round((secsLeft / SESSION_SECS) * 100);
  const timerColor = pct > 50 ? "#34a853" : pct > 20 ? "#f59e0b" : "#ea4335";
  const presentPct = total ? Math.round(present / total * 100) : 0;

  return (
    <div style={S.page}>
      {/* Page header */}
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.pageTitle}>Take Attendance</h2>
          <p style={S.pageSub}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {phase === "ready" && (
          <div style={S.classBadge}>
            <span>👥</span> {total} students registered
          </div>
        )}
      </div>

      {/* ── PHASE: READY ── */}
      {phase === "ready" && (
        <div className="fade-in">
          {/* How it works */}
          <div style={S.howCard}>
            <p style={S.howTitle}>How to take attendance today</p>
            <div style={S.howSteps}>
              {[
                { icon: "🖱️", step: "Step 1", title: "Generate QR", desc: "Click the button below to create a unique QR code for today's class" },
                { icon: "📱", step: "Step 2", title: "Students scan", desc: "Display the QR on screen or print it. Students scan and enter their ID" },
                { icon: "⏱️", step: "Step 3", title: "Wait 15 mins", desc: "The QR is valid for 15 minutes. Watch the live counter on screen" },
                { icon: "✅", step: "Step 4", title: "Submit", desc: "Click Submit when done. Report is instantly emailed to you" },
              ].map((h, i) => (
                <div key={i} style={S.howStep}>
                  <div style={S.howIcon}>{h.icon}</div>
                  <div style={S.howStepLabel}>{h.step}</div>
                  <div style={S.howStepTitle}>{h.title}</div>
                  <div style={S.howStepDesc}>{h.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Anti-proxy notice */}
          <div style={S.proxyNotice}>
            <span style={S.proxyIcon}>🛡️</span>
            <div>
              <strong>Proxy-proof system:</strong> Each device can only mark one student. Duplicate scans are automatically blocked and logged.
            </div>
          </div>

          {error && <div style={S.errorBox}>⚠️ {error}</div>}

          <button style={S.generateBtn} onClick={generateQR} disabled={loading}>
            {loading ? "Generating…" : "🚀 Generate QR Code for Today's Class"}
          </button>
        </div>
      )}

      {/* ── PHASE: ACTIVE ── */}
      {phase === "active" && (
        <div className="fade-in" style={S.activeGrid}>
          {/* Left — QR card */}
          <div style={S.qrCard}>
            <div style={S.qrHeader}>
              <span style={S.qrLive}>● LIVE</span>
              <span style={S.qrDate}>{new Date().toLocaleDateString("en-IN")}</span>
            </div>

            {qrDataUrl && (
              <div style={S.qrWrap}>
                <img src={qrDataUrl} alt="Attendance QR Code" style={S.qrImg} />
              </div>
            )}

            <p style={S.qrInstructions}>
              📱 Students — open phone camera, scan this QR, enter your Student ID
            </p>

            {/* Timer */}
            <div style={S.timerSection}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6"/>
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={timerColor} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 * (1 - pct / 100)}
                  transform="rotate(-90 40 40)"
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                />
              </svg>
              <div style={S.timerInfo}>
                <div style={{ ...S.timerCount, color: timerColor }}>
                  {m}:{s < 10 ? "0" : ""}{s}
                </div>
                <div style={S.timerLabel}>
                  {secsLeft === 0 ? "⏰ Window closed" : "minutes remaining"}
                </div>
              </div>
            </div>

            <div style={S.qrActions}>
              <button style={S.submitBtn} onClick={submitAttendance} disabled={loading}>
                {loading ? "Submitting…" : "✅ Submit Attendance"}
              </button>
              <button style={S.printBtn} onClick={() => window.print()}>
                🖨️ Print
              </button>
            </div>
            {error && <div style={S.errorBox}>{error}</div>}
          </div>

          {/* Right — live feed */}
          <div style={S.liveCard}>
            <p style={S.liveTitle}>📡 Live Attendance Feed</p>
            <p style={S.liveSub}>Updates every 5 seconds</p>

            {/* Big stats */}
            <div style={S.liveStats}>
              <div style={{ ...S.liveStat, background: "#e8f5e9" }}>
                <div style={{ ...S.liveStatNum, color: "#34a853" }}>{present}</div>
                <div style={S.liveStatLabel}>Present</div>
              </div>
              <div style={{ ...S.liveStat, background: "#fce8e6" }}>
                <div style={{ ...S.liveStatNum, color: "#ea4335" }}>{total - present}</div>
                <div style={S.liveStatLabel}>Not yet</div>
              </div>
              <div style={{ ...S.liveStat, background: "#e8f0fe" }}>
                <div style={{ ...S.liveStatNum, color: "#1a73e8" }}>{presentPct}%</div>
                <div style={S.liveStatLabel}>Present %</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={S.progressWrap}>
              <div style={S.progressBar}>
                <div style={{ ...S.progressFill, width: `${presentPct}%`,
                  background: presentPct >= 75 ? "#34a853" : presentPct >= 50 ? "#f59e0b" : "#ea4335" }} />
              </div>
              <span style={S.progressLabel}>{present} of {total} scanned in</span>
            </div>

            {/* Tips */}
            <div style={S.tipsBox}>
              <p style={S.tipsTitle}>💡 Tips</p>
              <ul style={S.tipsList}>
                <li>Students must be in your roster to mark attendance</li>
                <li>Each phone can only mark one student</li>
                <li>You can submit before the 15 min window closes</li>
                <li>Report will be emailed to {professor.email}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE: SUBMITTED ── */}
      {phase === "submitted" && summary && (
        <div className="bounce-in" style={S.successCard}>
          <div style={S.successIcon}>🎉</div>
          <h3 style={S.successTitle}>Attendance Submitted!</h3>
          <p style={S.successSub}>
            Report has been sent to <strong>{professor.email}</strong>
          </p>

          <div style={S.summaryStats}>
            <div style={{ ...S.summaryStat, background: "#e8f5e9" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#34a853" }}>{summary.present}</div>
              <div style={{ fontSize: 13, color: "#34a853", fontWeight: 600 }}>Present</div>
            </div>
            <div style={{ ...S.summaryStat, background: "#fce8e6" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#ea4335" }}>{summary.absent}</div>
              <div style={{ fontSize: 13, color: "#ea4335", fontWeight: 600 }}>Absent</div>
            </div>
            <div style={{ ...S.summaryStat, background: "#e8f0fe" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#1a73e8" }}>{summary.pct}%</div>
              <div style={{ fontSize: 13, color: "#1a73e8", fontWeight: 600 }}>Attendance rate</div>
            </div>
          </div>

          <div style={S.emailConfirm}>
            📧 Full report with absent student list sent to your email
          </div>

          <button style={S.newSessionBtn} onClick={() => { setPhase("ready"); setSummary(null); setSession(null); setQrDataUrl(null); }}>
            Start New Session
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  page:           { padding: "0" },
  pageHeader:     { display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 24, flexWrap: "wrap", gap: 12 },
  pageTitle:      { fontSize: 24, fontWeight: 700, color: "#1e293b" },
  pageSub:        { fontSize: 14, color: "#64748b", marginTop: 2 },
  classBadge:     { display: "flex", alignItems: "center", gap: 6, background: "#e8f0fe",
                    color: "#1a73e8", padding: "8px 16px", borderRadius: 99,
                    fontSize: 14, fontWeight: 600 },
  howCard:        { background: "#fff", borderRadius: 20, padding: "1.5rem",
                    marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  howTitle:       { fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 16 },
  howSteps:       { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  howStep:        { background: "#f8fafc", borderRadius: 14, padding: "16px 12px", textAlign: "center" },
  howIcon:        { fontSize: 28, marginBottom: 8 },
  howStepLabel:   { fontSize: 10, fontWeight: 700, color: "#1a73e8", textTransform: "uppercase",
                    letterSpacing: "0.05em", marginBottom: 4 },
  howStepTitle:   { fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
  howStepDesc:    { fontSize: 12, color: "#64748b", lineHeight: 1.5 },
  proxyNotice:    { display: "flex", alignItems: "flex-start", gap: 12, background: "#fffbeb",
                    border: "1px solid #fde68a", borderRadius: 14, padding: "14px 16px",
                    marginBottom: 20, fontSize: 14, color: "#92400e", lineHeight: 1.5 },
  proxyIcon:      { fontSize: 22, flexShrink: 0 },
  errorBox:       { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
                    padding: "12px 16px", fontSize: 14, color: "#dc2626", marginBottom: 16 },
  generateBtn:    { width: "100%", padding: "16px", background: "#1a73e8", color: "#fff",
                    border: "none", borderRadius: 14, fontSize: 17, fontWeight: 700,
                    cursor: "pointer", boxShadow: "0 4px 14px rgba(26,115,232,0.4)" },
  activeGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" },
  qrCard:         { background: "#fff", borderRadius: 20, padding: "1.5rem",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)", textAlign: "center" },
  qrHeader:       { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  qrLive:         { background: "#fef2f2", color: "#ef4444", padding: "4px 12px",
                    borderRadius: 99, fontSize: 12, fontWeight: 700 },
  qrDate:         { fontSize: 13, color: "#94a3b8" },
  qrWrap:         { background: "#f8fafc", borderRadius: 16, padding: 16,
                    display: "inline-block", marginBottom: 12 },
  qrImg:          { display: "block", borderRadius: 8 },
  qrInstructions: { fontSize: 13, color: "#475569", background: "#f0f9ff",
                    borderRadius: 10, padding: "10px 14px", marginBottom: 16, lineHeight: 1.5 },
  timerSection:   { display: "flex", alignItems: "center", gap: 16, justifyContent: "center",
                    marginBottom: 20, background: "#f8fafc", borderRadius: 14, padding: "16px" },
  timerInfo:      { textAlign: "left" },
  timerCount:     { fontSize: 32, fontWeight: 800, fontFamily: "monospace" },
  timerLabel:     { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  qrActions:      { display: "flex", gap: 10 },
  submitBtn:      { flex: 1, padding: "13px", background: "#34a853", color: "#fff",
                    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  printBtn:       { padding: "13px 16px", background: "#f8fafc", color: "#475569",
                    border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 15, cursor: "pointer" },
  liveCard:       { background: "#fff", borderRadius: 20, padding: "1.5rem",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)" },
  liveTitle:      { fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 2 },
  liveSub:        { fontSize: 12, color: "#94a3b8", marginBottom: 20 },
  liveStats:      { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 },
  liveStat:       { borderRadius: 14, padding: "16px 8px", textAlign: "center" },
  liveStatNum:    { fontSize: 32, fontWeight: 800 },
  liveStatLabel:  { fontSize: 12, fontWeight: 600, marginTop: 2, color: "#475569" },
  progressWrap:   { marginBottom: 20 },
  progressBar:    { height: 8, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 6 },
  progressFill:   { height: "100%", borderRadius: 99, transition: "width 0.5s ease" },
  progressLabel:  { fontSize: 12, color: "#64748b" },
  tipsBox:        { background: "#f8fafc", borderRadius: 14, padding: "16px" },
  tipsTitle:      { fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 },
  tipsList:       { paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 },
  successCard:    { background: "#fff", borderRadius: 24, padding: "3rem 2.5rem",
                    textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.1)", maxWidth: 560, margin: "0 auto" },
  successIcon:    { fontSize: 60, marginBottom: 16 },
  successTitle:   { fontSize: 26, fontWeight: 800, color: "#1e293b", marginBottom: 8 },
  successSub:     { fontSize: 15, color: "#64748b", marginBottom: 28 },
  summaryStats:   { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 },
  summaryStat:    { borderRadius: 16, padding: "20px 10px" },
  emailConfirm:   { background: "#e8f5e9", borderRadius: 12, padding: "12px 16px",
                    fontSize: 14, color: "#2e7d32", fontWeight: 500, marginBottom: 24 },
  newSessionBtn:  { padding: "14px 32px", background: "#1a73e8", color: "#fff",
                    border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer" },
};
