// src/pages/AnalyticsPage.jsx
import { useState, useEffect } from "react";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const SUBJECTS = [
  {code:"ANAT",name:"Anatomy"},{code:"PHYS",name:"Physiology"},{code:"BIOC",name:"Biochemistry"},
  {code:"PHAR",name:"Pharmacology"},{code:"PATH",name:"Pathology"},{code:"MICR",name:"Microbiology"},
];

export default function AnalyticsPage() {
  const { user, pin } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [view,    setView]    = useState("day");
  const [subject, setSubject] = useState("ALL");
  const [type,    setType]    = useState("THEORY");

  useEffect(() => {
    api.getAttendance(user.id, pin)
      .then(d => setData(d)).catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id, pin]);

  if (loading) return <div style={{padding:"4rem",textAlign:"center",color:"#64748b"}}>Loading analytics…</div>;
  if (!data)   return <div style={{color:"#ea4335",padding:"2rem"}}>Could not load data.</div>;

  const { attendance, students } = data;

  // Get all dates for selected subject+type
  const key    = (subject === "ALL" ? Object.keys(attendance)[0] : subject+"|"+type) || "";
  const subAtt = attendance[key] || {};
  const dates  = Object.keys(subAtt).sort();

  // Overall pct per student across selected view
  const atRisk = students.filter(s => {
    const pres = dates.filter(d => subAtt[d]?.[s.id]).length;
    return dates.length >= 3 && Math.round(pres/dates.length*100) < 70;
  });

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Analytics</h2>
          <p style={S.sub}>Your subject attendance trends</p>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filters}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Subject</span>
          <div style={S.pills}>
            <button onClick={()=>setSubject("ALL")} style={{...S.pill,...(subject==="ALL"?S.pillActive:{})}}>All</button>
            {SUBJECTS.map(s => <button key={s.code} onClick={()=>setSubject(s.code)} style={{...S.pill,...(subject===s.code?S.pillActive:{})}}>{s.name}</button>)}
          </div>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Type</span>
          <div style={S.pills}>
            {["THEORY","LAB"].map(t => <button key={t} onClick={()=>setType(t)} style={{...S.pill,...(type===t?S.pillActive:{})}}>{t}</button>)}
          </div>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Period</span>
          <div style={S.pills}>
            {["day","week","month","semester"].map(v => <button key={v} onClick={()=>setView(v)} style={{...S.pill,...(view===v?S.pillActive:{})}}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>)}
          </div>
        </div>
      </div>

      {atRisk.length > 0 && (
        <div style={S.atRiskBanner}>
          ⚠️ <strong>{atRisk.length} students below 70%:</strong> {atRisk.map(s=>s.name).join(", ")}
        </div>
      )}

      {dates.length === 0 ? (
        <div style={S.empty}>
          <div style={{fontSize:44,marginBottom:12}}>📊</div>
          <p style={{fontWeight:700,color:"#1e293b",marginBottom:6}}>No data for this selection</p>
          <p style={{fontSize:13,color:"#64748b"}}>Take a session in this subject first.</p>
        </div>
      ) : (
        <div style={S.grid}>
          <StudentTable dates={dates} subAtt={subAtt} students={students} view={view} />
        </div>
      )}
    </div>
  );
}

function StudentTable({ dates, subAtt, students, view }) {
  const groups = groupDates(dates, view);
  const keys   = Object.keys(groups).reverse().slice(0,6);

  return (
    <div style={S.card}>
      <div style={{overflowX:"auto"}}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={{...S.th,width:60}}>Roll No.</th>
              <th style={S.th}>Name</th>
              <th style={{...S.th,width:80}}>Overall</th>
              {keys.map(k => <th key={k} style={{...S.th,width:90}}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((s,i) => {
              const overall = dates.length ? Math.round(dates.filter(d=>subAtt[d]?.[s.id]).length/dates.length*100) : 0;
              return (
                <tr key={s.id} style={S.tr}>
                  <td style={S.td}><code style={S.code}>{s.id}</code></td>
                  <td style={S.td}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{...S.avatar,background:COLORS[i%COLORS.length]+"22",color:COLORS[i%COLORS.length]}}>{s.name[0]}</div>
                      <span style={{fontWeight:600}}>{s.name}</span>
                    </div>
                  </td>
                  <td style={S.td}><Badge pct={overall}/></td>
                  {keys.map(k => {
                    const ds  = groups[k];
                    const prs = ds.filter(d=>subAtt[d]?.[s.id]).length;
                    const pct = ds.length ? Math.round(prs/ds.length*100) : null;
                    return <td key={k} style={S.td}>{pct!==null?<Badge pct={pct} small/>:<span style={{color:"#e2e8f0"}}>–</span>}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function groupDates(dates, view) {
  const g = {};
  dates.forEach(d => {
    let key;
    if (view==="day") { key=d; }
    else if (view==="week") {
      const dt=new Date(d); const mon=new Date(dt); const day=dt.getDay();
      mon.setDate(dt.getDate()-(day===0?6:day-1));
      key="Wk "+mon.toLocaleDateString("en-IN",{day:"2-digit",month:"short"});
    } else if (view==="month") {
      key=new Date(d).toLocaleDateString("en-IN",{month:"short",year:"numeric"});
    } else {
      key=new Date(d).getMonth()<6?"Sem I":"Sem II";
    }
    if (!g[key]) g[key]=[];
    g[key].push(d);
  });
  return g;
}

function Badge({pct,small}) {
  const color = pct>=70?"#166534":pct>=50?"#92400e":"#c62828";
  const bg    = pct>=70?"#f0fdf4":pct>=50?"#fffbeb":"#fef2f2";
  return <span style={{background:bg,color,padding:small?"2px 7px":"4px 10px",borderRadius:99,fontSize:small?11:12,fontWeight:700}}>{pct}%</span>;
}

const COLORS = ["#ea4335","#6DBE45","#1a73e8","#f59e0b","#7c3aed","#06b6d4"];

const S = {
  header:       {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  title:        {fontSize:24,fontWeight:800,color:"#1e293b"},
  sub:          {fontSize:13,color:"#64748b",marginTop:2},
  filters:      {background:"#fff",borderRadius:16,padding:"1rem 1.25rem",marginBottom:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",display:"flex",flexDirection:"column",gap:12},
  filterGroup:  {display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},
  filterLabel:  {fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",width:60,flexShrink:0},
  pills:        {display:"flex",gap:6,flexWrap:"wrap"},
  pill:         {padding:"5px 12px",border:"1.5px solid #e2e8f0",borderRadius:99,background:"#f8fafc",cursor:"pointer",fontSize:12,fontWeight:600,color:"#475569"},
  pillActive:   {background:"var(--dv-dark)",color:"#fff",border:"1.5px solid var(--dv-dark)"},
  atRiskBanner: {background:"#fef3c7",border:"1px solid #fde68a",borderRadius:12,padding:"12px 16px",fontSize:13,color:"#92400e",marginBottom:16,lineHeight:1.5},
  empty:        {background:"#fff",borderRadius:20,padding:"3rem",textAlign:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  grid:         {},
  card:         {background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  table:        {width:"100%",borderCollapse:"collapse",fontSize:13},
  thead:        {background:"#f8fafc"},
  th:           {padding:"11px 14px",textAlign:"left",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",color:"#94a3b8",borderBottom:"1px solid #f1f5f9"},
  tr:           {borderBottom:"1px solid #f8fafc"},
  td:           {padding:"11px 14px",color:"#334155",verticalAlign:"middle"},
  code:         {background:"#f1f5f9",padding:"2px 7px",borderRadius:6,fontSize:11,fontFamily:"monospace",color:"#64748b"},
  avatar:       {width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0},
};
