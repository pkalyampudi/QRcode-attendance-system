// src/pages/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [id,  setId]  = useState("");
  const [pin, setPin] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(id.trim(), pin.trim());
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.icon}>📋</div>
        <h1 style={styles.title}>Attendance System</h1>
        <p style={styles.sub}>Medical College · Physiology Dept</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Professor ID</label>
          <input style={styles.input} value={id} onChange={e => setId(e.target.value)}
            placeholder="e.g. 12345" required autoFocus />
          <label style={styles.label}>PIN</label>
          <input style={styles.input} type="password" value={pin} onChange={e => setPin(e.target.value)}
            placeholder="4-digit PIN" required />
          {error && <p style={styles.err}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={styles.hint}>First time? Ask admin to register your account.</p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0f4ff", padding: "1rem" },
  card: { background: "#fff", borderRadius: 16, padding: "2.5rem 2rem", width: "100%", maxWidth: 380,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)", textAlign: "center" },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 600, color: "#1a1a2e", margin: "0 0 4px" },
  sub: { fontSize: 13, color: "#888", margin: "0 0 24px" },
  form: { textAlign: "left" },
  label: { fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 4 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd",
    fontSize: 14, marginBottom: 16, boxSizing: "border-box", outline: "none" },
  btn: { width: "100%", padding: "11px", background: "#1a73e8", color: "#fff", border: "none",
    borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  err: { color: "#d32f2f", fontSize: 13, margin: "-8px 0 12px" },
  hint: { fontSize: 12, color: "#aaa", marginTop: 20 },
};
