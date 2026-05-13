// src/pages/ScanPage.jsx
import { useState, useEffect } from "react";
import { api, getDeviceId } from "../utils/api.jsx";

export default function ScanPage() {
  const params    = new URLSearchParams(window.location.search);
  const token     = params.get("token") || "";
  const [studentId, setStudentId] = useState("");
  const [status,    setStatus]    = useState("idle");
  const [message,   setMessage]   = useState("");
  const [studentName, setStudentName] = useState("");

  const submit = async (e) => {
    e && e.preventDefault();
    if (!token) { setStatus("error"); setMessage("Invalid QR — please scan again."); return; }
    if (!studentId.trim()) return;
    setStatus("loading");
    try {
      const deviceId = getDeviceId();
      const data = await api.recordScan(token, studentId.trim(), deviceId);
      setStudentName(data.studentName || "");
      setStatus("success");
      setMessage(data.message);
    } catch (e) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerIcon}>🏥</div>
          <div style={S.headerTitle}>AttendEase</div>
          <div style={S.headerSub}>Medical College · Attendance</div>
        </div>

        {/* SUCCESS */}
        {status === "success" && (
          <div style={S.successWrap} className="bounce-in">
            <div style={S.successCircle}>✅</div>
            <h2 style={S.successTitle}>You're marked present!</h2>
            {studentName && <p style={S.studentName}>Welcome, <strong>{studentName}</strong></p>}
            <div style={S.successBox}>
              <p style={S.successMsg}>Your attendance has been recorded for today's class.</p>
              <p style={S.successNote}>You may now close this tab.</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div style={S.errorWrap} className="scale-in">
            <div style={S.errorCircle}>❌</div>
            <h2 style={S.errorTitle}>Could not mark attendance</h2>
            <div style={S.errorBox}>{message}</div>
            <button style={S.retryBtn} onClick={() => setStatus("idle")}>
              Try Again
            </button>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div style={S.loadingWrap}>
            <div style={S.loadingSpinner} />
            <p style={S.loadingText}>Marking your attendance…</p>
          </div>
        )}

        {/* IDLE — input form */}
        {status === "idle" && (
          <div className="fade-in">
            {/* Steps for student */}
            <div style={S.stepsBox}>
              <div style={S.stepsTitle}>Quick steps</div>
              <div style={S.steps}>
                <div style={S.stepRow}>
                  <div style={{ ...S.stepDot, background: "#34a853" }}>✓</div>
                  <span style={S.stepText}>You scanned the QR code</span>
                </div>
                <div style={S.stepRow}>
                  <div style={{ ...S.stepDot, background: "#1a73e8" }}>2</div>
                  <span style={S.stepText}>Enter your Student ID below</span>
                </div>
                <div style={S.stepRow}>
                  <div style={{ ...S.stepDot, background: "#94a3b8" }}>3</div>
                  <span style={{ ...S.stepText, color: "#94a3b8" }}>Tap Mark Present — done!</span>
                </div>
              </div>
            </div>

            <form onSubmit={submit}>
              <label style={S.label}>Enter your Student ID</label>
              <input
                style={S.input}
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="e.g. 101"
                type="number"
                inputMode="numeric"
                required
                autoFocus
              />
              {!token && (
                <div style={S.warnBox}>
                  ⚠️ No session found. Please scan the QR code again.
                </div>
              )}
              <button style={S.submitBtn} type="submit">
                Mark me Present ✓
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          🔒 One scan per student · Proxy attempts are blocked and reported
        </div>
      </div>
    </div>
  );
}

const S = {
  page:           { minHeight: "100vh", display: "flex", alignItems: "center",
                    justifyContent: "center", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    padding: "1rem" },
  card:           { background: "#fff", borderRadius: 28, width: "100%", maxWidth: 400,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" },
  header:         { background: "linear-gradient(135deg, #1a73e8, #0d47a1)",
                    padding: "24px 28px", textAlign: "center" },
  headerIcon:     { fontSize: 36, marginBottom: 6 },
  headerTitle:    { fontSize: 20, fontWeight: 800, color: "#fff" },
  headerSub:      { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  successWrap:    { padding: "2rem 1.75rem", textAlign: "center" },
  successCircle:  { fontSize: 64, marginBottom: 16 },
  successTitle:   { fontSize: 22, fontWeight: 800, color: "#1e293b", marginBottom: 8 },
  studentName:    { fontSize: 16, color: "#475569", marginBottom: 16 },
  successBox:     { background: "#e8f5e9", borderRadius: 14, padding: "16px" },
  successMsg:     { fontSize: 14, color: "#2e7d32", fontWeight: 600, marginBottom: 4 },
  successNote:    { fontSize: 13, color: "#4caf50" },
  errorWrap:      { padding: "2rem 1.75rem", textAlign: "center" },
  errorCircle:    { fontSize: 56, marginBottom: 12 },
  errorTitle:     { fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 16 },
  errorBox:       { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
                    padding: "14px 16px", fontSize: 14, color: "#dc2626",
                    marginBottom: 20, lineHeight: 1.5, textAlign: "left" },
  retryBtn:       { padding: "12px 28px", background: "#1a73e8", color: "#fff",
                    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  loadingWrap:    { padding: "3rem", textAlign: "center" },
  loadingSpinner: { width: 48, height: 48, border: "4px solid #e2e8f0",
                    borderTopColor: "#1a73e8", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite", margin: "0 auto 16px" },
  loadingText:    { fontSize: 15, color: "#64748b", fontWeight: 500 },
  stepsBox:       { background: "#f8fafc", borderRadius: 16, padding: "16px", marginBottom: 20 },
  stepsTitle:     { fontSize: 11, fontWeight: 700, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 },
  steps:          { display: "flex", flexDirection: "column", gap: 10 },
  stepRow:        { display: "flex", alignItems: "center", gap: 12 },
  stepDot:        { width: 26, height: 26, borderRadius: "50%", color: "#fff",
                    fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0 },
  stepText:       { fontSize: 14, color: "#374151", fontWeight: 500 },
  label:          { fontSize: 13, fontWeight: 700, color: "#374151",
                    display: "block", marginBottom: 8 },
  input:          { width: "100%", padding: "16px", border: "2px solid #e2e8f0",
                    borderRadius: 14, fontSize: 24, textAlign: "center",
                    fontWeight: 700, letterSpacing: 6, outline: "none",
                    marginBottom: 12, color: "#1e293b" },
  warnBox:        { background: "#fffbeb", borderRadius: 10, padding: "10px 14px",
                    fontSize: 13, color: "#92400e", marginBottom: 12 },
  submitBtn:      { width: "100%", padding: "16px", background: "#34a853",
                    color: "#fff", border: "none", borderRadius: 14,
                    fontSize: 18, fontWeight: 800, cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(52,168,83,0.4)" },
  footer:         { textAlign: "center", padding: "16px 20px",
                    borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#94a3b8" },
};

// Add padding for form section
const formPad = { padding: "1.5rem 1.75rem" };
