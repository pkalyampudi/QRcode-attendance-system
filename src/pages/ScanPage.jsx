// src/pages/ScanPage.jsx
import { useState, useEffect } from "react";
import { api, getDeviceId } from "../utils/api.jsx";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ScanPage() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token") || "";

  const [rollNo,      setRollNo]      = useState("");
  const [status,      setStatus]      = useState("idle");
  const [studentName, setStudentName] = useState("");
  const [message,     setMessage]     = useState("");
  const [pingStatus,  setPingStatus]  = useState("pinging"); // pinging | ok | slow | failed
  const [pingMs,      setPingMs]      = useState(null);

  // Warmup ping — fires the moment page loads
  useEffect(() => {
    const start = Date.now();
    setPingStatus("pinging");

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 25000);

    fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({ action: "getSubjects" }),
      signal:  controller.signal,
    })
      .then(r => r.json())
      .then(d => {
        clearTimeout(timeout);
        const ms = Date.now() - start;
        setPingMs(ms);
        setPingStatus(ms < 5000 ? "ok" : "slow");
      })
      .catch(e => {
        clearTimeout(timeout);
        setPingStatus(e.name === "AbortError" ? "timeout" : "failed");
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  const markAttendance = async (e) => {
    e && e.preventDefault();
    if (!token)         { setStatus("error"); setMessage("Invalid QR — please scan again."); return; }
    if (!rollNo.trim()) return;

    // Check already marked on this device
    const cached = localStorage.getItem("dv_scan_" + token);
    if (cached) { setStudentName(cached); setStatus("duplicate"); return; }

    setStatus("marking");
    setMessage("");

    try {
      const deviceId = getDeviceId();
      const data     = await api.recordScan(token, rollNo.trim(), deviceId);
      setStudentName(data.studentName || rollNo.trim());
      setStatus("success");
      localStorage.setItem("dv_scan_" + token, data.studentName || rollNo.trim());
    } catch(e) {
      setStatus("error");
      setMessage(e.message || "Network error. Please try again.");
    }
  };

  const serverStatusBanner = () => {
    if (pingStatus === "pinging") return (
      <div style={S.pingBanner}>
        <div style={S.pingDot}/> Connecting to server…
      </div>
    );
    if (pingStatus === "ok") return (
      <div style={{...S.pingBanner, background:"#f0fdf4", color:"#166534"}}>
        ✓ Server ready ({pingMs}ms)
      </div>
    );
    if (pingStatus === "slow") return (
      <div style={{...S.pingBanner, background:"#fffbeb", color:"#92400e"}}>
        ⚠️ Slow connection ({pingMs}ms) — attendance will still work
      </div>
    );
    if (pingStatus === "timeout") return (
      <div style={{...S.pingBanner, background:"#fef2f2", color:"#dc2626"}}>
        ⚠️ Server is waking up — please wait 10 seconds then try again
      </div>
    );
    return (
      <div style={{...S.pingBanner, background:"#fef2f2", color:"#dc2626"}}>
        ❌ Cannot reach server — check your internet connection
      </div>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.logo}>
            <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
              <path d="M15 8C15 8 8 12 8 19C8 23.4 11.6 27 16 27C18.2 27 20 25.8 20 25.8" fill="#ea4335"/>
              <circle cx="15" cy="10" r="6" fill="#ea4335"/>
              <path d="M18 24L28 8L38 24L33 24L28 16L23 24Z" fill="#6DBE45"/>
            </svg>
            <span style={S.logoText}>
              <span style={{color:"#ea4335"}}>data</span>
              <span style={{color:"#6DBE45"}}>vedha</span>
            </span>
          </div>
          <div style={S.headerSub}>GVP College of Medicine · Attendance</div>
        </div>

        {/* Server status */}
        {serverStatusBanner()}

        {/* ── IDLE ── */}
        {status === "idle" && (
          <div style={S.formWrap}>
            <div style={S.stepsBox}>
              <div style={S.stepsTitle}>Quick steps</div>
              <div style={S.step}>
                <span style={{...S.dot, background:"#6DBE45"}}>✓</span>
                <span style={S.stepText}>Scanned the QR code</span>
              </div>
              <div style={S.step}>
                <span style={{...S.dot, background:"#1a1a2e"}}>2</span>
                <span style={S.stepText}>Enter your Roll Number below</span>
              </div>
              <div style={S.step}>
                <span style={{...S.dot, background:"#e2e8f0", color:"#94a3b8"}}>3</span>
                <span style={{...S.stepText, color:"#94a3b8"}}>See your name → done!</span>
              </div>
            </div>

            <form onSubmit={markAttendance}>
              <label style={S.inputLabel}>Enter your Roll Number</label>
              <input
                style={S.input}
                value={rollNo}
                onChange={e => setRollNo(e.target.value)}
                placeholder="101"
                type="number"
                inputMode="numeric"
                required
                autoFocus
              />
              {!token && (
                <div style={S.warnBox}>⚠️ No session token. Please scan the QR again.</div>
              )}
              <button
                style={{
                  ...S.submitBtn,
                  opacity: pingStatus === "pinging" ? 0.7 : 1,
                }}
                type="submit"
              >
                {pingStatus === "pinging" ? "Connecting… (tap to try)" : "Mark Present →"}
              </button>
            </form>
          </div>
        )}

        {/* ── MARKING ── */}
        {status === "marking" && (
          <div style={S.centerWrap}>
            <div style={S.spinner}/>
            <p style={S.loadingText}>Marking your attendance…</p>
            <p style={S.loadingSubText}>Please wait — do not close this page</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === "success" && (
          <div style={S.successWrap}>
            <div style={S.successCircle}>✅</div>
            <div style={S.nameCard}>
              <div style={S.nameLabel}>Attendance marked for</div>
              <div style={S.nameValue}>{studentName}</div>
              <div style={S.rollLabel}>Roll No. {rollNo}</div>
            </div>
            <div style={S.successBox}>
              <p style={S.successMsg}>✓ Your attendance is recorded for today's class</p>
            </div>
            <p style={S.closeNote}>You may close this tab now</p>
          </div>
        )}

        {/* ── DUPLICATE ── */}
        {status === "duplicate" && (
          <div style={S.successWrap}>
            <div style={{fontSize:52, marginBottom:12}}>✅</div>
            <h2 style={{fontSize:20, fontWeight:800, color:"#1a1a2e", marginBottom:16}}>
              Already marked!
            </h2>
            <div style={{...S.nameCard, background:"#f0f9ff", border:"2px solid #7dd3fc"}}>
              <div style={S.nameLabel}>Already recorded for</div>
              <div style={{...S.nameValue, color:"#0369a1"}}>{studentName}</div>
              <div style={S.rollLabel}>Roll No. {rollNo}</div>
            </div>
            <div style={{...S.successBox, background:"#f0f9ff"}}>
              <p style={{...S.successMsg, color:"#0369a1"}}>
                Your attendance was already captured for this session.
              </p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <div style={S.errorWrap}>
            <div style={{fontSize:48, marginBottom:12}}>❌</div>
            <h2 style={S.errorTitle}>Could not mark attendance</h2>
            <div style={S.errorBox}>{message}</div>
            <button style={S.retryBtn}
              onClick={() => { setStatus("idle"); setMessage(""); }}>
              Try Again
            </button>
          </div>
        )}

        <div style={S.footer}>
          🔒 One scan per device per session · Powered by{" "}
          <span style={{color:"#ea4335"}}>data</span>
          <span style={{color:"#6DBE45"}}>vedha</span>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:         { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
                  background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)", padding:"1rem" },
  card:         { background:"#fff", borderRadius:28, width:"100%", maxWidth:400,
                  overflow:"hidden", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" },
  header:       { background:"#1a1a2e", padding:"18px 24px" },
  logo:         { display:"flex", alignItems:"center", gap:8, marginBottom:4 },
  logoText:     { fontSize:20, fontWeight:900, letterSpacing:"-0.5px" },
  headerSub:    { fontSize:12, color:"rgba(255,255,255,0.45)" },
  pingBanner:   { display:"flex", alignItems:"center", gap:8, padding:"10px 16px",
                  background:"#f8fafc", fontSize:12, fontWeight:600, color:"#64748b",
                  borderBottom:"1px solid #f1f5f9" },
  pingDot:      { width:8, height:8, borderRadius:"50%", background:"#f59e0b",
                  animation:"pulse 1s ease infinite", flexShrink:0 },
  formWrap:     { padding:"1.5rem 1.75rem" },
  stepsBox:     { background:"#f8fafc", borderRadius:14, padding:14, marginBottom:20 },
  stepsTitle:   { fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:10 },
  step:         { display:"flex", alignItems:"center", gap:10, marginBottom:8 },
  dot:          { width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 },
  stepText:     { fontSize:14, color:"#374151", fontWeight:500 },
  inputLabel:   { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:8 },
  input:        { width:"100%", padding:"16px", border:"2px solid #e2e8f0", borderRadius:14,
                  fontSize:28, textAlign:"center", fontWeight:800, letterSpacing:8, outline:"none",
                  color:"#1e293b", marginBottom:12 },
  warnBox:      { background:"#fffbeb", borderRadius:10, padding:"10px 14px",
                  fontSize:13, color:"#92400e", marginBottom:12 },
  submitBtn:    { width:"100%", padding:16, background:"#1a1a2e", color:"#fff", border:"none",
                  borderRadius:14, fontSize:16, fontWeight:800, cursor:"pointer" },
  centerWrap:   { padding:"3rem 1.75rem", textAlign:"center" },
  spinner:      { width:48, height:48, border:"4px solid #e2e8f0", borderTopColor:"#6DBE45",
                  borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" },
  loadingText:  { fontSize:16, color:"#1e293b", fontWeight:700, marginBottom:4 },
  loadingSubText:{ fontSize:13, color:"#94a3b8" },
  successWrap:  { padding:"2rem 1.75rem", textAlign:"center" },
  successCircle:{ fontSize:56, marginBottom:16 },
  nameCard:     { background:"linear-gradient(135deg,#f0fdf4,#dcfce7)", border:"2px solid #6DBE45",
                  borderRadius:18, padding:"20px 24px", marginBottom:16, textAlign:"center" },
  nameLabel:    { fontSize:12, fontWeight:700, color:"#166534", textTransform:"uppercase",
                  letterSpacing:"0.06em", marginBottom:8 },
  nameValue:    { fontSize:24, fontWeight:900, color:"#14532d", marginBottom:6, lineHeight:1.2 },
  rollLabel:    { fontSize:13, color:"#4ade80", fontWeight:600 },
  successBox:   { background:"#f0fdf4", borderRadius:14, padding:"14px 16px", marginBottom:12 },
  successMsg:   { fontSize:14, color:"#166534", fontWeight:600 },
  closeNote:    { fontSize:13, color:"#94a3b8", marginTop:8 },
  errorWrap:    { padding:"2rem 1.75rem", textAlign:"center" },
  errorTitle:   { fontSize:20, fontWeight:700, color:"#1e293b", marginBottom:14 },
  errorBox:     { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12,
                  padding:"12px 16px", fontSize:14, color:"#dc2626", marginBottom:18,
                  lineHeight:1.6, textAlign:"left" },
  retryBtn:     { padding:"12px 28px", background:"#1a1a2e", color:"#fff", border:"none",
                  borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer" },
  footer:       { textAlign:"center", padding:"14px 20px", borderTop:"1px solid #f1f5f9",
                  fontSize:12, color:"#94a3b8" },
};
