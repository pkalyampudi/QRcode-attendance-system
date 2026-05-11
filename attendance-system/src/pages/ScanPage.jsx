// src/pages/ScanPage.jsx
// Students land here after scanning the QR code
import { useState, useEffect } from "react";
import { api, getDeviceId } from "../utils/api";

export default function ScanPage() {
  const params    = new URLSearchParams(window.location.search);
  const token     = params.get("token") || "";
  const [studentId, setStudentId] = useState(params.get("studentId") || "");
  const [status,    setStatus]    = useState("idle"); // idle | loading | success | error
  const [message,   setMessage]   = useState("");
  const [studentName, setStudentName] = useState("");

  const submit = async (e) => {
    e && e.preventDefault();
    if (!token) { setStatus("error"); setMessage("Invalid QR code — no token found."); return; }
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

  // Auto-submit if studentId pre-filled via URL
  useEffect(() => {
    if (token && studentId) submit();
  }, []); // eslint-disable-line

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.icon}>📋</div>
        <h2 style={styles.title}>Mark attendance</h2>

        {status === "success" && (
          <div style={styles.success}>
            <span style={styles.checkmark}>✅</span>
            <p style={styles.successTitle}>Attendance marked!</p>
            {studentName && <p style={styles.name}>Welcome, {studentName}</p>}
            <p style={styles.successMsg}>{message}</p>
          </div>
        )}

        {status === "error" && (
          <div style={styles.errorBox}>
            <span>❌</span>
            <p style={styles.errorMsg}>{message}</p>
            <button style={styles.retryBtn} onClick={() => setStatus("idle")}>Try again</button>
          </div>
        )}

        {(status === "idle" || status === "loading") && (
          <form onSubmit={submit} style={styles.form}>
            <p style={styles.desc}>Enter your Student ID to mark yourself present.</p>
            <label style={styles.label}>Student ID</label>
            <input
              style={styles.input}
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              placeholder="e.g. 101"
              type="number"
              required
              autoFocus
              disabled={status === "loading"}
            />
            <button style={styles.btn} type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Marking…" : "Mark attendance"}
            </button>
            {!token && (
              <p style={styles.warn}>⚠️ No session token found. Please scan the QR code again.</p>
            )}
          </form>
        )}

        <p style={styles.footer}>
          One scan per student per session. Proxy attempts are detected and blocked.
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0f4ff", padding: "1rem" },
  card: { background: "#fff", borderRadius: 20, padding: "2.5rem 2rem", width: "100%", maxWidth: 380,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" },
  form: { textAlign: "left" },
  desc: { fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 16, textAlign: "left" },
  label: { fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 },
  input: { width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #ddd",
    fontSize: 18, marginBottom: 16, boxSizing: "border-box", textAlign: "center", outline: "none", letterSpacing: 4 },
  btn: { width: "100%", padding: 12, background: "#1a73e8", color: "#fff", border: "none",
    borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  success: { padding: "1rem 0" },
  checkmark: { fontSize: 56, display: "block" },
  successTitle: { fontSize: 22, fontWeight: 700, color: "#34a853", margin: "8px 0 4px" },
  name: { fontSize: 18, fontWeight: 600, color: "#1a1a2e", margin: "4px 0" },
  successMsg: { fontSize: 14, color: "#666" },
  errorBox: { background: "#fff3f3", borderRadius: 12, padding: 20 },
  errorMsg: { fontSize: 15, color: "#d32f2f", margin: "8px 0 16px", fontWeight: 500 },
  retryBtn: { padding: "8px 20px", background: "#ea4335", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  warn: { color: "#f57c00", fontSize: 13, marginTop: 8 },
  footer: { fontSize: 11, color: "#bbb", marginTop: 24, lineHeight: 1.5 },
};
