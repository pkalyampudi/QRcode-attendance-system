// src/hooks/useAuth.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "../utils/api.jsx";

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MINS = 30;

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => { try { return JSON.parse(localStorage.getItem("dv_user") || "null"); } catch { return null; } });
  const [pin,     setPin]     = useState(() => localStorage.getItem("dv_pin") || "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [showTimeout, setShowTimeout] = useState(false);

  // Session timeout — auto logout after 30 mins of inactivity
  useEffect(() => {
    if (!user) return;
    let timeoutId;
    let warningId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      // Show warning at 25 mins
      warningId = setTimeout(() => {
        setShowTimeout(true);
      }, (SESSION_TIMEOUT_MINS - 5) * 60 * 1000);
      // Auto logout at 30 mins
      timeoutId = setTimeout(() => {
        doLogout(true);
      }, SESSION_TIMEOUT_MINS * 60 * 1000);
    };

    const events = ["mousedown","mousemove","keydown","scroll","touchstart","click"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  const login = useCallback(async (id, p) => {
    setLoading(true); setError("");
    try {
      const data = await api.login(id, p);
      setUser(data.user); setPin(p);
      setShowTimeout(false);
      localStorage.setItem("dv_user", JSON.stringify(data.user));
      localStorage.setItem("dv_pin", p);
      localStorage.setItem("dv_login_time", Date.now().toString());
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, []);

  const doLogout = useCallback((timedOut = false) => {
    setUser(null); setPin(""); setShowTimeout(false);
    localStorage.removeItem("dv_user");
    localStorage.removeItem("dv_pin");
    localStorage.removeItem("dv_login_time");
    if (timedOut) {
      localStorage.setItem("dv_timed_out", "1");
    }
  }, []);

  const logout = useCallback(() => doLogout(false), [doLogout]);

  return (
    <AuthContext.Provider value={{ user, pin, loading, error, login, logout, showTimeout, setShowTimeout, doLogout }}>
      {showTimeout && user && (
        <TimeoutWarning
          onStay={() => { setShowTimeout(false); }}
          onLogout={() => doLogout(true)}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

function TimeoutWarning({ onStay, onLogout }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"2rem", maxWidth:380, width:"90%", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>⏰</div>
        <h3 style={{ fontSize:20, fontWeight:800, color:"#1e293b", marginBottom:8 }}>Session expiring soon</h3>
        <p style={{ fontSize:14, color:"#64748b", marginBottom:24, lineHeight:1.5 }}>
          You'll be automatically signed out in 5 minutes due to inactivity.
        </p>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onLogout} style={{ flex:1, padding:"11px", background:"#f1f5f9", color:"#475569", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer" }}>
            Sign out now
          </button>
          <button onClick={onStay} style={{ flex:1, padding:"11px", background:"#1a1a2e", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer" }}>
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}

export const useAuth = () => useContext(AuthContext);
