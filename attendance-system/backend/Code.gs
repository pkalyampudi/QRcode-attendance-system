// ============================================================
//  ATTENDANCE SYSTEM — Google Apps Script Backend
//  Deploy as: Web App → Execute as Me → Anyone can access
// ============================================================

// ── CONFIG: paste your Google Sheet ID here after Step 3 ──
const SHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";

// Sheet tab names
const TABS = {
  PROFESSORS: "Professors",
  STUDENTS:   "Students",
  SESSIONS:   "Sessions",
  ATTENDANCE: "Attendance",
  SCANS:      "Scans",        // raw scan log for anti-proxy
};

const SESSION_WINDOW_MINS = 15;

// ============================================================
//  ROUTER — all HTTP calls land here
// ============================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    const routes = {
      // Auth
      login:              () => loginProfessor(body),
      // Sessions
      createSession:      () => createSession(body),
      getActiveSession:   () => getActiveSession(body),
      submitSession:      () => submitSession(body),
      // Student scan (no auth needed — only token validation)
      recordScan:         () => recordScan(body),
      // Data
      getStudents:        () => getStudents(body),
      addStudent:         () => addStudent(body),
      removeStudent:      () => removeStudent(body),
      importStudents:     () => importStudents(body),
      // Analytics
      getAttendance:      () => getAttendance(body),
      // Admin
      registerProfessor:  () => registerProfessor(body),
    };

    if (!routes[action]) return jsonResponse({ ok: false, error: "Unknown action: " + action });
    return routes[action]();
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  // Simple health-check / scan landing page redirect
  const token = e.parameter.token;
  if (token) return recordScanGet(token, e.parameter.studentId);
  return ContentService.createTextOutput("Attendance API running.").setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
//  AUTH
// ============================================================
function loginProfessor(body) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [id, name, email, pin, active] = data[i];
    if (String(id) === String(body.professorId) && String(pin) === String(body.pin) && active) {
      return jsonResponse({ ok: true, professor: { id, name, email } });
    }
  }
  return jsonResponse({ ok: false, error: "Invalid credentials" });
}

// ============================================================
//  SESSION MANAGEMENT
// ============================================================
function createSession(body) {
  verifyProfessor(body.professorId, body.pin);

  const sheet     = getSheet(TABS.SESSIONS);
  const token     = "ATT-" + body.professorId + "-" + Date.now() + "-" + randomStr(6);
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_WINDOW_MINS * 60 * 1000);
  const dateStr   = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");
  const sessionId = "SES-" + now.getTime();

  sheet.appendRow([sessionId, body.professorId, dateStr, now.toISOString(), expiresAt.toISOString(), token, "ACTIVE", 0]);

  return jsonResponse({ ok: true, session: { sessionId, token, expiresAt: expiresAt.toISOString(), dateStr } });
}

function getActiveSession(body) {
  verifyProfessor(body.professorId, body.pin);
  const session = findActiveSession(body.professorId);
  if (!session) return jsonResponse({ ok: true, session: null });
  return jsonResponse({ ok: true, session });
}

function submitSession(body) {
  verifyProfessor(body.professorId, body.pin);

  const sessSheet = getSheet(TABS.SESSIONS);
  const sessData  = sessSheet.getDataRange().getValues();
  let sessionRow  = -1;
  let session     = null;

  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][0] === body.sessionId) { sessionRow = i + 1; session = sessData[i]; break; }
  }
  if (!sessionRow) return jsonResponse({ ok: false, error: "Session not found" });
  if (sessData[sessionRow - 1][6] !== "ACTIVE") return jsonResponse({ ok: false, error: "Session already submitted" });

  // Mark session closed
  sessSheet.getRange(sessionRow, 7).setValue("SUBMITTED");

  // Get all students for this professor
  const students = getStudentsForProfessor(body.professorId);

  // Get who scanned
  const scansSheet = getSheet(TABS.SCANS);
  const scansData  = scansSheet.getDataRange().getValues();
  const presentIds = new Set();
  for (let i = 1; i < scansData.length; i++) {
    if (scansData[i][0] === body.sessionId && scansData[i][4] === "VALID") {
      presentIds.add(String(scansData[i][2]));
    }
  }

  // Write attendance records
  const attSheet = getSheet(TABS.ATTENDANCE);
  const dateStr  = session[2];
  students.forEach(s => {
    const present = presentIds.has(String(s[0])) ? 1 : 0;
    attSheet.appendRow([body.sessionId, body.professorId, s[0], dateStr, present]);
  });

  // Update scan count on session
  sessSheet.getRange(sessionRow, 8).setValue(presentIds.size);

  // Build and email the report
  const report = buildReport(body.professorId, dateStr, students, presentIds, body.sessionId);
  sendEmailReport(body.professorId, report, dateStr);

  return jsonResponse({ ok: true, summary: report.summary });
}

// ============================================================
//  STUDENT SCAN (no auth — token-gated)
// ============================================================
function recordScan(body) {
  return processScan(body.token, body.studentId, body.deviceId, body.lat, body.lng);
}

function recordScanGet(token, studentId) {
  // GET-based fallback for QR scanner apps that do GET
  const result = processScan(token, studentId, null, null, null);
  const data   = JSON.parse(result.getContent());
  const msg    = data.ok ? "✅ Attendance marked for student " + studentId : "❌ " + data.error;
  return HtmlService.createHtmlOutput("<h2 style='font-family:sans-serif;padding:2rem'>" + msg + "</h2>");
}

function processScan(token, studentId, deviceId, lat, lng) {
  const now = new Date();

  // 1. Find session by token
  const sessSheet = getSheet(TABS.SESSIONS);
  const sessData  = sessSheet.getDataRange().getValues();
  let session = null;
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][5] === token) { session = sessData[i]; break; }
  }
  if (!session) return jsonResponse({ ok: false, error: "Invalid QR code" });

  // 2. Check expiry
  const expiresAt = new Date(session[4]);
  if (now > expiresAt) return jsonResponse({ ok: false, error: "QR code expired (15 min window closed)" });

  // 3. Check session is still active
  if (session[6] !== "ACTIVE") return jsonResponse({ ok: false, error: "Session already closed" });

  const sessionId   = session[0];
  const professorId = session[1];

  // 4. Verify student belongs to professor
  const students = getStudentsForProfessor(professorId);
  const student  = students.find(s => String(s[0]) === String(studentId));
  if (!student) return jsonResponse({ ok: false, error: "Student ID not found in this class" });

  // 5. Anti-proxy check 1: duplicate student scan
  const scansSheet = getSheet(TABS.SCANS);
  const scansData  = scansSheet.getDataRange().getValues();
  for (let i = 1; i < scansData.length; i++) {
    if (scansData[i][0] === sessionId && String(scansData[i][2]) === String(studentId) && scansData[i][4] === "VALID") {
      return jsonResponse({ ok: false, error: "You have already marked attendance for this session" });
    }
  }

  // 6. Anti-proxy check 2: same device already scanned a different student
  if (deviceId) {
    for (let i = 1; i < scansData.length; i++) {
      if (scansData[i][0] === sessionId && scansData[i][3] === deviceId && scansData[i][4] === "VALID") {
        // Mark this scan as PROXY attempt
        scansSheet.appendRow([sessionId, professorId, studentId, deviceId, "PROXY", now.toISOString(), lat, lng]);
        return jsonResponse({ ok: false, error: "Proxy attempt detected. This device already marked another student." });
      }
    }
  }

  // 7. Record valid scan
  scansSheet.appendRow([sessionId, professorId, studentId, deviceId || "UNKNOWN", "VALID", now.toISOString(), lat || "", lng || ""]);

  return jsonResponse({ ok: true, message: "Attendance marked successfully!", studentName: student[1] });
}

// ============================================================
//  STUDENTS
// ============================================================
function getStudents(body) {
  verifyProfessor(body.professorId, body.pin);
  const students = getStudentsForProfessor(body.professorId);
  return jsonResponse({ ok: true, students: students.map(s => ({ id: s[0], name: s[1], email: s[2] })) });
}

function addStudent(body) {
  verifyProfessor(body.professorId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  sheet.appendRow([body.studentId, body.name, body.email, body.professorId, new Date().toISOString()]);
  return jsonResponse({ ok: true });
}

function removeStudent(body) {
  verifyProfessor(body.professorId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.studentId) && String(data[i][3]) === String(body.professorId)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: "Student not found" });
}

function importStudents(body) {
  verifyProfessor(body.professorId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const now   = new Date().toISOString();
  body.students.forEach(s => {
    sheet.appendRow([s.id, s.name, s.email, body.professorId, now]);
  });
  return jsonResponse({ ok: true, count: body.students.length });
}

// ============================================================
//  ANALYTICS
// ============================================================
function getAttendance(body) {
  verifyProfessor(body.professorId, body.pin);

  const attSheet  = getSheet(TABS.ATTENDANCE);
  const attData   = attSheet.getDataRange().getValues();
  const students  = getStudentsForProfessor(body.professorId);
  const records   = {};

  for (let i = 1; i < attData.length; i++) {
    const [sessionId, profId, studentId, date, present] = attData[i];
    if (String(profId) !== String(body.professorId)) continue;
    if (!records[date]) records[date] = {};
    records[date][String(studentId)] = present === 1;
  }

  return jsonResponse({
    ok: true,
    attendance: records,
    students: students.map(s => ({ id: s[0], name: s[1], email: s[2] })),
  });
}

// ============================================================
//  PROFESSOR REGISTRATION (admin only or self-registration)
// ============================================================
function registerProfessor(body) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) return jsonResponse({ ok: false, error: "Professor ID already exists" });
  }
  sheet.appendRow([body.id, body.name, body.email, body.pin, true, new Date().toISOString()]);
  return jsonResponse({ ok: true });
}

// ============================================================
//  EMAIL REPORT
// ============================================================
function buildReport(professorId, dateStr, students, presentIds, sessionId) {
  const total   = students.length;
  const present = presentIds.size;
  const absent  = total - present;
  const pct     = Math.round((present / total) * 100);

  const absentStudents = students.filter(s => !presentIds.has(String(s[0])));
  const presentStudents = students.filter(s => presentIds.has(String(s[0])));

  const absentRows = absentStudents.map(s =>
    `<tr><td style='padding:6px 12px;border-bottom:1px solid #eee'>${s[0]}</td><td style='padding:6px 12px;border-bottom:1px solid #eee'>${s[1]}</td><td style='padding:6px 12px;border-bottom:1px solid #eee;color:#888'>${s[2]}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:8px">
    Attendance Report — ${dateStr}
  </h2>
  <p style="color:#555">Session ID: <code>${sessionId}</code></p>

  <div style="display:flex;gap:16px;margin:20px 0">
    <div style="background:#e8f5e9;border-radius:8px;padding:16px 24px;text-align:center;flex:1">
      <div style="font-size:32px;font-weight:bold;color:#2e7d32">${present}</div>
      <div style="color:#555;font-size:13px">Present</div>
    </div>
    <div style="background:#fce4ec;border-radius:8px;padding:16px 24px;text-align:center;flex:1">
      <div style="font-size:32px;font-weight:bold;color:#c62828">${absent}</div>
      <div style="color:#555;font-size:13px">Absent</div>
    </div>
    <div style="background:#e3f2fd;border-radius:8px;padding:16px 24px;text-align:center;flex:1">
      <div style="font-size:32px;font-weight:bold;color:#1565c0">${pct}%</div>
      <div style="color:#555;font-size:13px">Attendance</div>
    </div>
  </div>

  ${absentStudents.length > 0 ? `
  <h3 style="color:#c62828">Absent students (${absentStudents.length})</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#fce4ec">
      <th style="padding:8px 12px;text-align:left">ID</th>
      <th style="padding:8px 12px;text-align:left">Name</th>
      <th style="padding:8px 12px;text-align:left">Email</th>
    </tr></thead>
    <tbody>${absentRows}</tbody>
  </table>` : `<p style="color:#2e7d32;font-weight:bold">🎉 Full attendance today!</p>`}

  <p style="color:#aaa;font-size:11px;margin-top:24px">
    Sent by Attendance Management System · ${new Date().toLocaleString("en-IN")}
  </p>
</div>`;

  return { html, summary: { total, present, absent, pct } };
}

function sendEmailReport(professorId, report, dateStr) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  let email   = null;
  let name    = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(professorId)) { email = data[i][2]; name = data[i][1]; break; }
  }
  if (!email) return;

  GmailApp.sendEmail(email,
    `[Attendance] Daily Report — ${dateStr}`,
    "Please view this email in HTML format.",
    { htmlBody: report.html, name: "Attendance System" }
  );
}

// ============================================================
//  HELPERS
// ============================================================
function getSheet(name) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setupSheetHeaders(sheet, name);
  }
  return sheet;
}

function setupSheetHeaders(sheet, name) {
  const headers = {
    [TABS.PROFESSORS]: ["ProfessorID","Name","Email","PIN","Active","CreatedAt"],
    [TABS.STUDENTS]:   ["StudentID","Name","Email","ProfessorID","CreatedAt"],
    [TABS.SESSIONS]:   ["SessionID","ProfessorID","Date","StartedAt","ExpiresAt","Token","Status","PresentCount"],
    [TABS.ATTENDANCE]: ["SessionID","ProfessorID","StudentID","Date","Present"],
    [TABS.SCANS]:      ["SessionID","ProfessorID","StudentID","DeviceID","Status","ScannedAt","Lat","Lng"],
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight("bold").setBackground("#e8eaf6");
  }
}

function getStudentsForProfessor(professorId) {
  const sheet = getSheet(TABS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  return data.slice(1).filter(r => String(r[3]) === String(professorId));
}

function findActiveSession(professorId) {
  const sheet = getSheet(TABS.SESSIONS);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(professorId) && data[i][6] === "ACTIVE") {
      const exp = new Date(data[i][4]);
      if (now <= exp) return { sessionId: data[i][0], token: data[i][5], expiresAt: data[i][4], dateStr: data[i][2] };
    }
  }
  return null;
}

function verifyProfessor(id, pin) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) && String(data[i][3]) === String(pin) && data[i][4]) return true;
  }
  throw new Error("Authentication failed");
}

function randomStr(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result  = "";
  for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
