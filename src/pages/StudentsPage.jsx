// src/pages/StudentsPage.jsx
import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

const LAB_BATCHES    = ["A","B","C","D","E","F","G"];
const JOINING_BATCHES = ["2024-25","2025-26","2026-27"];
const COLORS = ["#ea4335","#6DBE45","#1a73e8","#f59e0b","#7c3aed","#06b6d4","#ec4899"];

export default function StudentsPage() {
  const { user, pin } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filterBatch, setFilterBatch] = useState("ALL");
  const [filterJoin,  setFilterJoin]  = useState("ALL");
  const [form,  setForm]  = useState({ id:"", name:"", email:"", joiningBatch:"2024-25", labBatch:"A" });
  const [err,   setErr]   = useState("");
  const [toast, setToast] = useState("");
  const [saving,setSaving]= useState(false);
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    api.getStudents(user.id, pin, user.role)
      .then(d => setStudents(d.students || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3000); };

  const save = async (e) => {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      if (!form.id||!form.name) { setErr("ID and Name required."); setSaving(false); return; }
      if (students.find(s=>String(s.id)===String(form.id))) { setErr("Roll number already exists."); setSaving(false); return; }
      await api.addStudent(user.id, pin, { studentId:form.id, name:form.name, email:form.email, joiningBatch:form.joiningBatch, labBatch:form.labBatch });
      setForm({id:"",name:"",email:"",joiningBatch:"2024-25",labBatch:"A"});
      setShowForm(false);
      showToast("Student added!");
      load();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id, name) => {
    if (!confirm("Remove "+name+"?")) return;
    await api.removeStudent(user.id, pin, id);
    showToast(name+" removed.");
    load();
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines  = ev.target.result.split("\n").filter(Boolean);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c=>c.trim().replace(/^"|"$/g,""));
        if (cols[0]&&cols[1]) parsed.push({ id:cols[0], name:cols[1], email:cols[2]||"", joiningBatch:cols[3]||"2024-25", labBatch:cols[4]||"A" });
      }
      if (!parsed.length) { alert("No valid rows. Format: RollNo,Name,Email,JoiningBatch,LabBatch"); return; }
      try {
        await api.importStudents(user.id, pin, parsed);
        load(); showToast("✅ "+parsed.length+" students imported!");
      } catch(e) { alert("Import failed: "+e.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = students.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !String(s.id).includes(search) && !(s.email||"").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterBatch!=="ALL" && s.labBatch!==filterBatch) return false;
    if (filterJoin!=="ALL"  && s.joiningBatch!==filterJoin) return false;
    return true;
  });

  const nextId = students.length ? Math.max(...students.map(s=>Number(s.id)||0))+1 : 101;

  return (
    <div>
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Students</h2>
          <p style={S.sub}>{students.length} registered</p>
        </div>
        <div style={S.actions}>
          <button style={S.importBtn} onClick={()=>fileRef.current.click()}>📥 Import CSV</button>
          <button style={S.addBtn} onClick={()=>{setShowForm(f=>!f);setForm({id:String(nextId),name:"",email:"",joiningBatch:"2024-25",labBatch:"A"});setErr("");}}>
            {showForm?"✕ Cancel":"+ Add student"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:"none"}} onChange={handleImport}/>
        </div>
      </div>

      {toast && <div style={S.toast} className="fade-up">✅ {toast}</div>}

      {/* Empty state */}
      {students.length===0 && !loading && (
        <div style={S.emptyCard} className="fade-up">
          <div style={{fontSize:44,marginBottom:12}}>👥</div>
          <h3 style={S.emptyTitle}>Add your students</h3>
          <p style={S.emptySub}>Import a CSV or add manually. CSV format:</p>
          <div style={S.csvBox}>
            <code>RollNo,Name,Email,JoiningBatch,LabBatch<br/>
101,Ramesh Kumar,ramesh@med.edu,2024-25,A<br/>
102,Priya Sharma,priya@med.edu,2024-25,B</code>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={S.formCard} className="fade-up">
          <h3 style={S.formTitle}>Add new student</h3>
          <form onSubmit={save}>
            <div style={S.formGrid}>
              <Field label="Roll No." value={form.id} onChange={v=>setForm(f=>({...f,id:v}))} placeholder="101"/>
              <Field label="Full name" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Student name" flex={2}/>
              <Field label="Email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="email@med.edu" flex={2}/>
            </div>
            <div style={S.formGrid}>
              <div style={S.fieldWrap}>
                <label style={S.label}>Joining batch</label>
                <select style={S.select} value={form.joiningBatch} onChange={e=>setForm(f=>({...f,joiningBatch:e.target.value}))}>
                  {JOINING_BATCHES.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
              <div style={S.fieldWrap}>
                <label style={S.label}>Lab batch</label>
                <select style={S.select} value={form.labBatch} onChange={e=>setForm(f=>({...f,labBatch:e.target.value}))}>
                  {LAB_BATCHES.map(b=><option key={b}>Batch {b}</option>)}
                </select>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:8,paddingBottom:2}}>
                <button style={S.saveBtn} type="submit" disabled={saving}>{saving?"Saving…":"Save"}</button>
                <button style={S.cancelBtn} type="button" onClick={()=>setShowForm(false)}>Cancel</button>
              </div>
            </div>
            {err && <div style={S.err}>⚠️ {err}</div>}
          </form>
        </div>
      )}

      {/* Filters + Table */}
      {students.length > 0 && (
        <div style={S.tableCard}>
          <div style={S.toolbar}>
            <div style={S.searchWrap}>
              <span style={S.searchIcon}>🔍</span>
              <input style={S.searchInput} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, roll no, email…"/>
            </div>
            <select style={S.filterSelect} value={filterBatch} onChange={e=>setFilterBatch(e.target.value)}>
              <option value="ALL">All lab batches</option>
              {LAB_BATCHES.map(b=><option key={b} value={b}>Batch {b}</option>)}
            </select>
            <select style={S.filterSelect} value={filterJoin} onChange={e=>setFilterJoin(e.target.value)}>
              <option value="ALL">All joining years</option>
              {JOINING_BATCHES.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <span style={S.count}>{filtered.length} shown</span>
          </div>

          {loading ? (
            <div style={{padding:"2rem",textAlign:"center",color:"#94a3b8"}}>Loading…</div>
          ) : filtered.length===0 ? (
            <div style={{padding:"2rem",textAlign:"center",color:"#94a3b8"}}>No students match filters.</div>
          ) : (
            <table style={S.table}>
              <thead><tr style={S.thead}>
                <th style={{...S.th,width:70}}>Roll No.</th>
                <th style={S.th}>Name</th>
                <th style={S.th}>Email</th>
                <th style={{...S.th,width:90}}>Joining</th>
                <th style={{...S.th,width:80}}>Lab batch</th>
                <th style={{...S.th,width:50}}></th>
              </tr></thead>
              <tbody>
                {filtered.map((s,i)=>(
                  <tr key={s.id} style={S.tr}>
                    <td style={S.td}><code style={S.code}>{s.id}</code></td>
                    <td style={S.td}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:COLORS[i%COLORS.length]+"22",color:COLORS[i%COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0}}>{s.name[0]}</div>
                        <span style={{fontWeight:600,color:"#1e293b"}}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{...S.td,color:"#64748b",fontSize:12}}>{s.email||"—"}</td>
                    <td style={S.td}><span style={{background:"#e8f0fe",color:"#1557b0",padding:"3px 9px",borderRadius:99,fontSize:11,fontWeight:700}}>{s.joiningBatch||"—"}</span></td>
                    <td style={S.td}><span style={{background:"#fef3c7",color:"#92400e",padding:"3px 9px",borderRadius:99,fontSize:12,fontWeight:700}}>Batch {s.labBatch||"—"}</span></td>
                    <td style={S.td}><button onClick={()=>remove(s.id,s.name)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:"#cbd5e1",padding:"2px 4px"}} title="Remove">🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <p style={{fontSize:12,color:"#94a3b8",marginTop:8}}>CSV format: RollNo, Name, Email, JoiningBatch (2024-25), LabBatch (A–G)</p>
    </div>
  );
}

function Field({label,value,onChange,placeholder,flex=1}) {
  return (
    <div style={{display:"flex",flexDirection:"column",flex,minWidth:100}}>
      <label style={S.label}>{label}</label>
      <input style={S.input} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
    </div>
  );
}

const S = {
  header:      {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12},
  title:       {fontSize:24,fontWeight:800,color:"#1e293b"},
  sub:         {fontSize:13,color:"#64748b",marginTop:2},
  actions:     {display:"flex",gap:10},
  importBtn:   {padding:"9px 16px",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"},
  addBtn:      {padding:"9px 18px",background:"var(--dv-dark)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
  toast:       {background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:12,padding:"12px 16px",fontSize:14,color:"#166534",fontWeight:600,marginBottom:16},
  emptyCard:   {background:"#fff",borderRadius:20,padding:"2.5rem",textAlign:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:20},
  emptyTitle:  {fontSize:20,fontWeight:700,color:"#1e293b",marginBottom:8},
  emptySub:    {fontSize:14,color:"#64748b",marginBottom:14},
  csvBox:      {background:"#1e293b",borderRadius:12,padding:14,fontSize:12,color:"#a5f3fc",lineHeight:1.8,fontFamily:"monospace",textAlign:"left",display:"inline-block"},
  formCard:    {background:"#fff",borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:16,boxShadow:"0 4px 20px rgba(0,0,0,0.08)"},
  formTitle:   {fontSize:15,fontWeight:700,color:"#1e293b",marginBottom:14},
  formGrid:    {display:"flex",gap:12,flexWrap:"wrap",marginBottom:10},
  fieldWrap:   {display:"flex",flexDirection:"column",flex:1,minWidth:100},
  label:       {fontSize:12,fontWeight:700,color:"#374151",marginBottom:5},
  input:       {padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:14,outline:"none",background:"#f8fafc"},
  select:      {padding:"9px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,background:"#f8fafc",cursor:"pointer"},
  saveBtn:     {padding:"10px 22px",background:"var(--dv-dark)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"},
  cancelBtn:   {padding:"10px 16px",background:"#f1f5f9",color:"#475569",border:"none",borderRadius:10,fontSize:14,cursor:"pointer"},
  err:         {background:"#fef2f2",borderRadius:10,padding:"10px",fontSize:13,color:"#dc2626",marginTop:8},
  tableCard:   {background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"},
  toolbar:     {display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1px solid #f1f5f9",flexWrap:"wrap"},
  searchWrap:  {flex:1,position:"relative",minWidth:180},
  searchIcon:  {position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14},
  searchInput: {width:"100%",padding:"8px 12px 8px 32px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,outline:"none",background:"#f8fafc"},
  filterSelect:{padding:"8px 12px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:13,background:"#fff",cursor:"pointer"},
  count:       {fontSize:12,color:"#94a3b8",whiteSpace:"nowrap"},
  table:       {width:"100%",borderCollapse:"collapse",fontSize:13},
  thead:       {background:"#f8fafc"},
  th:          {padding:"11px 16px",textAlign:"left",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",color:"#94a3b8",borderBottom:"1px solid #f1f5f9"},
  tr:          {borderBottom:"1px solid #f8fafc"},
  td:          {padding:"11px 16px",color:"#334155",verticalAlign:"middle"},
  code:        {background:"#f1f5f9",padding:"3px 8px",borderRadius:6,fontSize:11,fontFamily:"monospace",color:"#64748b"},
};
