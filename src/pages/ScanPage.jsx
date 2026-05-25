// src/pages/ScanPage.jsx
import { useState } from "react";
import { api, getDeviceId } from "../utils/api.jsx";

export default function ScanPage() {
  const params    = new URLSearchParams(window.location.search);
  const token     = params.get("token") || "";
  const [rollNo,  setRollNo]  = useState("");
  const [status,  setStatus]  = useState("idle");
  const [message, setMessage] = useState("");
  const [name,    setName]    = useState("");

  const submit = async (e) => {
    e && e.preventDefault();
    if (!token) { setStatus("error"); setMessage("Invalid QR — please scan again."); return; }
    if (!rollNo.trim()) return;
    setStatus("loading");
    try {
      const d = await api.recordScan(token, rollNo.trim(), getDeviceId());
      setName(d.studentName || ""); setStatus("success"); setMessage(d.message);
    } catch(e) { setStatus("error"); setMessage(e.message); }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.logo}>
            <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
              <path d="M15 8C15 8 8 12 8 19C8 23.4 11.6 27 16 27C18.2 27 20 25.8 20 25.8" fill="#ea4335"/>
              <circle cx="15" cy="10" r="6" fill="#ea4335"/>
              <path d="M18 24L28 8L38 24L33 24L28 16L23 24Z" fill="#6DBE45" opacity="0.9"/>
            </svg>
            <span style={S.logoText}><span style={{color:"#ea4335"}}>data</span><span style={{color:"#6DBE45"}}>vedha</span></span>
          </div>
          <div style={S.headerSub}>Medical College · Attendance</div>
        </div>

        {/* SUCCESS */}
        {status==="success" && (
          <div style={S.successWrap} className="fade-up">
            <div style={S.bigIcon}>✅</div>
            <h2 style={S.successTitle}>You're marked present!</h2>
            {name && <p style={S.studentName}>Welcome, <strong>{name}</strong></p>}
            <div style={S.successNote}>
              <p style={{fontWeight:600,color:"#166534",marginBottom:4}}>Attendance recorded successfully</p>
              <p style={{fontSize:13,color:"#4ade80"}}>You may close this tab now</p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status==="error" && (
          <div style={S.errorWrap}>
            <div style={S.bigIcon}>❌</div>
            <h2 style={S.errorTitle}>Could not mark attendance</h2>
            <div style={S.errorBox}>{message}</div>
            <button style={S.retryBtn} onClick={()=>setStatus("idle")}>Try Again</button>
          </div>
        )}

        {/* LOADING */}
        {status==="loading" && (
          <div style={S.loadingWrap}>
            <div style={S.spinner}/>
            <p style={{color:"#64748b",fontWeight:500}}>Marking your attendance…</p>
          </div>
        )}

        {/* IDLE */}
        {status==="idle" && (
          <div className="fade-up">
            <div style={S.stepsBox}>
              <div style={S.stepsTitle}>Quick steps</div>
              <div style={S.step}><span style={{...S.stepDot,background:"#6DBE45"}}>✓</span><span style={S.stepText}>You scanned the QR code</span></div>
              <div style={S.step}><span style={{...S.stepDot,background:"#1a1a2e"}}>2</span><span style={S.stepText}>Enter your Roll Number below</span></div>
              <div style={S.step}><span style={{...S.stepDot,background:"#e2e8f0",color:"#94a3b8"}}>3</span><span style={{...S.stepText,color:"#94a3b8"}}>Tap Mark Present — done!</span></div>
            </div>
            <form onSubmit={submit}>
              <label style={S.inputLabel}>Your Roll Number</label>
              <input style={S.input} value={rollNo} onChange={e=>setRollNo(e.target.value)}
                placeholder="e.g. 101" type="number" inputMode="numeric" required autoFocus/>
              {!token && <div style={S.warn}>⚠️ No session token. Please scan the QR again.</div>}
              <button style={S.submitBtn} type="submit">Mark me Present ✓</button>
            </form>
          </div>
        )}

        <div style={S.footer}>🔒 One scan per device per session · Powered by <span style={{color:"#ea4335"}}>data</span><span style={{color:"#6DBE45"}}>vedha</span></div>
      </div>
    </div>
  );
}

const S = {
  page:         {minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)",padding:"1rem"},
  card:         {background:"#fff",borderRadius:28,width:"100%",maxWidth:400,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},
  header:       {background:"var(--dv-dark)",padding:"20px 24px"},
  logo:         {display:"flex",alignItems:"center",gap:8,marginBottom:4},
  logoText:     {fontSize:20,fontWeight:900,letterSpacing:"-0.5px"},
  headerSub:    {fontSize:12,color:"rgba(255,255,255,0.5)"},
  successWrap:  {padding:"2rem 1.75rem",textAlign:"center"},
  bigIcon:      {fontSize:60,marginBottom:14},
  successTitle: {fontSize:22,fontWeight:800,color:"#1e293b",marginBottom:8},
  studentName:  {fontSize:16,color:"#475569",marginBottom:16},
  successNote:  {background:"#f0fdf4",borderRadius:14,padding:16},
  errorWrap:    {padding:"2rem 1.75rem",textAlign:"center"},
  errorTitle:   {fontSize:20,fontWeight:700,color:"#1e293b",marginBottom:14},
  errorBox:     {background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"12px 16px",fontSize:14,color:"#dc2626",marginBottom:18,lineHeight:1.5,textAlign:"left"},
  retryBtn:     {padding:"11px 28px",background:"var(--dv-dark)",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer"},
  loadingWrap:  {padding:"3rem",textAlign:"center"},
  spinner:      {width:44,height:44,border:"4px solid #e2e8f0",borderTopColor:"#ea4335",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"},
  stepsBox:     {background:"#f8fafc",borderRadius:16,padding:16,margin:"1.5rem 1.75rem 16px"},
  stepsTitle:   {fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12},
  step:         {display:"flex",alignItems:"center",gap:12,marginBottom:10},
  stepDot:      {width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0},
  stepText:     {fontSize:14,color:"#374151",fontWeight:500},
  inputLabel:   {fontSize:13,fontWeight:700,color:"#374151",display:"block",margin:"0 1.75rem 8px"},
  input:        {display:"block",width:"calc(100% - 3.5rem)",margin:"0 1.75rem",padding:"16px",border:"2px solid #e2e8f0",borderRadius:14,fontSize:24,textAlign:"center",fontWeight:700,letterSpacing:6,outline:"none",color:"#1e293b"},
  warn:         {background:"#fffbeb",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#92400e",margin:"10px 1.75rem 0"},
  submitBtn:    {display:"block",width:"calc(100% - 3.5rem)",margin:"16px 1.75rem 0",padding:16,background:"#6DBE45",color:"#fff",border:"none",borderRadius:14,fontSize:18,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 14px rgba(109,190,69,0.4)"},
  footer:       {textAlign:"center",padding:"14px 20px",borderTop:"1px solid #f1f5f9",fontSize:12,color:"#94a3b8",fontWeight:500},
};
