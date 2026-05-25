// src/components/Logo.jsx
export default function Logo({ size = "md", dark = false }) {
  const sizes = { sm: { icon: 24, text: 18 }, md: { icon: 32, text: 22 }, lg: { icon: 44, text: 30 } };
  const { icon, text } = sizes[size] || sizes.md;
  const textColor = dark ? "#fff" : "#1e293b";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: icon * 0.3 }}>
      {/* V-icon with heart */}
      <svg width={icon} height={icon} viewBox="0 0 44 44" fill="none">
        {/* Red heart/pin */}
        <path d="M15 8C15 8 8 12 8 19C8 23.4 11.6 27 16 27C18.2 27 20 25.8 20 25.8" fill="#ea4335"/>
        <circle cx="15" cy="10" r="6" fill="#ea4335"/>
        {/* Green V checkmark */}
        <path d="M18 24L28 8L38 24L33 24L28 16L23 24Z" fill="#6DBE45" opacity="0.9"/>
      </svg>
      {/* Text */}
      <span style={{ fontSize: text, fontWeight: 900, letterSpacing: "-0.5px", color: textColor, lineHeight: 1 }}>
        <span style={{ color: "#ea4335" }}>data</span>
        <span style={{ color: "#6DBE45" }}>vedha</span>
      </span>
    </div>
  );
}
