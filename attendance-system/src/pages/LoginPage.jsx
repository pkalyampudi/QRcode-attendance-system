// src/pages/LoginPage.jsx
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [id,  setId]  = useState("");
  const [pin, setPin] = useState("");
  const [focused, setFocused] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(id.trim(), pin.trim());
  };

  return (
    <div style={S.page}>
      {/* Left panel — branding */}
      <div style={S.left}>
        <div style={S.leftInner}>
          <div style={S.logoWrap}>
            <span style={S.logoIcon}>🏥</span>
          </div>
          <h1 style={S.appName}>AttendEase</h1>
          <p style={S.tagline}>Smart attendance for medical education</p>

          <div style={S.featureList}>
            {[
              { icon: "📱", text: "Students scan QR — no paper needed" },
              { icon: "🔒", text: "Proxy-proof with device fingerprinting" },
              { icon: "📧", text: "Auto email report after every class" },
              { icon: "📊", text: "Week, month & semester analytics" },
            ].map((f, i) => (
              <div key={i} style={{ ...S.feature, animationDelay: `${i * 0.1}s` }} className="fade-in">
                <span style={S.featureIcon}>{f.icon}</span>
                <span style={S.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={S.right}>
        <div style={S.formCard} className="scale-in">
          {/* Welcome header */}
          <div style={S.welcomeHeader}>
            <div style={S.welcomeAvatar}>👨‍⚕️</div>
            <h2 style={S.welcomeTitle}>Welcome back, Professor</h2>
            <p style={S.welcomeSub}>Sign in to manage your class attendance</p>
          </div>

          {/* How it works steps */}
          <div style={S.stepsBox}>
            <p style={S.stepsTitle}>How today's class works</p>
            <div style={S.steps}>
              {[
                { n: "1", text: "Sign in below" },
                { n: "2", text: "Generate QR code" },
                { n: "3", text: "Show QR to students" },
                { n: "4", text: "Submit → get email report" },
              ].map(s => (
                <div key={s.n} style={S.step}>
                  <div style={S.stepNum}>{s.n}</div>
                  <span style={S.stepText}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Professor ID */}
            <div style={S.fieldWrap}>
              <label style={S.label}>Professor ID</label>
              <div style={{ position: "relative" }}>
                <span style={S.inputIcon}>🪪</span>
                <input
                  style={{ ...S.input, ...(focused === "id" ? S.inputFocus : {}) }}
                  value={id}
                  onChange={e => setId(e.target.value)}
                  onFocus={() => setFocused("id")}
                  onBlur={() => setFocused("")}
                  placeholder="e.g. 12345"
                  required autoFocus
                />
              </div>
            </div>

            {/* PIN */}
            <div style={S.fieldWrap}>
              <label style={S.label}>Your PIN</label>
              <div style={{ position: "relative" }}>
                <span style={S.inputIcon}>🔑</span>
                <input
                  style={{ ...S.input, ...(focused === "pin" ? S.inputFocus : {}) }}
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onFocus={() => setFocused("pin")}
                  onBlur={() => setFocused("")}
                  placeholder="4-digit PIN"
                  required
                />
              </div>
            </div>

            {error && (
              <div style={S.errorBox}>
                ⚠️ {error}
              </div>
            )}

            <button style={S.submitBtn} type="submit" disabled={loading}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span style={S.spinner} /> Signing in…
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          <p style={S.hint}>
            First time? Ask your admin to register your account using the setup script.
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:         { display: "flex", minHeight: "100vh" },
  left:         { flex: 1, background: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "2rem", color: "#fff" },
  leftInner:    { maxWidth: 400 },
  logoWrap:     { width: 72, height: 72, background: "rgba(255,255,255,0.15)",
                  borderRadius: 20, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 36, marginBottom: 20 },
  logoIcon:     {},
  appName:      { fontSize: 36, fontWeight: 700, color: "#fff", marginBottom: 8 },
  tagline:      { fontSize: 16, color: "rgba(255,255,255,0.75)", marginBottom: 40, lineHeight: 1.5 },
  featureList:  { display: "flex", flexDirection: "column", gap: 16 },
  feature:      { display: "flex", alignItems: "center", gap: 14,
                  background: "rgba(255,255,255,0.1)", borderRadius: 12,
                  padding: "12px 16px" },
  featureIcon:  { fontSize: 22, flexShrink: 0 },
  featureText:  { fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 500 },
  right:        { flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "2rem", background: "#f8fafc" },
  formCard:     { background: "#fff", borderRadius: 24, padding: "2.5rem",
                  width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.1)" },
  welcomeHeader:{ textAlign: "center", marginBottom: 24 },
  welcomeAvatar:{ fontSize: 48, marginBottom: 12 },
  welcomeTitle: { fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
  welcomeSub:   { fontSize: 14, color: "#64748b" },
  stepsBox:     { background: "#f8fafc", borderRadius: 14, padding: "16px", marginBottom: 24 },
  stepsTitle:   { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 12 },
  steps:        { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  step:         { display: "flex", alignItems: "center", gap: 8 },
  stepNum:      { width: 22, height: 22, borderRadius: "50%", background: "#1a73e8",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepText:     { fontSize: 12, color: "#475569", fontWeight: 500 },
  fieldWrap:    { marginBottom: 16 },
  label:        { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 },
  inputIcon:    { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16 },
  input:        { width: "100%", padding: "11px 12px 11px 40px", borderRadius: 10,
                  border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
                  background: "#f8fafc", transition: "border-color .2s, background .2s" },
  inputFocus:   { borderColor: "#1a73e8", background: "#fff", boxShadow: "0 0 0 3px rgba(26,115,232,0.1)" },
  errorBox:     { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
                  padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 },
  submitBtn:    { width: "100%", padding: "13px", background: "#1a73e8", color: "#fff",
                  border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
                  cursor: "pointer", transition: "background .2s", marginTop: 4 },
  hint:         { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 20, lineHeight: 1.5 },
  spinner:      { width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite",
                  display: "inline-block" },
};
