// src/pages/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth.jsx";
import Logo from "../components/Logo.jsx";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [id,  setId]  = useState("");
  const [pin, setPin] = useState("");

  return (
    <div style={S.page}>
      <div style={S.left}>
        <div style={S.leftInner}>
          <Logo size="lg" dark />
          <p style={S.tagline}>Smart attendance management for medical colleges</p>
          <div style={S.features}>
            {[
              ["📋","6 subjects × theory + lab tracked separately"],
              ["🔒","Proxy-proof QR with device fingerprinting"],
              ["📊","HOD dashboard with full KPI visibility"],
              ["📧","Auto email alerts for at-risk students"],
              ["🏷️","Lab batch A–G and joining year analytics"],
            ].map(([icon, text], i) => (
              <div key={i} style={S.feature} className="fade-up" style={{ ...S.feature, animationDelay: i * 0.08 + "s" }}>
                <span style={S.featureIcon}>{icon}</span>
                <span style={S.featureText}>{text}</span>
              </div>
            ))}
          </div>
          <div style={S.poweredBy}>Powered by <span style={{ color: "#ea4335" }}>data</span><span style={{ color: "#6DBE45" }}>vedha</span></div>
        </div>
      </div>

      <div style={S.right}>
        <div style={S.card} className="fade-up">
          <div style={S.cardTop}>
            <div style={S.cardIcon}>🏥</div>
            <h2 style={S.cardTitle}>Welcome back</h2>
            <p style={S.cardSub}>Sign in to your attendance dashboard</p>
          </div>

          <div style={S.stepsRow}>
            {["Sign in","Open subject","Show QR","Submit"].map((s, i) => (
              <div key={i} style={S.stepItem}>
                <div style={S.stepNum}>{i + 1}</div>
                <div style={S.stepLabel}>{s}</div>
              </div>
            ))}
          </div>

          <form onSubmit={async e => { e.preventDefault(); await login(id.trim(), pin.trim()); }}>
            <div style={S.field}>
              <label style={S.label}>Staff ID</label>
              <input style={S.input} value={id} onChange={e => setId(e.target.value)} placeholder="e.g. 12345" required autoFocus />
            </div>
            <div style={S.field}>
              <label style={S.label}>PIN</label>
              <input style={S.input} type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Your PIN" required />
            </div>
            {error && <div style={S.error}>⚠️ {error}</div>}
            <button style={S.btn} type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>
          <p style={S.hint}>Contact admin to register your account or reset PIN</p>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:       { display:"flex", minHeight:"100vh" },
  left:       { flex:1, background:"var(--dv-dark)", display:"flex", alignItems:"center", justifyContent:"center", padding:"2.5rem" },
  leftInner:  { maxWidth:420, color:"#fff" },
  tagline:    { fontSize:15, color:"rgba(255,255,255,0.6)", margin:"16px 0 32px", lineHeight:1.6 },
  features:   { display:"flex", flexDirection:"column", gap:10 },
  feature:    { display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"12px 16px" },
  featureIcon:{ fontSize:20, flexShrink:0 },
  featureText:{ fontSize:13, color:"rgba(255,255,255,0.85)", fontWeight:500 },
  poweredBy:  { marginTop:32, fontSize:13, color:"rgba(255,255,255,0.35)", fontWeight:600 },
  right:      { flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", background:"#f8fafc" },
  card:       { background:"#fff", borderRadius:24, padding:"2.5rem 2rem", width:"100%", maxWidth:420, boxShadow:"0 8px 40px rgba(0,0,0,0.1)" },
  cardTop:    { textAlign:"center", marginBottom:24 },
  cardIcon:   { fontSize:44, marginBottom:10 },
  cardTitle:  { fontSize:22, fontWeight:800, color:"#1e293b", marginBottom:4 },
  cardSub:    { fontSize:14, color:"#64748b" },
  stepsRow:   { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, background:"#f8fafc", borderRadius:14, padding:14, marginBottom:24 },
  stepItem:   { textAlign:"center" },
  stepNum:    { width:24, height:24, borderRadius:"50%", background:"var(--dv-dark)", color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 4px" },
  stepLabel:  { fontSize:11, color:"#64748b", fontWeight:600 },
  field:      { marginBottom:16 },
  label:      { fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 },
  input:      { width:"100%", padding:"11px 14px", border:"1.5px solid #e2e8f0", borderRadius:10, fontSize:14, outline:"none", background:"#f8fafc" },
  error:      { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:12 },
  btn:        { width:"100%", padding:13, background:"var(--dv-dark)", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 },
  hint:       { fontSize:12, color:"#94a3b8", textAlign:"center", marginTop:16 },
};
