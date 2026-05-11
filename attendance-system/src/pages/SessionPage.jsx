// src/pages/SessionPage.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { api } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

const SESSION_SECS = 900; // 15 minutes

export default function SessionPage() {
  const { professor, pin } = useAuth();
  const [session,     setSession]     = useState(null);
  const [secsLeft,    setSecsLeft]    = useState(SESSION_SECS);
  const [qrDataUrl,   setQrDataUrl]   = useState(null);
  const [liveCount,   setLiveCount]   = useState({ present: 0, total: 0 });
  const [students,    setStudents]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [submitted,   setSubmitted]   = useState(null);
  const [error,       setError]       = useState("");
  const timerRef = useRef(null);
  const pollRef  = useRef(null);

  // Load students on mount
  useEffect(() => {
    api.getStudents(professor.id, pin)
      .then(d => setStudents(d.students))
      .catch(() => {});
  }, [professor.id, pin]);

  const startTimer = useCallback((expISO) => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((new Date(expISO) - Date.now()) / 1000));
      setSecsLeft(left);
      if (left === 0) clearInterval(timerRef.current);
    }, 1000);
  }, []);

  const startPolling = useCallback((sessionId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const d = await api.getAttendance(professor.id, pin);
        const today = new Date().toISOString().slice(0, 10);
        const rec   = d.attendance[today] || {};
        const pres  = Object.values(rec).filter(Boolean).length;
        setLiveCount({ present: pres, total: d.students.length });
      } catch (_) {}
    }, 5000);
  }, [professor.id, pin]);

  const generateQR = useCallback(async () => {
    setLoading(true); setError(""); setSubmitted(null);
    try {
      const d   = await api.createSession(professor.id, pin);
      const ses = d.session;
      setSession(ses);

      // Build QR payload — includes the scan landing URL
      const scanUrl = `${window.location.origin}/scan?token=${ses.token}`;
      const url     = await QRCode.toDataURL(scanUrl, { width: 240, margin: 2, color: { dark: "#1a1a2e" } });
      setQrDataUrl(url);

      const totalSecs = Math.round((new Date(ses.expiresAt) - Date.now()) / 1000);
      setSecsLeft(totalSecs);
      startTimer(ses.expiresAt);
      startPolling(ses.sessionId);
      setLiveCount({ present: 0, total: students.length });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [professor.id, pin, students.length, startTimer, startPolling]);

  const submitAttendance = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    try {
      const d = await api.submitSession(professor.id, pin, session.sessionId);
      setSubmitted(d.summary);
      setSession(null); setQrDataUrl(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [session, professor.id, pin]);

  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  const pct = session ? Math.round((secsLeft / SESSION_SECS) * 100) : 100;
  const expired = secsLeft === 0 && session;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.heading}>Take attendance</h2>

      {!session && !submitted && (
        <div style={styles.card}>
          <p style={styles.desc}>
            Generate a unique QR code for today's class. Students scan it within 15 minutes.
            Each device can only mark one student — proxies are blocked.
          </p>
          {error && <p style={styles.err}>{error}</p>}
          <button style={styles.btnBlue} onClick={generateQR} disabled={loading}>
            {loading ? "Generating…" : "Generate QR code"}
          </button>
        </div>
      )}

      {session && !submitted && (
        <div style={styles.row}>
          {/* QR Panel */}
          <div style={styles.card}>
            <p style={styles.label}>Scan to mark attendance</p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" style={styles.qr} />}
            <p style={styles.tokenText}>{session.token}</p>

            {/* Timer */}
            <div style={styles.timerWrap}>
              <div style={styles.timerRing}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#e0e0e0" strokeWidth="5"/>
                  <circle cx="32" cy="32" r="26" fill="none"
                    stroke={pct > 50 ? "#34a853" : pct > 20 ? "#fbbc04" : "#ea4335"}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={163.4}
                    strokeDashoffset={163.4 * (1 - pct / 100)}
                    transform="rotate(-90 32 32)"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span style={styles.timerNum}>{m}:{s < 10 ? "0" : ""}{s}</span>
              </div>
              <span style={{ fontSize: 13, color: expired ? "#ea4335" : "#34a853", fontWeight: 600 }}>
                {expired ? "Expired" : "Window open"}
              </span>
            </div>

            <div style={styles.btnRow}>
              <button style={styles.btnGreen} onClick={submitAttendance} disabled={loading}>
                {loading ? "Submitting…" : "Submit attendance"}
              </button>
              <button style={styles.btnGray} onClick={() => window.print()}>
                Print QR
              </button>
            </div>
            {error && <p style={styles.err}>{error}</p>}
          </div>

          {/* Live Feed */}
          <div style={styles.card}>
            <p style={styles.label}>Live feed</p>
            <div style={styles.stats}>
              <Stat val={liveCount.present} label="Scanned in" color="#34a853" />
              <Stat val={liveCount.total - liveCount.present} label="Not yet" color="#ea4335" />
              <Stat val={liveCount.total ? Math.round(liveCount.present / liveCount.total * 100) + "%" : "–"} label="Present %" color="#1a73e8" />
            </div>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>Updates every 5 seconds</p>
          </div>
        </div>
      )}

      {submitted && (
        <div style={styles.card}>
          <p style={{ ...styles.label, color: "#34a853" }}>✅ Submitted! Report sent to {professor.email}</p>
          <div style={styles.stats}>
            <Stat val={submitted.present} label="Present" color="#34a853" />
            <Stat val={submitted.absent}  label="Absent"  color="#ea4335" />
            <Stat val={submitted.pct + "%"} label="Rate"  color="#1a73e8" />
          </div>
          <button style={{ ...styles.btnBlue, marginTop: 16 }} onClick={() => setSubmitted(null)}>
            Start new session
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ val, label, color }) {
  return (
    <div style={{ textAlign: "center", padding: "12px 16px", background: "#f8f9fa", borderRadius: 10 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const styles = {
  wrap:      { padding: "1.5rem 0" },
  heading:   { fontSize: 20, fontWeight: 600, color: "#1a1a2e", marginBottom: "1rem" },
  row:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },
  card:      { background: "#fff", border: "1px solid #e8eaf6", borderRadius: 14, padding: "1.5rem" },
  desc:      { fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 16 },
  label:     { fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 12 },
  tokenText: { fontSize: 10, color: "#aaa", fontFamily: "monospace", textAlign: "center", margin: "4px 0 12px", wordBreak: "break-all" },
  qr:        { display: "block", margin: "0 auto 8px", borderRadius: 8 },
  timerWrap: { display: "flex", alignItems: "center", gap: 12, justifyContent: "center", margin: "12px 0" },
  timerRing: { position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  timerNum:  { position: "absolute", fontSize: 13, fontWeight: 700, color: "#1a1a2e" },
  btnRow:    { display: "flex", gap: 8, flexWrap: "wrap" },
  btnBlue:   { padding: "10px 18px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnGreen:  { padding: "10px 18px", background: "#34a853", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", flex: 1 },
  btnGray:   { padding: "10px 18px", background: "#f1f3f4", color: "#444", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer" },
  stats:     { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  err:       { color: "#d32f2f", fontSize: 13, marginTop: 8 },
};
