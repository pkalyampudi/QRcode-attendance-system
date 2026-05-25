// src/pages/SessionPage.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const SUBJECTS = [
  { code:"ANAT", name:"Anatomy" },
  { code:"PHYS", name:"Physiology" },
  { code:"BIOC", name:"Biochemistry" },
  { code:"PHAR", name:"Pharmacology" },
  { code:"PATH", name:"Pathology" },
  { code:"MICR", name:"Microbiology" },
];
const LAB_BATCHES = ["A","B","C"];
const SESSION_SECS = 900;

export default function SessionPage() {
  const { user, pin } = useAuth();
  const [phase,       setPhase]       = useState("setup");
  const [subject,     setSubject]     = useState(SUBJECTS[0].code);
  const [sessionType, setSessionType] = useState("THEORY");
  const [labBatch,    setLabBatch]    = useState("A");
  const [session,     setSession]     = useState(null);
  const [qrUrl,       setQrUrl]       = useState(null);
  const [secsLeft,    setSecsLeft]    = useState(SESSION_SECS);
  const [liveCount,   setLiveCount]   = useState({ present: 0, total: 0 });
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const timerRef = useRef(null);
  const pollRef  = useRef(null);

  const subjectName = SUBJECTS.find(s => s.code === subject)?.name || subject;

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
        const d = await api.getAttendance(user.id, pin);
        const today = new Date().toISOString().slice(0,10);
        const key   = subject + "|" + sessionType;
        const rec   = (d.attendance[key] || {})[today] || {};
        setLiveCount(prev => ({ ...prev, present: Object.values(rec).filter(Boolean).length }));
      } catch(_) {}
    }, 5000);
  }, [user.id, pin, subject, sessionType]);

  const generateQR = async () => {
    setLoading(true); setError("");
    try {
      const d = await api.createSession(user.id, pin, { subjectCode: subject, sessionType, labBatch: sessionType === "LAB" ? labBatch : "ALL" });
      const ses = d.session;
      setSession(ses);
      const scanUrl = `${window.location.origin}/scan?token=${ses.token}`;
      const url = await QRCode.toDataURL(scanUrl, { width: 240, margin: 2, color: { dark: "#1a1a2e", light: "#fff" }, errorCorrectionLevel: "M" });
      setQrUrl(url);
      setSecsLeft(Math.round((new Date(ses.expiresAt) - Date.now()) / 1000));
      startTimer(ses.expiresAt);
      startPolling();
      setPhase("active");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!session) return;
    setLoading(true); setError("");
    clearInterval(timerRef.current); clearInterval(pollRef.current);
    try {
      const d = await api.submitSession(user.id, pin, session.sessionId);
      setSummary(d.summary); setPhase("done");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  const pct = Math.round(secsLeft / SESSION_SECS * 100);
  const tc = pct > 50 ? "#6DBE45" : pct > 20 ? "#f59e0b" : "#ea4335";
  const presPct = liveCount.total ? Math.round(liveCount.present / liveCount.total * 100) : 0;

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.title}>Take Attendance</h2>
          <p style={S.sub}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
      </div>

      {/* SETUP */}
      {phase === "setup" && (
        <div className="fade-up">
          <div style={S.setupCard}>
            <h3 style={S.setupTitle}>Configure session</h3>
            <div style={S.setupGrid}>
              <div style={S.field}>
                <label style={S.label}>Subject</label>
                <div style={S.subjectGrid}>
                  {SUBJECTS.map(sub => (
                    <button key={sub.code} onClick={() => setSubject(sub.code)}
                      style={{ ...S.subjectBtn, ...(subject === sub.code ? S.subjectBtnActive : {}) }}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Session type</label>
                <div style={S.typeRow}>
                  {["THEORY","LAB"].map(t => (
                    <button key={t} onClick={() => setSessionType(t)}
                      style={{ ...S.typeBtn, ...(sessionType === t ? S.typeBtnActive : {}) }}>
                      {t === "THEORY" ? "📖 Theory class" : "🔬 Lab session"}
                    </button>
                  ))}
                </div>
              </div>

              {sessionType === "LAB" && (
                <div style={S.field}>
                  <label style={S.label}>Lab batch</label>
                  <div style={S.batchRow}>
                    {LAB_BATCHES.map(b => (
                      <button key={b} onClick={() => setLabBatch(b)}
                        style={{ ...S.batchBtn, ...(labBatch === b ? S.batchBtnActive : {}) }}>
                        Batch {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={S.sessionSummary}>
              <span style={S.summaryPill}>📚 {subjectName}</span>
              <span style={S.summaryPill}>{sessionType === "THEORY" ? "📖 Theory" : "🔬 Lab"}</span>
              {sessionType === "LAB" && <span style={S.summaryPill}>Batch {labBatch}</span>}
            </div>

            {error && <div style={S.error}>⚠️ {error}</div>}
            <button style={S.generateBtn} onClick={generateQR} disabled={loading}>
              {loading ? "Generating…" : "🚀 Generate QR Code"}
            </button>
          </div>

          <div style={S.howCard}>
            <p style={S.howTitle}>How it works</p>
            <div style={S.howGrid}>
              {[
                ["1","Select subject & type above"],
                ["2","Click Generate QR"],
                ["3","Show QR to students (15 min)"],
                ["4","Click Submit when done"],
              ].map(([n,t]) => (
                <div key={n} style={S.howStep}>
                  <div style={S.howNum}>{n}</div>
                  <div style={S.howText}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE */}
      {phase === "active" && (
        <div style={S.activeGrid} className="fade-up">
          <div style={S.qrCard}>
            <div style={S.qrMeta}>
              <span style={S.livePill}>● LIVE</span>
              <span style={S.qrSubject}>{subjectName} · {sessionType}{sessionType==="LAB"?" · Batch "+labBatch:""}</span>
            </div>
            {qrUrl && <div style={S.qrWrap}><img src={qrUrl} alt="QR" style={S.qrImg}/></div>}
            <p style={S.qrHint}>📱 Students scan → enter Roll Number → mark present</p>

            <div style={S.timerRow}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="#e2e8f0" strokeWidth="5"/>
                <circle cx="36" cy="36" r="30" fill="none" stroke={tc} strokeWidth="5"
                  strokeLinecap="round" strokeDasharray="188.5"
                  strokeDashoffset={188.5*(1-pct/100)} transform="rotate(-90 36 36)"
                  style={{transition:"stroke-dashoffset 1s linear,stroke 0.5s"}}/>
              </svg>
              <div>
                <div style={{...S.timerNum,color:tc}}>{m}:{s<10?"0":""}{s}</div>
                <div style={S.timerLabel}>{secsLeft===0?"Session expired":"minutes left"}</div>
              </div>
            </div>

            <div style={S.qrActions}>
              <button style={S.submitBtn} onClick={submit} disabled={loading}>
                {loading?"Submitting…":"✅ Submit Attendance"}
              </button>
              <button style={S.printBtn} onClick={()=>window.print()}>🖨️</button>
            </div>
            {error && <div style={S.error}>{error}</div>}
          </div>

          <div style={S.liveCard}>
            <p style={S.liveTitle}>📡 Live feed</p>
            <p style={S.liveSub}>Auto-refreshes every 5 seconds</p>
            <div style={S.statsRow}>
              <StatBox val={liveCount.present} label="Present" color="#6DBE45" bg="#f0fdf4"/>
              <StatBox val={liveCount.total-liveCount.present} label="Absent" color="#ea4335" bg="#fef2f2"/>
              <StatBox val={presPct+"%"} label="%" color="#1a1a2e" bg="#f8fafc"/>
            </div>
            <div style={S.progressBar}>
              <div style={{...S.progressFill, width:presPct+"%", background: presPct>=70?"#6DBE45":presPct>=50?"#f59e0b":"#ea4335"}}/>
            </div>
            <p style={S.progressLabel}>{liveCount.present} of {liveCount.total} scanned</p>

            <div style={S.tipBox}>
              <p style={S.tipTitle}>💡 Remember</p>
              <ul style={S.tipList}>
                <li>Each device can only mark one student</li>
                <li>Students below 70% get flagged automatically</li>
                <li>Report emails you after submit</li>
                <li>At-risk alert sent if any student drops below 70%</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === "done" && summary && (
        <div style={S.doneCard} className="fade-up">
          <div style={{fontSize:56,marginBottom:16}}>🎉</div>
          <h3 style={S.doneTitle}>Attendance submitted!</h3>
          <p style={S.doneSub}>{summary.subjectCode} · {summary.sessionType}{summary.labBatch!=="ALL"?" · Batch "+summary.labBatch:""} · {summary.dateStr}</p>
          <div style={S.doneStats}>
            <StatBox val={summary.present} label="Present" color="#6DBE45" bg="#f0fdf4"/>
            <StatBox val={summary.absent}  label="Absent"  color="#ea4335" bg="#fef2f2"/>
            <StatBox val={summary.pct+"%"} label="Rate"    color="#1a1a2e" bg="#f8fafc"/>
          </div>
          <div style={S.emailNote}>📧 Report emailed · At-risk alert sent if any student below 70%</div>
          <button style={S.newBtn} onClick={()=>{setPhase("setup");setSummary(null);setSession(null);setQrUrl(null);}}>
            Start new session
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({val,label,color,bg}) {
  return (
    <div style={{background:bg,borderRadius:12,padding:"14px 10px",textAlign:"center",flex:1}}>
      <div style={{fontSize:28,fontWeight:800,color}}>{val}</div>
      <div style={{fontSize:12,color:"#64748b",fontWeight:600,marginTop:2}}>{label}</div>
    </div>
  );
}

const S = {
  pageHeader: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  title:      {fontSize:24,fontWeight:800,color:"#1e293b"},
  sub:        {fontSize:13,color:"#64748b",marginTop:2},
  setupCard:  {background:"#fff",borderRadius:20,padding:"1.5rem",marginBottom:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  setupTitle: {fontSize:16,fontWeight:700,color:"#1e293b",marginBottom:16},
  setupGrid:  {display:"flex",flexDirection:"column",gap:16},
  field:      {display:"flex",flexDirection:"column",gap:8},
  label:      {fontSize:12,fontWeight:700,color:"#374151"},
  subjectGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8},
  subjectBtn: {padding:"10px 8px",border:"1.5px solid #e2e8f0",borderRadius:10,background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:600,color:"#475569",textAlign:"center"},
  subjectBtnActive:{background:"var(--dv-dark)",color:"#fff",border:"1.5px solid var(--dv-dark)"},
  typeRow:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  typeBtn:    {padding:"12px",border:"1.5px solid #e2e8f0",borderRadius:12,background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:600,color:"#475569"},
  typeBtnActive:{background:"var(--dv-dark)",color:"#fff",border:"1.5px solid var(--dv-dark)"},
  batchRow:   {display:"flex",gap:8,flexWrap:"wrap"},
  batchBtn:   {padding:"8px 14px",border:"1.5px solid #e2e8f0",borderRadius:10,background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:600,color:"#475569"},
  batchBtnActive:{background:"#ea4335",color:"#fff",border:"1.5px solid #ea4335"},
  sessionSummary:{display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"},
  summaryPill:{background:"#f1f5f9",color:"#475569",padding:"5px 12px",borderRadius:99,fontSize:13,fontWeight:600},
  generateBtn:{width:"100%",padding:14,background:"var(--dv-dark)",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"},
  howCard:    {background:"#fff",borderRadius:20,padding:"1.25rem 1.5rem",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  howTitle:   {fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12},
  howGrid:    {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},
  howStep:    {textAlign:"center",padding:"10px 8px"},
  howNum:     {width:28,height:28,borderRadius:"50%",background:"var(--dv-dark)",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"},
  howText:    {fontSize:12,color:"#64748b",lineHeight:1.4},
  activeGrid: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"},
  qrCard:     {background:"#fff",borderRadius:20,padding:"1.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.08)",textAlign:"center"},
  qrMeta:     {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  livePill:   {background:"#fef2f2",color:"#ea4335",padding:"3px 10px",borderRadius:99,fontSize:12,fontWeight:700},
  qrSubject:  {fontSize:13,color:"#64748b",fontWeight:600},
  qrWrap:     {background:"#f8fafc",borderRadius:14,padding:14,display:"inline-block",marginBottom:10},
  qrImg:      {display:"block",borderRadius:8},
  qrHint:     {fontSize:12,color:"#475569",background:"#f0f9ff",borderRadius:10,padding:"8px 12px",marginBottom:14},
  timerRow:   {display:"flex",alignItems:"center",gap:14,justifyContent:"center",marginBottom:16,background:"#f8fafc",borderRadius:14,padding:14},
  timerNum:   {fontSize:30,fontWeight:800,fontFamily:"monospace"},
  timerLabel: {fontSize:12,color:"#94a3b8",marginTop:2},
  qrActions:  {display:"flex",gap:8},
  submitBtn:  {flex:1,padding:12,background:"#6DBE45",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"},
  printBtn:   {padding:"12px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,fontSize:16,cursor:"pointer"},
  liveCard:   {background:"#fff",borderRadius:20,padding:"1.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"},
  liveTitle:  {fontSize:17,fontWeight:700,color:"#1e293b",marginBottom:2},
  liveSub:    {fontSize:12,color:"#94a3b8",marginBottom:16},
  statsRow:   {display:"flex",gap:10,marginBottom:14},
  progressBar:{height:8,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:6},
  progressFill:{height:"100%",borderRadius:99,transition:"width 0.5s ease"},
  progressLabel:{fontSize:12,color:"#64748b",marginBottom:16},
  tipBox:     {background:"#f8fafc",borderRadius:14,padding:14},
  tipTitle:   {fontSize:12,fontWeight:700,color:"#475569",marginBottom:8},
  tipList:    {paddingLeft:16,display:"flex",flexDirection:"column",gap:6,fontSize:12,color:"#64748b"},
  doneCard:   {background:"#fff",borderRadius:24,padding:"3rem 2rem",textAlign:"center",maxWidth:520,margin:"0 auto",boxShadow:"0 8px 40px rgba(0,0,0,0.1)"},
  doneTitle:  {fontSize:26,fontWeight:800,color:"#1e293b",marginBottom:6},
  doneSub:    {fontSize:14,color:"#64748b",marginBottom:24},
  doneStats:  {display:"flex",gap:12,marginBottom:20},
  emailNote:  {background:"#f0fdf4",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#166534",fontWeight:600,marginBottom:20},
  newBtn:     {padding:"13px 32px",background:"var(--dv-dark)",color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer"},
  error:      {background:"#fef2f2",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#dc2626",marginTop:10},
};
