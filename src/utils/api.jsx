// src/utils/api.jsx
const API_URL = import.meta.env.VITE_API_URL || "YOUR_APPS_SCRIPT_URL";

async function call(action, payload = {}, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify({ action, ...payload }),
        signal:  controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "API error");
      return data;
    } catch(e) {
      lastError = e;
      if (attempt < retries) {
        // Wait longer between each retry: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }
  throw lastError;
}
export const api = {
  login:            (id, pin)                => call("login",            { id, pin }),
  registerProfessor:(prof)                   => call("registerProfessor", prof),
  getSubjects:      ()                       => call("getSubjects",       {}),
  createSession:    (userId, pin, opts)      => call("createSession",    { userId, pin, ...opts }),
  getActiveSession: (userId, pin)            => call("getActiveSession", { userId, pin }),
  submitSession:    (userId, pin, sessionId) => call("submitSession",    { userId, pin, sessionId }),
  recordScan: (token, studentId, deviceId)   => call("recordScan", { token, studentId, deviceId }, 5), // 5 retries for scan
  getStudents:      (userId, pin, role)      => call("getStudents",      { userId, pin, role }),
  addStudent:       (userId, pin, s)         => call("addStudent",       { userId, pin, ...s }),
  removeStudent:    (userId, pin, studentId) => call("removeStudent",    { userId, pin, studentId }),
  importStudents:   (userId, pin, students)  => call("importStudents",   { userId, pin, students }),
  getAttendance:    (userId, pin)            => call("getAttendance",    { userId, pin }),
  getHODDashboard:  (userId, pin)            => call("getHODDashboard",  { userId, pin }),
  getStudentReport: (userId, pin, studentId) => call("getStudentReport", { userId, pin, studentId }),
};

export function getDeviceId() {
  let id = localStorage.getItem("dv_device_id");
  if (!id) {
    const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()].join("|");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) { hash = (hash << 5) - hash + raw.charCodeAt(i); hash |= 0; }
    id = "DV-" + Math.abs(hash).toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("dv_device_id", id);
  }
  return id;
}
