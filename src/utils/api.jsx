// src/utils/api.jsx
const API_URL = import.meta.env.VITE_API_URL || "";

// Keep Apps Script warm
let warmupInterval = null;
export function startWarmup() {
  if (warmupInterval) return;
  // Immediate warmup ping
  pingServer();
  // Then every 4 minutes
  warmupInterval = setInterval(pingServer, 4 * 60 * 1000);
}

function pingServer() {
  fetch(API_URL, {
    method: "POST",
    mode: "no-cors", // bypass CORS for warmup ping
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "getSubjects" }),
  }).catch(() => {});
}

async function call(action, payload = {}, retries = 3, timeoutMs = 25000) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(API_URL, {
        method:  "POST",
        mode:    "cors",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify({ action, ...payload }),
        signal:  controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) throw new Error("Server error: " + res.status);

      const text = await res.text();
      if (!text || text.trim() === "") throw new Error("Empty response from server");

      let data;
      try { data = JSON.parse(text); }
      catch(e) {
        // Apps Script sometimes returns HTML error page
        if (text.includes("Error")) throw new Error("Server error — please try again");
        throw new Error("Invalid response from server");
      }

      if (!data.ok) throw new Error(data.error || "Request failed");
      return data;

    } catch(e) {
      if (e.name === "AbortError") {
        lastError = new Error(attempt < retries
          ? "Slow connection, retrying…"
          : "Connection timed out. Please check your internet and try again."
        );
      } else {
        lastError = e;
      }

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastError;
}

export const api = {
  login:            (id, pin)           => { startWarmup(); return call("login", { id, pin }, 3, 30000); },
  registerProfessor:(prof)              => call("registerProfessor", prof, 2),
  getSubjects:      ()                  => call("getSubjects", {}, 2, 15000),
  createSession:    (userId, pin, opts) => call("createSession", { userId, pin, ...opts }, 3, 25000),
  getActiveSession: (userId, pin)       => call("getActiveSession", { userId, pin }, 2),
  submitSession:    (userId, pin, sid)  => call("submitSession", { userId, pin, sessionId: sid }, 3, 35000),
  recordScan:       (token, studentId, deviceId) =>
    call("recordScan", { token, studentId, deviceId }, 5, 20000),
  getStudents:      (userId, pin, role) => call("getStudents", { userId, pin, role }, 2),
  addStudent:       (userId, pin, s)    => call("addStudent",  { userId, pin, ...s }, 2),
  removeStudent:    (userId, pin, sid)  => call("removeStudent", { userId, pin, studentId: sid }, 2),
  importStudents:   (userId, pin, stus) => call("importStudents", { userId, pin, students: stus }, 2, 35000),
  getAttendance:    (userId, pin)       => call("getAttendance", { userId, pin }, 2, 25000),
  getHODDashboard:  (userId, pin)       => call("getHODDashboard", { userId, pin }, 2, 25000),
  getStudentReport: (userId, pin, sid)  => call("getStudentReport", { userId, pin, studentId: sid }, 2),
};

// Format timestamp in IST — "Thu May 28 2026 14:30"
export function formatIST(dateStr) {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday:  "short",
      year:     "numeric",
      month:    "short",
      day:      "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false
    }).replace(/,/g, "").replace(/\s+/g, " ").trim();
  } catch(_) { return String(dateStr); }
}

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
