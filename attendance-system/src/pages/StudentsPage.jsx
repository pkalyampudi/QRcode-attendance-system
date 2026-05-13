// src/pages/StudentsPage.jsx
import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api.jsx";
import { useAuth } from "../hooks/useAuth.jsx";

export default function StudentsPage() {
  const { professor, pin } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [form,     setForm]     = useState({ id: "", name: "", email: "" });
  const [showForm, setShowForm] = useState(false);
  const [err,      setErr]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState("");
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    api.getStudents(professor.id, pin)
      .then(d => setStudents(d.students))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addStudent = async (e) => {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      if (!form.id || !form.name || !form.email.includes("@")) {
        setErr("All fields required. Email must be valid."); setSaving(false); return;
      }
      if (students.find(s => String(s.id) === String(form.id))) {
        setErr("Student ID already exists."); setSaving(false); return;
      }
      await api.addStudent(professor.id, pin, { studentId: form.id, name: form.name, email: form.email });
      setForm({ id: "", name: "", email: "" });
      setShowForm(false);
      setSuccess("Student added successfully!");
      setTimeout(() => setSuccess(""), 3000);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id, name) => {
    if (!confirm(`Remove ${name} from your roster?`)) return;
    await api.removeStudent(professor.id, pin, id);
    setSuccess(`${name} removed.`);
    setTimeout(() => setSuccess(""), 3000);
    load();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines  = ev.target.result.split("\n").filter(Boolean);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 2 && cols[0] && cols[1]) {
          parsed.push({ id: cols[0], name: cols[1], email: cols[2] || "" });
        }
      }
      if (!parsed.length) { alert("No valid rows. Format: StudentID,Name,Email"); return; }
      try {
        await api.importStudents(professor.id, pin, parsed);
        load();
        setSuccess(`✅ ${parsed.length} students imported!`);
        setTimeout(() => setSuccess(""), 4000);
      } catch (e) { alert("Import failed: " + e.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search) || (s.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const nextId = students.length ? Math.max(...students.map(s => Number(s.id))) + 1 : 1;

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.pageTitle}>Student Roster</h2>
          <p style={S.pageSub}>{students.length} students registered</p>
        </div>
        <div style={S.headerActions}>
          <button style={S.importBtn} onClick={() => fileRef.current.click()}>
            📥 Import CSV
          </button>
          <button style={S.addBtn} onClick={() => { setShowForm(f => !f); setForm({ id: String(nextId), name: "", email: "" }); setErr(""); }}>
            {showForm ? "✕ Cancel" : "+ Add Student"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      {/* Success toast */}
      {success && (
        <div style={S.successToast} className="fade-in">✅ {success}</div>
      )}

      {/* Import guide */}
      {students.length === 0 && !loading && (
        <div style={S.onboardCard} className="fade-in">
          <div style={S.onboardIcon}>👥</div>
          <h3 style={S.onboardTitle}>Add your students to get started</h3>
          <p style={S.onboardSub}>You can import them from a CSV file or add them one by one.</p>
          <div style={S.onboardOptions}>
            <div style={S.onboardOption}>
              <div style={S.onboardOptIcon}>📥</div>
              <div style={S.onboardOptTitle}>Import CSV (fastest)</div>
              <div style={S.onboardOptDesc}>Create a CSV with columns: StudentID, Name, Email — then click Import CSV above</div>
              <div style={S.csvExample}>
                <code>StudentID,Name,Email<br/>101,Ramesh Kumar,ramesh@med.edu<br/>102,Priya Sharma,priya@med.edu</code>
              </div>
            </div>
            <div style={S.onboardOption}>
              <div style={S.onboardOptIcon}>✏️</div>
              <div style={S.onboardOptTitle}>Add one by one</div>
              <div style={S.onboardOptDesc}>Click "Add Student" above and fill in each student's details manually</div>
            </div>
          </div>
        </div>
      )}

      {/* Add student form */}
      {showForm && (
        <div style={S.formCard} className="scale-in">
          <h3 style={S.formTitle}>Add new student</h3>
          <form onSubmit={addStudent}>
            <div style={S.formGrid}>
              <div style={S.fieldWrap}>
                <label style={S.label}>Student ID</label>
                <input style={S.input} value={form.id}
                  onChange={e => setForm(f => ({...f, id: e.target.value}))}
                  placeholder="e.g. 101" />
              </div>
              <div style={{ ...S.fieldWrap, flex: 2 }}>
                <label style={S.label}>Full name</label>
                <input style={S.input} value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="Student's full name" autoFocus />
              </div>
              <div style={{ ...S.fieldWrap, flex: 2 }}>
                <label style={S.label}>Email</label>
                <input style={S.input} type="email" value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="student@college.edu" />
              </div>
            </div>
            {err && <div style={S.errBox}>⚠️ {err}</div>}
            <div style={S.formActions}>
              <button style={S.saveBtn} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Student"}
              </button>
              <button style={S.cancelBtn} type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + table */}
      {students.length > 0 && (
        <div style={S.tableCard}>
          <div style={S.tableToolbar}>
            <div style={S.searchWrap}>
              <span style={S.searchIcon}>🔍</span>
              <input style={S.searchInput} value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID or email…" />
            </div>
            {search && (
              <span style={S.resultCount}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {loading ? (
            <div style={S.loadingRow}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={S.emptyRow}>No students match your search.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <Th w={50}>ID</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th w={60}></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={S.tr}>
                    <Td><code style={S.idCode}>{s.id}</code></Td>
                    <Td>
                      <div style={S.nameRow}>
                        <div style={{ ...S.avatar, background: AVATAR_COLORS[i % AVATAR_COLORS.length] + "22",
                          color: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                          {s.name.charAt(0)}
                        </div>
                        <span style={S.name}>{s.name}</span>
                      </div>
                    </Td>
                    <Td style={{ color: "#64748b", fontSize: 13 }}>{s.email}</Td>
                    <Td>
                      <button onClick={() => remove(s.id, s.name)} style={S.removeBtn} title="Remove student">
                        🗑️
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p style={S.hint}>
        CSV format: StudentID, Name, Email (first row = headers). Export your Excel file as CSV first.
      </p>
    </div>
  );
}

const AVATAR_COLORS = ["#1a73e8","#34a853","#ea4335","#f59e0b","#7c3aed","#06b6d4","#ec4899"];

function Th({ children, w }) {
  return <th style={{ ...S.th, ...(w ? { width: w } : {}) }}>{children}</th>;
}
function Td({ children, style: extra }) {
  return <td style={{ ...S.td, ...extra }}>{children}</td>;
}

const S = {
  page:           { padding: 0 },
  pageHeader:     { display: "flex", justifyContent: "space-between", alignItems: "center",
                    marginBottom: 20, flexWrap: "wrap", gap: 12 },
  pageTitle:      { fontSize: 24, fontWeight: 700, color: "#1e293b" },
  pageSub:        { fontSize: 14, color: "#64748b", marginTop: 2 },
  headerActions:  { display: "flex", gap: 10, alignItems: "center" },
  importBtn:      { padding: "9px 16px", background: "#fff", color: "#475569",
                    border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: "pointer" },
  addBtn:         { padding: "9px 18px", background: "#1a73e8", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 13,
                    fontWeight: 700, cursor: "pointer" },
  successToast:   { background: "#e8f5e9", border: "1px solid #a7f3d0", borderRadius: 12,
                    padding: "12px 16px", fontSize: 14, color: "#065f46",
                    fontWeight: 600, marginBottom: 16 },
  onboardCard:    { background: "#fff", borderRadius: 20, padding: "2.5rem",
                    textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    marginBottom: 20 },
  onboardIcon:    { fontSize: 48, marginBottom: 12 },
  onboardTitle:   { fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 8 },
  onboardSub:     { fontSize: 14, color: "#64748b", marginBottom: 24 },
  onboardOptions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "left" },
  onboardOption:  { background: "#f8fafc", borderRadius: 16, padding: "20px" },
  onboardOptIcon: { fontSize: 28, marginBottom: 8 },
  onboardOptTitle:{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 6 },
  onboardOptDesc: { fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 12 },
  csvExample:     { background: "#1e293b", borderRadius: 10, padding: "12px",
                    fontSize: 11, color: "#a5f3fc", lineHeight: 1.8, fontFamily: "monospace" },
  formCard:       { background: "#fff", borderRadius: 20, padding: "1.5rem",
                    marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" },
  formTitle:      { fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 },
  formGrid:       { display: "flex", gap: 12, flexWrap: "wrap" },
  fieldWrap:      { display: "flex", flexDirection: "column", flex: 1, minWidth: 120 },
  label:          { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 5 },
  input:          { padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                    fontSize: 14, outline: "none", background: "#f8fafc" },
  errBox:         { background: "#fef2f2", borderRadius: 10, padding: "10px 14px",
                    fontSize: 13, color: "#dc2626", marginTop: 10 },
  formActions:    { display: "flex", gap: 10, marginTop: 16 },
  saveBtn:        { padding: "10px 24px", background: "#1a73e8", color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  cancelBtn:      { padding: "10px 18px", background: "#f1f5f9", color: "#475569",
                    border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer" },
  tableCard:      { background: "#fff", borderRadius: 20, overflow: "hidden",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 12 },
  tableToolbar:   { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                    borderBottom: "1px solid #f1f5f9" },
  searchWrap:     { flex: 1, position: "relative" },
  searchIcon:     { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15 },
  searchInput:    { width: "100%", padding: "9px 12px 9px 36px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#f8fafc" },
  resultCount:    { fontSize: 13, color: "#64748b", whiteSpace: "nowrap" },
  loadingRow:     { padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: 14 },
  emptyRow:       { padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: 14 },
  table:          { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead:          { background: "#f8fafc" },
  th:             { padding: "11px 16px", textAlign: "left", fontWeight: 700, fontSize: 11,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    color: "#94a3b8", borderBottom: "1px solid #f1f5f9" },
  tr:             { borderBottom: "1px solid #f8fafc" },
  td:             { padding: "11px 16px", color: "#334155", verticalAlign: "middle" },
  idCode:         { background: "#f1f5f9", padding: "3px 8px", borderRadius: 6,
                    fontSize: 11, fontFamily: "monospace", color: "#64748b" },
  nameRow:        { display: "flex", alignItems: "center", gap: 10 },
  avatar:         { width: 32, height: 32, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0 },
  name:           { fontWeight: 600, color: "#1e293b" },
  removeBtn:      { background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, opacity: 0.5, padding: "4px 6px", borderRadius: 6 },
  hint:           { fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 },
};
