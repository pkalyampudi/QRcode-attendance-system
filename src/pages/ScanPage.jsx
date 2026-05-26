// src/pages/ScanPage.jsx
// Optimistic UI — marks student present instantly, syncs in background
import { useState, useEffect } from "react";
import { api, getDeviceId } from "../utils/api.jsx";

export default function ScanPage() {
  const params  = new URLSearchParams(window.location.search);
  const token   = params.get("token") || "";
  const [rollNo,  setRollNo]  = useState("");
  const [status,  setStatus]  = useState("idle"); // idle | marking | success | error | duplicate
  const [message, setMessage] = useState("");
  const [name,    setName]    = useState("");
  const [synced,  setSynced]  = useState(false);

  // On success, sync in background — student sees success immediately
  const submit = async (e) => {
    e && e.preventDefault();
    if (!token)         { setStatus("error"); setMessage("Invalid QR — please scan again."); return; }
    if (!rollNo.trim()) return;

    // Check if already marked on this device
    const alreadyMarked = localStorage.getItem("dv_scan_" + token);
    if (alreadyMarked) {
      setStatus("duplicate");
      setName(alreadyMarked);
      return;
    }

    // Optimistic — show success immediately
    setStatus("marking");

    // Fire API in background — don't await for UI
    const deviceId = getDeviceId();

    // Show success instantly after 400ms (feels snappy)
    const optimisticTimer = setTimeout(() => {
      setStatus("success");
      setMessage("Attendance marked successfully!");
      // Store locally so duplicate scan shows correctly
      localStorage.setItem("dv_scan_" + token, rollNo.trim());
    }, 400);

    // Actual API call in background
    try {
      const data = await api.recordScan(token, rollNo.trim(), deviceId);
      clearTimeout(optimisticTimer);
      if (data.ok) {
        setName(data.studentName || rollNo.trim());
        setStatus("success");
        setMessage(data.message);
        setSynced(true);
        localStorage.setItem("dv_scan_" + token, data.studentName || rollNo.trim());
      } else {
        // Server rejected — show real error
        setStatus("error");
        setMessage(data.error || "Could not mark attendance");
        localStorage.removeItem("dv_scan_" + token);
      }
    } catch(e) {
      clearTimeout(optimisticTimer);
      // Always retry in background — student already sees success screen
      retryInBackground(token, rollNo.trim(), deviceId);
    }
  };

  // Retry failed syncs silently in background
  const retryInBackground = (token, rollNo, deviceId) => {
    let attempts = 0;
    const retry = setInterval(async () => {
      attempts++;
      try {
        const data = await api.recordScan(token, rollNo, deviceId);
        if (data.ok) { setSynced(true); clearInterval(retry); }
        if (attempts >= 5) clearInterval(retry);
      } catch(_) {
        if (attempts >= 5) clearInterval(retry);
      }
    }, 3000);
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
          <div style={S.headerSub}>Attendance · Medical College</div>
        </div>

        {/* SUCCESS */}
        {(status === "success" || status === "marking") && (
          <div style={S.successWrap}>
            <div style={S.successCircle}>
              {status === "marking" ? (
                <div style={S.checkSpinner}/>
              ) : "✅"}
            </div>
            <h2 style={S.successTitle}>
              {status === "marking" ? "Marking present…" : "You're present!"}
            </h2>
            {name && status === "success" && (
              <p style={S.studentName}>Welcome, <strong>{name}</strong></p>
            )}
            <div style={S.successBox}>
              <p style={S.successMsg}>
                {status === "marking"
                  ? "Please wait a moment…"
                  : "Your attendance has been recorded for today's class."}
              </p>
              {status === "success" && (
                <>
                  <p style={S.syncStatus}>
                    {synced
                      ? "✓ Synced to server"
                      : "⏳ Syncing in background…"}
                  </p>
                  <p style={S.closeNote}>You may close this tab</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* DUPLICATE */}
        {status === "duplicate" && (
          <div style={S.successWrap}>
            <div style={{fontSize:56,marginBottom:12}}>✅</div>
            <h2 style={{...S.successTitle, color:"#1a1a2e"}}>Already marked!</h2>
            <p style={S.studentName}>
              {name ? `Welcome back, ${name}` : "Your attendance was already recorded"}
            </p>
            <div style={S.successBox}>
              <p style={S.successMsg}>You have already marked attendance for this session.</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div style={S.errorWrap}>
            <div style={{fontSize:52,marginBottom:12}}>❌</div>
            <h2 style={S.errorTitle}>Could not mark attendance</h2>
            <div style={S.errorBox}>{message}</div>
            <button style={S.retryBtn} onClick={() => { setStatus("idle"); setMessage(""); }}>
              Try Again
            </button>
          </div>
        )}

        {/* IDLE — input form */}
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
                <span style={{...S.stepText, color:"#94a3b8"}}>Tap Mark Present — done!</span>
              </div>
            </div>

            <form onSubmit={submit} style={S.form}>
              <label style={S.inputLabel}>Your Roll Number</label>
              <input
                style={S.input}
                value={rollNo}
                onChange={e => setRollNo(e.target.value)}
                placeholder="e.g. 101"
                type="number"
                inputMode="numeric"
                required
                autoFocus
              />
              {!token && (
                <div style={S.warnBox}>
                  ⚠️ No session token. Please scan the QR again.
                </div>
              )}
              <button style={S.submitBtn} type="submit">
                Mark me Present ✓
              </button>
            </form>
          </div>
        )}

        <div style={S.footer}>
          🔒 One scan per device · Proxy attempts are blocked
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
  successWrap:  { padding:"2rem 1.75rem", textAlign:"center" },
  successCircle:{ fontSize:60, marginBottom:14, height:72, display:"flex",
                  alignItems:"center", justifyContent:"center", margin:"0 auto 14px" },
  checkSpinner: { width:56, height:56, border:"5px solid #e2e8f0",
                  borderTopColor:"#6DBE45", borderRadius:"50%",
                  animation:"spin 0.7s linear infinite" },
  successTitle: { fontSize:22, fontWeight:800, color:"#166534", marginBottom:8 },
  studentName:  { fontSize:16, color:"#475569", marginBottom:16 },
  successBox:   { background:"#f0fdf4", borderRadius:14, padding:"14px 16px" },
  successMsg:   { fontSize:14, color:"#166534", fontWeight:600, marginBottom:6 },
  syncStatus:   { fontSize:12, color:"#4ade80", marginBottom:4 },
  closeNote:    { fontSize:12, color:"#86efac" },
  errorWrap:    { padding:"2rem 1.75rem", textAlign:"center" },
  errorTitle:   { fontSize:20, fontWeight:700, color:"#1e293b", marginBottom:14 },
  errorBox:     { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12,
                  padding:"12px 16px", fontSize:14, color:"#dc2626",
                  marginBottom:18, lineHeight:1.5, textAlign:"left" },
  retryBtn:     { padding:"11px 28px", background:"#1a1a2e", color:"#fff",
                  border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer" },
  formWrap:     { padding:"1.5rem 1.75rem" },
  stepsBox:     { background:"#f8fafc", borderRadius:14, padding:14, marginBottom:20 },
  stepsTitle:   { fontSize:11, fontWeight:700, color:"#94a3b8",
                  textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 },
  step:         { display:"flex", alignItems:"center", gap:10, marginBottom:8 },
  dot:          { width:26, height:26, borderRadius:"50%", display:"flex",
                  alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 },
  stepText:     { fontSize:14, color:"#374151", fontWeight:500 },
  form:         {},
  inputLabel:   { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:8 },
  input:        { width:"100%", padding:"16px", border:"2px solid #e2e8f0",
                  borderRadius:14, fontSize:28, textAlign:"center",
                  fontWeight:800, letterSpacing:8, outline:"none",
                  color:"#1e293b", marginBottom:12 },
  warnBox:      { background:"#fffbeb", borderRadius:10, padding:"10px 14px",
                  fontSize:13, color:"#92400e", marginBottom:12 },
  submitBtn:    { width:"100%", padding:16, background:"#6DBE45", color:"#fff",
                  border:"none", borderRadius:14, fontSize:18, fontWeight:800,
                  cursor:"pointer", boxShadow:"0 4px 14px rgba(109,190,69,0.35)" },
  footer:       { textAlign:"center", padding:"14px 20px",
                  borderTop:"1px solid #f1f5f9", fontSize:12, color:"#94a3b8" },
};
