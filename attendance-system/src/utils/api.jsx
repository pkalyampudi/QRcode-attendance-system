// src/utils/api.js
// Replace with your deployed Apps Script Web App URL after Step 4

const API_URL = import.meta.env.VITE_API_URL || "YOUR_APPS_SCRIPT_WEB_APP_URL";

async function call(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

export const api = {
  // Auth
  login:             (professorId, pin)         => call("login",            { professorId, pin }),

  // Sessions
  createSession:     (professorId, pin)         => call("createSession",    { professorId, pin }),
  getActiveSession:  (professorId, pin)         => call("getActiveSession", { professorId, pin }),
  submitSession:     (professorId, pin, sid)    => call("submitSession",    { professorId, pin, sessionId: sid }),

  // Students
  getStudents:       (professorId, pin)         => call("getStudents",      { professorId, pin }),
  addStudent:        (professorId, pin, s)      => call("addStudent",       { professorId, pin, ...s }),
  removeStudent:     (professorId, pin, id)     => call("removeStudent",    { professorId, pin, studentId: id }),
  importStudents:    (professorId, pin, arr)    => call("importStudents",   { professorId, pin, students: arr }),

  // Analytics
  getAttendance:     (professorId, pin)         => call("getAttendance",    { professorId, pin }),

  // Registration
  registerProfessor: (prof)                     => call("registerProfessor", prof),

  // Student scan (no auth)
  recordScan: (token, studentId, deviceId) =>
    call("recordScan", { token, studentId, deviceId }),
};

// Generates a unique device fingerprint to prevent proxies
export function getDeviceId() {
  let id = localStorage.getItem("att_device_id");
  if (!id) {
    const nav = window.navigator;
    const raw = [
      nav.userAgent, nav.language, nav.hardwareConcurrency,
      screen.width, screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(),
    ].join("|");
    // Simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    id = "DEV-" + Math.abs(hash).toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("att_device_id", id);
  }
  return id;
}
