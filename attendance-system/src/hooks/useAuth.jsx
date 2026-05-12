// src/hooks/useAuth.js
import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [professor, setProfessor] = useState(() => {
    try { return JSON.parse(localStorage.getItem("att_prof") || "null"); } catch { return null; }
  });
  const [pin, setPin] = useState(() => localStorage.getItem("att_pin") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useCallback(async (id, p) => {
    setLoading(true); setError("");
    try {
      const data = await api.login(id, p);
      setProfessor(data.professor);
      setPin(p);
      localStorage.setItem("att_prof", JSON.stringify(data.professor));
      localStorage.setItem("att_pin", p);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    setProfessor(null); setPin("");
    localStorage.removeItem("att_prof");
    localStorage.removeItem("att_pin");
  }, []);

  return (
    <AuthContext.Provider value={{ professor, pin, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);