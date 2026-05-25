// src/hooks/useAuth.jsx
import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../utils/api.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => { try { return JSON.parse(localStorage.getItem("dv_user") || "null"); } catch { return null; } });
  const [pin,     setPin]     = useState(() => localStorage.getItem("dv_pin") || "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const login = useCallback(async (id, p) => {
    setLoading(true); setError("");
    try {
      const data = await api.login(id, p);
      setUser(data.user); setPin(p);
      localStorage.setItem("dv_user", JSON.stringify(data.user));
      localStorage.setItem("dv_pin", p);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    setUser(null); setPin("");
    localStorage.removeItem("dv_user");
    localStorage.removeItem("dv_pin");
  }, []);

  return (
    <AuthContext.Provider value={{ user, pin, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
