// src/pages/StudentsPage.jsx
import { useState, useEffect, useRef } from "react";
import { api } from "../utils/api";
import { useAuth } from "../hooks/useAuth";

export default function StudentsPage() {
  const { professor, pin } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [form,     setForm]     = useState({ id: "", name: "", email: "" });
  const [showForm, setShowForm] = useState(false);
  const [err,      setErr]      = useState("");
  const [saving,   setSaving]   = useState(false);
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
      if (!form.id || !form.name || !form.email.includes("@")) { setErr("All fields required, valid email."); setSaving(false); return; }
      if (students.find(s => String(s.id) === String(form.id))) { setErr("Student ID already exists."); setSaving(false); return; }
      await api.addStudent(professor.id, pin, { studentId: form.id, name: form.name, email: form.email });
      setForm({ id: "", name: "", email: "" });
      setShowForm(false);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Remove this student?")) return;
    await api.removeStudent(professor.id, pin, id);
    load();
  };

  // CSV/Excel import
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.split("\n").filter(Boolean);
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 3 && cols[0] && cols[1]) {
          parsed.push({ id: cols[0], name: cols[1], email: cols[2] || "" });
        }
      }
      if (!parsed.length) { alert("No valid rows found. Format: ID,Name,Email"); return; }
      try {
        await api.importStudents(professor.id, pin, parsed);
        load();
        alert(`✅ Imported ${parsed.length} students`);
      } catch (e) { alert("Import failed: " + e.message); }
    };
    reader.readAsText(file);
  };

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "1.5rem 0" }}>
      <h2 style={styles.heading}>Student roster</h2>
      <div style={styles.toolbar}>
        <input style={styles.search} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search students…" />
        <button style={styles.btnBlue} onClick={() => setShowForm(f => !f)}>+ Add student</button>
        <button style={styles.btnGray} onClick={() => fileRef.current.click()}>Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleImport} />
      </div>

      {showForm && (
        <form onSubmit={addStudent} style={styles.formCard}>
          <div style={styles.formRow}>
            <div style={styles.field}>
              <label style={styles.label}>Student ID</label>
              <input style={styles.input} value={form.id} onChange={e => setForm(f => ({...f, id: e.target.value}))} placeholder="e.g. 101" />
            </div>
            <div style={{ ...styles.field, flex: 2 }}>
              <label style={styles.label}>Full name</label>
              <input style={styles.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Student name" />
            </div>
            <div style={{ ...styles.field, flex: 2 }}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="student@college.edu" />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingBottom: 4 }}>
              <button style={styles.btnBlue} type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button style={styles.btnGray} type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
          {err && <p style={styles.err}>{err}</p>}
        </form>
      )}

      <div style={styles.tableWrap}>
        {loading ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#888" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "2rem", textAlign: "center", color: "#aaa" }}>No students found.</p>
        ) : (
          <table style={styles.table}>
            <thead><tr style={styles.thead}>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}></th>
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={styles.tr}>
                  <td style={styles.td}><code style={{ fontSize: 12 }}>{s.id}</code></td>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ ...styles.td, color: "#888", fontSize: 13 }}>{s.email}</td>
                  <td style={styles.td}>
                    <button onClick={() => remove(s.id)} style={styles.removeBtn} title="Remove">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
        {students.length} students total · CSV format: StudentID,Name,Email (one per row, header on row 1)
      </p>
    </div>
  );
}

const styles = {
  heading:   { fontSize: 20, fontWeight: 600, color: "#1a1a2e", marginBottom: "1rem" },
  toolbar:   { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" },
  search:    { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, width: 200 },
  btnBlue:   { padding: "8px 16px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnGray:   { padding: "8px 16px", background: "#f1f3f4", color: "#444", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  formCard:  { background: "#fff", border: "1px solid #e8eaf6", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 },
  formRow:   { display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" },
  field:     { display: "flex", flexDirection: "column", flex: 1, minWidth: 100 },
  label:     { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  input:     { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 },
  tableWrap: { background: "#fff", border: "1px solid #e8eaf6", borderRadius: 14, overflow: "hidden" },
  table:     { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead:     { background: "#f8f9fa" },
  th:        { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", borderBottom: "1px solid #eee" },
  tr:        { borderBottom: "1px solid #f0f0f0" },
  td:        { padding: "9px 12px", color: "#333" },
  removeBtn: { background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: "2px 6px", borderRadius: 4 },
  err:       { color: "#d32f2f", fontSize: 12, marginTop: 6 },
};
