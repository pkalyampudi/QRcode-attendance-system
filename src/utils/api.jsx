// src/utils/api.jsx
const API_URL = import.meta.env.VITE_API_URL || "YOUR_APPS_SCRIPT_URL";

// Keep Apps Script warm — ping every 4 mins to prevent cold starts
let warmupInterval = null;
function startWarmup() {
  if (warmupInterval) return;
  warmupInterval = setInterval(() => {
    fetch(API_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain" },
      body:    JSON.stringify({ action: "getSubjects" }),
    }).catch(() => {});
  }, 4 * 60 * 1000); // every 4 minutes
}

async function call(action, payload = {}, retries = 3, timeoutMs = 20000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(API_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify({ action, ...payload }),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch(e) { throw new Error("Server returned invalid response. Please try again."); }

      if (!data.ok) throw new Error(data.error || "API error");
      return data;

    } catch(e) {
      lastError = e.name === "AbortError"
        ? new Error("Taking too long — please try again.")
        : e;

      if (attempt < retries) {
        // Wait: 2s, 4s, 6s between retries
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastError;
}

export const api = {
  login:            (id, pin)            => { startWarmup(); return call("login", { id, pin }, 3, 25000); },
  registerProfessor:(prof)               => call("registerProfessor", prof, 2, 20000),
  getSubjects:      ()                   => call("getSubjects", {}, 2, 15000),
  createSession:    (userId, pin, opts)  => call("createSession", { userId, pin, ...opts }, 3, 20000),
  getActiveSession: (userId, pin)        => call("getActiveSession", { userId, pin }, 2, 15000),
  submitSession:    (userId, pin, sid)   => call("submitSession", { userId, pin, sessionId: sid }, 3, 30000),

  // recordScan — fastest possible, 5 retries, 15s timeout
  recordScan: (token, studentId, deviceId) =>
    call("recordScan", { token, studentId, deviceId }, 5, 15000),

  getStudents:      (userId, pin, role)  => call("getStudents",    { userId, pin, role }, 2, 20000),
  addStudent:       (userId, pin, s)     => call("addStudent",     { userId, pin, ...s }, 2, 20000),
  removeStudent:    (userId, pin, sid)   => call("removeStudent",  { userId, pin, studentId: sid }, 2, 20000),
  importStudents:   (userId, pin, stus)  => call("importStudents", { userId, pin, students: stus }, 2, 30000),
  getAttendance:    (userId, pin)        => call("getAttendance",  { userId, pin }, 2, 25000),
  getHODDashboard:  (userId, pin)        => call("getHODDashboard", { userId, pin }, 2, 25000),
  getStudentReport: (userId, pin, sid)   => call("getStudentReport", { userId, pin, studentId: sid }, 2, 20000),
};

export function getDeviceId() {
  let id = localStorage.getItem("dv_device_id");
  if (!id) {
    const raw = [
      navigator.userAgent, navigator.language,
      screen.width, screen.height,
      new Date().getTimezoneOffset()
    ].join("|");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    id = "DV-" + Math.abs(hash).toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("dv_device_id", id);
  }
  return id;
}
