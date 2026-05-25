// src/pages/HODDashboard.jsx
import { useState, useEffect } from "react";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const SUBJECTS = [
  {code:"ANAT",name:"Anatomy"},{code:"PHYS",name:"Physiology"},{code:"BIOC",name:"Biochemistry"},
  {code:"PHAR",name:"Pharmacology"},{code:"PATH",name:"Pathology"},{code:"MICR",name:"Microbiology"},
];

export default function HODDashboard() {
  const { user, pin } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("overview");

  useEffect(() => {
    api.getHODDashboard(user.id, pin)
      .then(d => setData(d)).catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id, pin]);

  if (loading) return <LoadingState />;
  if (!data)   return <div style={{color:"#ea4335",padding:"2rem"}}>Failed to load dashboard.</div>;

  const { bySubject, byJoinBatch, byLabBatch, atRiskList } = data;

  const totalSessions = Object.values(bySubject).reduce((a, v) => a + (v.sessions || 0), 0);
  const totalPresent  = Object.values(bySubject).reduce((a, v) => a + v.present, 0);
  const totalPossible = Object.values(bySubject).reduce((a, v) => a + v.total, 0);
  const overallPct    = totalPossible ? Math.round(totalPresent / totalPossible * 100) : 0;

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>HOD Dashboard</h2>
          <p style={S.sub}>Full attendance overview across all subjects and batches</p>
        </div>
        <button onClick={() => { setLoading(true); api.getHODDashboard(user.id, pin).then(d => setData(d)).finally(() => setLoading(false)); }}
          style={S.refreshBtn}>🔄 Refresh</button>
      </div>

      {/* Top KPI cards */}
      <div style={S.kpiGrid}>
        <KPICard icon="📅" label="Total sessions" value={totalSessions} color="#1a1a2e" bg="#f8fafc" />
        <KPICard icon="✅" label="Overall attendance" value={overallPct+"%"} color={overallPct>=70?"#6DBE45":"#ea4335"} bg={overallPct>=70?"#f0fdf4":"#fef2f2"} />
        <KPICard icon="⚠️" label="At-risk students" value={atRiskList.length} color="#ea4335" bg="#fef2f2" />
        <KPICard icon="📚" label="Active subjects" value={Object.keys(bySubject).length} color="#1a73e8" bg="#e8f0fe" />
      </div>

      {/* At-risk alert banner */}
      {atRiskList.length > 0 && (
        <div style={S.atRiskBanner}>
          <span style={{fontSize:20}}>⚠️</span>
          <div>
            <strong>{atRiskList.length} student-subject combinations below 70%</strong>
            <p style={{fontSize:13,marginTop:2,opacity:.8}}>Review the At-Risk tab for details</p>
          </div>
          <button style={S.atRiskBtn} onClick={() => setTab("atrisk")}>View list →</button>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {[["overview","📊 Overview"],["subjects","📚 By subject"],["batches","🔬 Lab batches"],["joining","🎓 Joining year"],["atrisk","⚠️ At risk"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{...S.tab,...(tab===id?S.tabActive:{})}}>
            {label}
            {id==="atrisk" && atRiskList.length > 0 && <span style={S.tabBadge}>{atRiskList.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab bySubject={bySubject} byJoinBatch={byJoinBatch} byLabBatch={byLabBatch} />}
      {tab === "subjects" && <SubjectsTab bySubject={bySubject} />}
      {tab === "batches"  && <BatchesTab byLabBatch={byLabBatch} />}
      {tab === "joining"  && <JoiningTab byJoinBatch={byJoinBatch} />}
      {tab === "atrisk"   && <AtRiskTab atRiskList={atRiskList} />}
    </div>
  );
}

function OverviewTab({ bySubject, byJoinBatch, byLabBatch }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={S.card}>
        <p style={S.cardTitle}>Subject attendance summary</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {SUBJECTS.map(sub => {
            const theory = bySubject[sub.code+"|THEORY"] || {present:0,total:0,sessions:0};
            const lab    = bySubject[sub.code+"|LAB"]    || {present:0,total:0,sessions:0};
            const tPct   = theory.total ? Math.round(theory.present/theory.total*100) : null;
            const lPct   = lab.total    ? Math.round(lab.present/lab.total*100)       : null;
            return (
              <div key={sub.code} style={S.subjectRow}>
                <div style={S.subjectName}>{sub.name}</div>
                <PctBar label="Theory" pct={tPct} sessions={theory.sessions}/>
                <PctBar label="Lab" pct={lPct} sessions={lab.sessions}/>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={S.card}>
          <p style={S.cardTitle}>By joining year</p>
          {Object.entries(byJoinBatch).map(([k,v]) => {
            const pct = v.total ? Math.round(v.present/v.total*100) : 0;
            return <PctRow key={k} label={k} pct={pct}/>;
          })}
        </div>
        <div style={S.card}>
          <p style={S.cardTitle}>By lab batch</p>
          {Object.entries(byLabBatch).map(([k,v]) => {
            const pct = v.total ? Math.round(v.present/v.total*100) : 0;
            return <PctRow key={k} label={"Batch "+k} pct={pct}/>;
          })}
        </div>
      </div>
    </div>
  );
}

function SubjectsTab({ bySubject }) {
  return (
    <div style={S.card}>
      <table style={S.table}>
        <thead><tr style={S.thead}>
          <Th>Subject</Th><Th w={100}>Type</Th><Th w={80}>Sessions</Th><Th w={120}>Present/Total</Th><Th w={80}>Rate</Th>
        </tr></thead>
        <tbody>
          {SUBJECTS.flatMap(sub =>
            ["THEORY","LAB"].map(type => {
              const d = bySubject[sub.code+"|"+type];
              if (!d || !d.total) return null;
              const pct = Math.round(d.present/d.total*100);
              return (
                <tr key={sub.code+type} style={S.tr}>
                  <td style={S.td}><strong>{sub.name}</strong></td>
                  <td style={S.td}><span style={{...S.pill,background:type==="THEORY"?"#e8f0fe":"#e8f5e9",color:type==="THEORY"?"#1557b0":"#166534"}}>{type}</span></td>
                  <td style={S.td}>{d.sessions || "–"}</td>
                  <td style={S.td}>{d.present} / {d.total}</td>
                  <td style={S.td}><AttBadge pct={pct}/></td>
                </tr>
              );
            }).filter(Boolean)
          )}
        </tbody>
      </table>
    </div>
  );
}

function BatchesTab({ byLabBatch }) {
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>Lab batch comparison</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {Object.entries(byLabBatch).map(([batch,v]) => {
          const pct = v.total ? Math.round(v.present/v.total*100) : 0;
          return (
            <div key={batch} style={{background:pct>=70?"#f0fdf4":"#fef2f2",borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:900,color:pct>=70?"#6DBE45":"#ea4335"}}>Batch {batch}</div>
              <div style={{fontSize:32,fontWeight:800,color:pct>=70?"#166534":"#c62828",margin:"8px 0"}}>{pct}%</div>
              <div style={{fontSize:12,color:"#64748b"}}>{v.present}/{v.total} sessions</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JoiningTab({ byJoinBatch }) {
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>Attendance by joining year</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {Object.entries(byJoinBatch).map(([yr,v]) => {
          const pct = v.total ? Math.round(v.present/v.total*100) : 0;
          return (
            <div key={yr} style={{background:"#f8fafc",borderRadius:16,padding:"24px 16px",textAlign:"center",border:"1.5px solid #e2e8f0"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#64748b",marginBottom:8}}>Batch {yr}</div>
              <div style={{fontSize:36,fontWeight:900,color:pct>=70?"#6DBE45":"#ea4335"}}>{pct}%</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>{v.present} present / {v.total} total</div>
              <div style={{height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginTop:10}}>
                <div style={{height:"100%",width:pct+"%",background:pct>=70?"#6DBE45":"#ea4335",borderRadius:99}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AtRiskTab({ atRiskList }) {
  if (!atRiskList.length) return (
    <div style={{...S.card,textAlign:"center",padding:"3rem"}}>
      <div style={{fontSize:48,marginBottom:12}}>🎉</div>
      <h3 style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:6}}>No at-risk students!</h3>
      <p style={{color:"#64748b"}}>All students are above 70% attendance.</p>
    </div>
  );

  return (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <p style={S.cardTitle}>Students below 70% — {atRiskList.length} flagged</p>
      </div>
      <table style={S.table}>
        <thead><tr style={S.thead}>
          <Th w={80}>Roll No.</Th><Th>Name</Th><Th w={130}>Subject</Th><Th w={80}>Type</Th><Th w={80}>Attendance</Th><Th w={90}>Sessions</Th>
        </tr></thead>
        <tbody>
          {atRiskList.sort((a,b)=>a.pct-b.pct).map((r,i) => (
            <tr key={i} style={S.tr}>
              <td style={S.td}><code style={S.code}>{r.studentId}</code></td>
              <td style={{...S.td,fontWeight:600}}>{r.name}</td>
              <td style={S.td}>{SUBJECTS.find(s=>s.code===r.subject)?.name||r.subject}</td>
              <td style={S.td}><span style={{...S.pill,background:r.type==="THEORY"?"#e8f0fe":"#e8f5e9",color:r.type==="THEORY"?"#1557b0":"#166534"}}>{r.type}</span></td>
              <td style={S.td}><AttBadge pct={r.pct}/></td>
              <td style={{...S.td,color:"#64748b"}}>{r.present}/{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PctBar({ label, pct, sessions }) {
  if (pct === null) return (
    <div style={{flex:1,background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
      <span style={{fontSize:11,color:"#94a3b8"}}>{label}: no data</span>
    </div>
  );
  const color = pct>=70?"#6DBE45":pct>=50?"#f59e0b":"#ea4335";
  return (
    <div style={{flex:1,background:"#f8fafc",borderRadius:10,padding:"8px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color}}>{pct}%</span>
      </div>
      <div style={{height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:color,borderRadius:99}}/>
      </div>
      <span style={{fontSize:10,color:"#94a3b8"}}>{sessions} sessions</span>
    </div>
  );
}

function PctRow({ label, pct }) {
  const color = pct>=70?"#6DBE45":pct>=50?"#f59e0b":"#ea4335";
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{label}</span>
        <span style={{fontSize:13,fontWeight:700,color}}>{pct}%</span>
      </div>
      <div style={{height:7,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:color,borderRadius:99,transition:"width .5s"}}/>
      </div>
    </div>
  );
}

function AttBadge({ pct }) {
  const color = pct>=70?"#166534":pct>=50?"#92400e":"#c62828";
  const bg    = pct>=70?"#f0fdf4":pct>=50?"#fffbeb":"#fef2f2";
  return <span style={{background:bg,color,padding:"3px 10px",borderRadius:99,fontSize:12,fontWeight:700}}>{pct}%</span>;
}

function KPICard({ icon, label, value, color, bg }) {
  return (
    <div style={{background:bg,borderRadius:16,padding:"18px 16px",textAlign:"center"}} className="fade-up">
      <span style={{fontSize:24,display:"block",marginBottom:8}}>{icon}</span>
      <div style={{fontSize:28,fontWeight:800,color}}>{value}</div>
      <div style={{fontSize:12,color:"#64748b",fontWeight:600,marginTop:3}}>{label}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{padding:"4rem",textAlign:"center"}}>
      <div style={{width:40,height:40,border:"3px solid #e2e8f0",borderTopColor:"#ea4335",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
      <p style={{color:"#64748b"}}>Loading dashboard…</p>
    </div>
  );
}

function Th({ children, w }) { return <th style={{...S.th,...(w?{width:w}:{})}}>{children}</th>; }

const S = {
  header:     {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12},
  title:      {fontSize:24,fontWeight:800,color:"#1e293b"},
  sub:        {fontSize:13,color:"#64748b",marginTop:2},
  refreshBtn: {padding:"8px 16px",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"},
  kpiGrid:    {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16},
  atRiskBanner:{display:"flex",alignItems:"center",gap:14,background:"#fef3c7",border:"1px solid #fde68a",borderRadius:14,padding:"14px 18px",marginBottom:16,color:"#92400e"},
  atRiskBtn:  {marginLeft:"auto",padding:"7px 14px",background:"#ea4335",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},
  tabs:       {display:"flex",gap:4,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:16,flexWrap:"wrap"},
  tab:        {padding:"8px 16px",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,background:"transparent",color:"#64748b",fontWeight:500,display:"flex",alignItems:"center",gap:6},
  tabActive:  {background:"#fff",color:"#1e293b",fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"},
  tabBadge:   {background:"#ea4335",color:"#fff",borderRadius:99,padding:"1px 6px",fontSize:11,fontWeight:700},
  card:       {background:"#fff",borderRadius:20,padding:"1.25rem 1.5rem",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  cardTitle:  {fontSize:14,fontWeight:700,color:"#1e293b",marginBottom:14},
  subjectRow: {display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f8fafc"},
  subjectName:{fontSize:13,fontWeight:700,color:"#1e293b",width:110,flexShrink:0},
  table:      {width:"100%",borderCollapse:"collapse",fontSize:13},
  thead:      {background:"#f8fafc"},
  th:         {padding:"10px 14px",textAlign:"left",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",color:"#94a3b8",borderBottom:"1px solid #f1f5f9"},
  tr:         {borderBottom:"1px solid #f8fafc"},
  td:         {padding:"11px 14px",color:"#334155",verticalAlign:"middle"},
  code:       {background:"#f1f5f9",padding:"2px 7px",borderRadius:6,fontSize:11,fontFamily:"monospace",color:"#64748b"},
  pill:       {padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700},
};
