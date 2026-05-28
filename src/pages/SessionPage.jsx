// src/pages/SessionPage.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const ALL_SUBJECTS = [
  { code:"ANAT", name:"Anatomy" },
  { code:"PHYS", name:"Physiology" },
  { code:"BIOC", name:"Biochemistry" },
  { code:"PHAR", name:"Pharmacology" },
  { code:"PATH", name:"Pathology" },
  { code:"MICR", name:"Microbiology" },
];

const LAB_BATCHES  = ["A","B","C"];
const SESSION_SECS = 1800; // 30 minutes

export default function SessionPage() {
  const { user, pin } = useAuth();

  const visibleSubjects = (user?.subjectCode && user.subjectCode !== "ALL")
    ? ALL_SUBJECTS.filter(s => s.code === user.subjectCode)
    : ALL_SUBJECTS;

  const defaultSubject = visibleSubjects[0]?.code || ALL_SUBJECTS[0].code;

  const [phase,       setPhase]       = useState("setup");
  const [subject,     setSubject]     = useState(defaultSubject);
  const [sessionType, setSessionType] = useState("THEORY");
  const [labBatch,    setLabBatch]    = useState("A");
  const [session,     setSession]     = useState(null);
  const [qrUrl,       setQrUrl]       = useState(null);
  const [secsLeft,    setSecsLeft]    = useState(SESSION_SECS);
  const [liveCount,   setLiveCount]   = useState({ present:0, total:0 });
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  // Refs to avoid stale closures in timer callbacks
  const timerRef        = useRef(null);
  const pollRef         = useRef(null);
  const sessionRef      = useRef(null);
  const phaseRef        = useRef("setup");
  const totalSecsRef    = useRef(SESSION_SECS); // actual total from server

  // Keep refs in sync with state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const subjectName = ALL_SUBJECTS.find(s => s.code === subject)?.name || subject;

  // ── Auto-submit when timer hits zero ──
  const autoSubmit = useCallback(async () => {
    if (!sessionRef.current || phaseRef.current !== "active") return;
    setAutoSubmitting(true);
    setError("⏰ 30 minutes up — auto-submitting attendance…");
    clearInterval(pollRef.current);
    try {
      const d = await api.submitSession(user.id, pin, sessionRef.current.sessionId);
      setSummary(d.summary);
      setPhase("done");
      setAutoSubmitting(false);
      setError("");
    } catch(e) {
      setAutoSubmitting(false);
      setError("Auto-submit failed — please click Submit manually.");
    }
  }, [user.id, pin]);

  const startTimer = useCallback((expISO, totalSecs) => {
    clearInterval(timerRef.current);
    totalSecsRef.current = totalSecs; // store actual total for pct calculation
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((new Date(expISO) - Date.now()) / 1000));
      setSecsLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current);
        autoSubmit();
      }
    }, 1000);
  }, [autoSubmit]);

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    const doPoll = async () => {
      try {
        const d     = await api.getAttendance(user.id, pin);
        const today = new Date().toISOString().slice(0,10);
        const key   = subject + "|" + sessionType;
        const rec   = (d.attendance[key] || {})[today] || {};
        const pres  = Object.values(rec).filter(Boolean).length;
        const total = d.students?.length || 0;
        setLiveCount({ present: pres, total });
      } catch(_) {}
    };
    doPoll();
    pollRef.current = setInterval(doPoll, 5000);
  }, [user.id, pin, subject, sessionType]);

  const generateQR = async () => {
    setLoading(true); setError("");
    try {
      const d = await api.createSession(user.id, pin, {
        subjectCode: subject,
        sessionType,
        labBatch: sessionType === "LAB" ? labBatch : "ALL"
      });
      const ses = d.session;
      setSession(ses);
      sessionRef.current = ses;

      const scanUrl = `${window.location.origin}/scan?token=${ses.token}`;
      const url = await QRCode.toDataURL(scanUrl, {
        width:240, margin:2,
        color:{ dark:"#1a1a2e", light:"#fff" },
        errorCorrectionLevel:"M"
      });
      setQrUrl(url);
      const secs = Math.round((new Date(ses.expiresAt) - Date.now()) / 1000);
      setSecsLeft(secs);
      startTimer(ses.expiresAt, secs);
      startPolling();
      setPhase("active");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!sessionRef.current) return;
    setLoading(true); setError("");
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    try {
      const d = await api.submitSession(user.id, pin, sessionRef.current.sessionId);
      setSummary(d.summary);
      setPhase("done");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const m       = Math.floor(secsLeft / 60);
  const s       = secsLeft % 60;
  const pct     = totalSecsRef.current > 0 ? Math.round(secsLeft / totalSecsRef.current * 100) : 100;
  const tc      = pct > 50 ? "#6DBE45" : pct > 20 ? "#f59e0b" : "#ea4335";
  const presPct = liveCount.total ? Math.round(liveCount.present / liveCount.total * 100) : 0;

  // Warning when 5 mins left
  const fiveMinsLeft = secsLeft <= 300 && secsLeft > 0 && phase === "active";

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.title}>Take Attendance</h2>
          <p style={S.sub}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
        {user?.subjectCode && user.subjectCode !== "ALL" && (
          <div style={S.assignedBadge}>
            📚 {ALL_SUBJECTS.find(s => s.code === user.subjectCode)?.name || user.subjectCode}
          </div>
        )}
      </div>

      {/* ── SETUP ── */}
      {phase === "setup" && (
        <div className="fade-up">
          <div style={S.setupCard}>
            <h3 style={S.setupTitle}>Configure session</h3>
            <div style={S.setupGrid}>

              <div style={S.field}>
                <label style={S.label}>
                  Subject
                  {visibleSubjects.length === 1 && (
                    <span style={S.lockedBadge}>🔒 Assigned</span>
                  )}
                </label>
                <div style={S.subjectGrid}>
                  {visibleSubjects.map(sub => (
                    <button key={sub.code} onClick={() => setSubject(sub.code)}
                      style={{...S.subjectBtn,...(subject===sub.code?S.subjectBtnActive:{})}}>
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
                      style={{...S.typeBtn,...(sessionType===t?S.typeBtnActive:{})}}>
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
                        style={{...S.batchBtn,...(labBatch===b?S.batchBtnActive:{})}}>
                        Batch {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={S.sessionSummary}>
              <span style={S.summaryPill}>📚 {subjectName}</span>
              <span style={S.summaryPill}>{sessionType==="THEORY"?"📖 Theory":"🔬 Lab"}</span>
              {sessionType==="LAB" && <span style={S.summaryPill}>Batch {labBatch}</span>}
              <span style={S.summaryPill}>⏱ 30 min window</span>
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
                ["1","Select session type"],
                ["2","Click Generate QR"],
                ["3","Students scan within 30 mins"],
                ["4","Auto-submits at 30 min mark"],
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

      {/* ── ACTIVE ── */}
      {phase === "active" && (
        <div style={S.activeGrid} className="fade-up">
          <div style={S.qrCard}>
            <div style={S.qrMeta}>
              <span style={S.livePill}>● LIVE</span>
              <span style={S.qrSubject}>
                {subjectName} · {sessionType}{sessionType==="LAB"?" · Batch "+labBatch:""}
              </span>
            </div>

            {qrUrl && (
              <div style={S.qrWrap}>
                <img src={qrUrl} alt="Attendance QR Code" style={S.qrImg}/>
              </div>
            )}

            <p style={S.qrHint}>📱 Students scan → enter Roll Number → see name confirmation → present!</p>

            {/* 5 min warning */}
            {fiveMinsLeft && (
              <div style={S.warningBanner}>
                ⚠️ Less than 5 minutes left — auto-submit soon!
              </div>
            )}

            {/* Timer */}
            <div style={S.timerRow}>
              <div style={S.timerRing}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6"/>
                  <circle cx="40" cy="40" r="34" fill="none" stroke={tc} strokeWidth="6"
                    strokeLinecap="round" strokeDasharray="213.6"
                    strokeDashoffset={213.6*(1-pct/100)}
                    transform="rotate(-90 40 40)"
                    style={{transition:"stroke-dashoffset 1s linear, stroke 0.5s"}}/>
                </svg>
                <div style={S.timerInner}>
                  <div style={{...S.timerNum, color:tc}}>{m}:{s<10?"0":""}{s}</div>
                </div>
              </div>
              <div>
                <div style={S.timerLabel}>
                  {secsLeft === 0
                    ? "⏰ Auto-submitting…"
                    : secsLeft <= 300
                    ? "⚠️ Almost done!"
                    : "minutes remaining"}
                </div>
                <div style={S.timerSub}>Auto-submits at zero</div>
              </div>
            </div>

            <div style={S.qrActions}>
              <button style={S.submitBtn} onClick={submit} disabled={loading || autoSubmitting}>
                {loading || autoSubmitting ? "Submitting…" : "✅ Submit now"}
              </button>
              <button style={S.printBtn} onClick={()=>window.print()}>🖨️</button>
            </div>
            {error && <div style={{...S.error, marginTop:10}}>{error}</div>}
          </div>

          {/* Live feed */}
          <div style={S.liveCard}>
            <p style={S.liveTitle}>📡 Live feed</p>
            <p style={S.liveSub}>Auto-refreshes every 5 seconds</p>
            <div style={S.statsRow}>
              <StatBox val={liveCount.present}               label="Present" color="#6DBE45" bg="#f0fdf4"/>
              <StatBox val={liveCount.total-liveCount.present} label="Absent"  color="#ea4335" bg="#fef2f2"/>
              <StatBox val={presPct+"%"}                     label="%"       color="#1a1a2e" bg="#f8fafc"/>
            </div>
            <div style={S.progressBar}>
              <div style={{...S.progressFill, width:presPct+"%",
                background:presPct>=70?"#6DBE45":presPct>=50?"#f59e0b":"#ea4335"}}/>
            </div>
            <p style={S.progressLabel}>{liveCount.present} of {liveCount.total} scanned</p>
            <div style={S.tipBox}>
              <p style={S.tipTitle}>💡 Remember</p>
              <ul style={S.tipList}>
                <li>Students see their name after entering Roll No.</li>
                <li>Each device can only mark one student</li>
                <li>Session auto-submits after 30 minutes</li>
                <li>At-risk alert sent if student drops below 70%</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === "done" && summary && (
        <div style={S.doneCard} className="fade-up">
          <div style={{fontSize:56,marginBottom:16}}>🎉</div>
          <h3 style={S.doneTitle}>Attendance submitted!</h3>
          <p style={S.doneSub}>
            {subjectName} · {summary.sessionType}
            {summary.labBatch!=="ALL" ? " · Batch "+summary.labBatch : ""} · {summary.dateStr}
          </p>
          <div style={S.doneStats}>
            <StatBox val={summary.present} label="Present" color="#6DBE45" bg="#f0fdf4"/>
            <StatBox val={summary.absent}  label="Absent"  color="#ea4335" bg="#fef2f2"/>
            <StatBox val={summary.pct+"%"} label="Rate"    color="#1a1a2e" bg="#f8fafc"/>
          </div>
          <div style={S.emailNote}>
            📧 Report emailed · At-risk alert sent if any student below 70%
          </div>
          <button style={S.newBtn} onClick={() => {
            setPhase("setup"); setSummary(null);
            setSession(null); sessionRef.current = null;
            setQrUrl(null); setError("");
          }}>
            Start new session
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({val, label, color, bg}) {
  return (
    <div style={{background:bg,borderRadius:12,padding:"14px 10px",textAlign:"center",flex:1}}>
      <div style={{fontSize:28,fontWeight:800,color}}>{val}</div>
      <div style={{fontSize:12,color:"#64748b",fontWeight:600,marginTop:2}}>{label}</div>
    </div>
  );
}

const S = {
  pageHeader:      {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12},
  title:           {fontSize:24,fontWeight:800,color:"#1e293b"},
  sub:             {fontSize:13,color:"#64748b",marginTop:2},
  assignedBadge:   {background:"#1a1a2e",color:"#6DBE45",padding:"8px 16px",borderRadius:99,fontSize:13,fontWeight:700},
  setupCard:       {background:"#fff",borderRadius:20,padding:"1.5rem",marginBottom:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  setupTitle:      {fontSize:16,fontWeight:700,color:"#1e293b",marginBottom:16},
  setupGrid:       {display:"flex",flexDirection:"column",gap:16},
  field:           {display:"flex",flexDirection:"column",gap:8},
  label:           {fontSize:12,fontWeight:700,color:"#374151",display:"flex",alignItems:"center",gap:8},
  lockedBadge:     {background:"#e8f0fe",color:"#1557b0",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:600},
  subjectGrid:     {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8},
  subjectBtn:      {padding:"10px 8px",border:"1.5px solid #e2e8f0",borderRadius:10,background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:600,color:"#475569",textAlign:"center"},
  subjectBtnActive:{background:"#1a1a2e",color:"#fff",border:"1.5px solid #1a1a2e"},
  typeRow:         {display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  typeBtn:         {padding:"12px",border:"1.5px solid #e2e8f0",borderRadius:12,background:"#f8fafc",cursor:"pointer",fontSize:13,fontWeight:600,color:"#475569"},
  typeBtnActive:   {background:"#1a1a2e",color:"#fff",border:"1.5px solid #1a1a2e"},
  batchRow:        {display:"flex",gap:8,flexWrap:"wrap"},
  batchBtn:        {padding:"10px 20px",border:"1.5px solid #e2e8f0",borderRadius:10,background:"#f8fafc",cursor:"pointer",fontSize:14,fontWeight:600,color:"#475569"},
  batchBtnActive:  {background:"#ea4335",color:"#fff",border:"1.5px solid #ea4335"},
  sessionSummary:  {display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"},
  summaryPill:     {background:"#f1f5f9",color:"#475569",padding:"5px 12px",borderRadius:99,fontSize:13,fontWeight:600},
  generateBtn:     {width:"100%",padding:14,background:"#1a1a2e",color:"#fff",border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:"pointer"},
  howCard:         {background:"#fff",borderRadius:20,padding:"1.25rem 1.5rem",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  howTitle:        {fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12},
  howGrid:         {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12},
  howStep:         {textAlign:"center",padding:"10px 8px"},
  howNum:          {width:28,height:28,borderRadius:"50%",background:"#1a1a2e",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"},
  howText:         {fontSize:12,color:"#64748b",lineHeight:1.4},
  activeGrid:      {display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"},
  qrCard:          {background:"#fff",borderRadius:20,padding:"1.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.08)",textAlign:"center"},
  qrMeta:          {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14},
  livePill:        {background:"#fef2f2",color:"#ea4335",padding:"3px 10px",borderRadius:99,fontSize:12,fontWeight:700},
  qrSubject:       {fontSize:13,color:"#64748b",fontWeight:600},
  qrWrap:          {background:"#f8fafc",borderRadius:14,padding:14,display:"inline-block",marginBottom:10},
  qrImg:           {display:"block",borderRadius:8},
  qrHint:          {fontSize:12,color:"#475569",background:"#f0f9ff",borderRadius:10,padding:"8px 12px",marginBottom:10},
  warningBanner:   {background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#92400e",fontWeight:600,marginBottom:10},
  timerRow:        {display:"flex",alignItems:"center",gap:16,justifyContent:"center",marginBottom:16,background:"#f8fafc",borderRadius:14,padding:16},
  timerRing:       {position:"relative",width:80,height:80,flexShrink:0},
  timerInner:      {position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"},
  timerNum:        {fontSize:18,fontWeight:800,fontFamily:"monospace",lineHeight:1},
  timerLabel:      {fontSize:13,color:"#475569",fontWeight:600},
  timerSub:        {fontSize:11,color:"#94a3b8",marginTop:3},
  qrActions:       {display:"flex",gap:8},
  submitBtn:       {flex:1,padding:12,background:"#6DBE45",color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"},
  printBtn:        {padding:"12px 14px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,fontSize:16,cursor:"pointer"},
  liveCard:        {background:"#fff",borderRadius:20,padding:"1.5rem",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"},
  liveTitle:       {fontSize:17,fontWeight:700,color:"#1e293b",marginBottom:2},
  liveSub:         {fontSize:12,color:"#94a3b8",marginBottom:16},
  statsRow:        {display:"flex",gap:10,marginBottom:14},
  progressBar:     {height:8,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:6},
  progressFill:    {height:"100%",borderRadius:99,transition:"width 0.5s ease"},
  progressLabel:   {fontSize:12,color:"#64748b",marginBottom:16},
  tipBox:          {background:"#f8fafc",borderRadius:14,padding:14},
  tipTitle:        {fontSize:12,fontWeight:700,color:"#475569",marginBottom:8},
  tipList:         {paddingLeft:16,display:"flex",flexDirection:"column",gap:6,fontSize:12,color:"#64748b"},
  doneCard:        {background:"#fff",borderRadius:24,padding:"3rem 2rem",textAlign:"center",maxWidth:520,margin:"0 auto",boxShadow:"0 8px 40px rgba(0,0,0,0.1)"},
  doneTitle:       {fontSize:26,fontWeight:800,color:"#1e293b",marginBottom:6},
  doneSub:         {fontSize:14,color:"#64748b",marginBottom:24},
  doneStats:       {display:"flex",gap:12,marginBottom:20},
  emailNote:       {background:"#f0fdf4",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#166534",fontWeight:600,marginBottom:20},
  newBtn:          {padding:"13px 32px",background:"#1a1a2e",color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer"},
  error:           {background:"#fef2f2",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#dc2626"},
};
