// ============================================================
//  DATAVEDHA ATTENDANCE SYSTEM — Google Apps Script Backend
//  Version 2.0 — Multi-subject, Multi-batch, HOD Dashboard
//  Deploy: Web App → Execute as Me → Anyone can access
// ============================================================

const SHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";
const SESSION_WINDOW_MINS = 15;
const MIN_ATTENDANCE_PCT   = 70; // alert threshold

const TABS = {
  PROFESSORS:  "Professors",
  STUDENTS:    "Students",
  SUBJECTS:    "Subjects",
  SESSIONS:    "Sessions",
  ATTENDANCE:  "Attendance",
  SCANS:       "Scans",
};

const SUBJECTS = [
  { code: "ANAT", name: "Anatomy",      hasLab: true },
  { code: "PHYS", name: "Physiology",   hasLab: true },
  { code: "BIOC", name: "Biochemistry", hasLab: true },
  { code: "PHAR", name: "Pharmacology", hasLab: true },
  { code: "PATH", name: "Pathology",    hasLab: true },
  { code: "MICR", name: "Microbiology", hasLab: true },
];

const LAB_BATCHES    = ["A","B","C","D","E","F","G"];
const JOINING_BATCHES = ["2024-25","2025-26","2026-27"];

// ============================================================
//  ROUTER
// ============================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const routes = {
      // Auth
      login:                () => loginUser(body),
      registerProfessor:    () => registerProfessor(body),
      // Sessions
      createSession:        () => createSession(body),
      submitSession:        () => submitSession(body),
      getActiveSession:     () => getActiveSession(body),
      // Scans
      recordScan:           () => recordScan(body),
      // Students
      getStudents:          () => getStudents(body),
      addStudent:           () => addStudent(body),
      removeStudent:        () => removeStudent(body),
      importStudents:       () => importStudents(body),
      // Analytics
      getAttendance:        () => getAttendance(body),
      getHODDashboard:      () => getHODDashboard(body),
      getStudentReport:     () => getStudentReport(body),
      // Config
      getSubjects:          () => jsonResponse({ ok: true, subjects: SUBJECTS, labBatches: LAB_BATCHES, joiningBatches: JOINING_BATCHES }),
    };
    if (!routes[body.action]) return jsonResponse({ ok: false, error: "Unknown action" });
    return routes[body.action]();
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  const token = e.parameter.token;
  if (token) return handleScanGet(token, e.parameter.sid);
  return ContentService.createTextOutput("DataVedha Attendance API v2.0").setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
//  AUTH
// ============================================================
function loginUser(body) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [id, name, email, pin, role, dept, active] = data[i];
    if (String(id) === String(body.id) && String(pin) === String(body.pin) && active) {
      return jsonResponse({ ok: true, user: { id, name, email, role: role || "professor", dept: dept || "" } });
    }
  }
  return jsonResponse({ ok: false, error: "Invalid ID or PIN" });
}

function registerProfessor(body) {
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) return jsonResponse({ ok: false, error: "ID already exists" });
  }
  // role: "hod" | "professor" | "lab_instructor"
  sheet.appendRow([body.id, body.name, body.email, body.pin, body.role || "professor", body.dept || "Physiology", true, new Date().toISOString()]);
  return jsonResponse({ ok: true });
}

// ============================================================
//  SESSIONS
// ============================================================
function createSession(body) {
  verifyUser(body.userId, body.pin);
  const sheet     = getSheet(TABS.SESSIONS);
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_WINDOW_MINS * 60 * 1000);
  const dateStr   = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");
  const sessionId = "SES-" + now.getTime();
  // token encodes subjectCode + sessionType + labBatch
  const token     = "DV-" + body.subjectCode + "-" + (body.sessionType || "THEORY") + "-" + (body.labBatch || "ALL") + "-" + randomStr(8);

  sheet.appendRow([
    sessionId,
    body.userId,
    body.subjectCode,
    body.sessionType || "THEORY",   // THEORY | LAB
    body.labBatch    || "ALL",      // A-G or ALL for theory
    body.joiningBatch || "ALL",
    dateStr,
    now.toISOString(),
    expiresAt.toISOString(),
    token,
    "ACTIVE",
    0
  ]);

  return jsonResponse({ ok: true, session: { sessionId, token, expiresAt: expiresAt.toISOString(), dateStr, subjectCode: body.subjectCode, sessionType: body.sessionType || "THEORY", labBatch: body.labBatch || "ALL" } });
}

function getActiveSession(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.SESSIONS);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(body.userId) && data[i][10] === "ACTIVE") {
      if (now <= new Date(data[i][8])) {
        return jsonResponse({ ok: true, session: { sessionId: data[i][0], token: data[i][9], expiresAt: data[i][8], subjectCode: data[i][2], sessionType: data[i][3], labBatch: data[i][4] } });
      }
    }
  }
  return jsonResponse({ ok: true, session: null });
}

function submitSession(body) {
  verifyUser(body.userId, body.pin);
  const sessSheet = getSheet(TABS.SESSIONS);
  const sessData  = sessSheet.getDataRange().getValues();
  let sessionRow  = -1, session = null;
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][0] === body.sessionId) { sessionRow = i + 1; session = sessData[i]; break; }
  }
  if (!session) return jsonResponse({ ok: false, error: "Session not found" });
  if (session[10] !== "ACTIVE") return jsonResponse({ ok: false, error: "Already submitted" });

  sessSheet.getRange(sessionRow, 11).setValue("SUBMITTED");

  const subjectCode   = session[2];
  const sessionType   = session[3];
  const labBatch      = session[4];
  const joiningBatch  = session[5];
  const dateStr       = session[6];

  // Get eligible students
  const students = getEligibleStudents(body.userId, subjectCode, sessionType, labBatch, joiningBatch);

  // Get scans
  const scansData  = getSheet(TABS.SCANS).getDataRange().getValues();
  const presentIds = new Set();
  for (let i = 1; i < scansData.length; i++) {
    if (scansData[i][0] === body.sessionId && scansData[i][5] === "VALID") {
      presentIds.add(String(scansData[i][2]));
    }
  }

  // Write attendance
  const attSheet = getSheet(TABS.ATTENDANCE);
  students.forEach(s => {
    attSheet.appendRow([body.sessionId, body.userId, s[0], subjectCode, sessionType, labBatch, dateStr, presentIds.has(String(s[0])) ? 1 : 0]);
  });

  sessSheet.getRange(sessionRow, 12).setValue(presentIds.size);

  // Build and send report
  const report = buildSessionReport(body.userId, students, presentIds, subjectCode, sessionType, labBatch, dateStr, body.sessionId);
  sendSessionEmail(body.userId, report, subjectCode, sessionType, dateStr);

  // Check and send at-risk alert (cumulative)
  checkAndSendAtRiskAlert(body.userId, subjectCode, sessionType);

  return jsonResponse({ ok: true, summary: report.summary });
}

// ============================================================
//  STUDENT SCAN
// ============================================================
function recordScan(body) {
  return processScan(body.token, body.studentId, body.deviceId, body.lat, body.lng);
}

function handleScanGet(token, studentId) {
  const result = processScan(token, studentId, null, null, null);
  const data   = JSON.parse(result.getContent());
  const msg    = data.ok ? "✅ Attendance marked! Welcome, " + (data.studentName || studentId) : "❌ " + data.error;
  return HtmlService.createHtmlOutput("<div style='font-family:sans-serif;padding:2rem;max-width:400px;margin:auto'><h2>" + msg + "</h2></div>");
}

function processScan(token, studentId, deviceId, lat, lng) {
  const now      = new Date();
  const sessData = getSheet(TABS.SESSIONS).getDataRange().getValues();
  let session    = null;
  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][9] === token) { session = sessData[i]; break; }
  }
  if (!session) return jsonResponse({ ok: false, error: "Invalid QR code" });
  if (now > new Date(session[8])) return jsonResponse({ ok: false, error: "QR expired — 15 minute window closed" });
  if (session[10] !== "ACTIVE") return jsonResponse({ ok: false, error: "Session already closed" });

  const sessionId  = session[0];
  const userId     = session[1];
  const subjectCode = session[2];
  const sessionType = session[3];
  const labBatch   = session[4];

  // Verify student
  const students = getEligibleStudents(userId, subjectCode, sessionType, labBatch, "ALL");
  const student  = students.find(s => String(s[0]) === String(studentId));
  if (!student) return jsonResponse({ ok: false, error: "Student ID " + studentId + " not found in this class" });

  const scansSheet = getSheet(TABS.SCANS);
  const scansData  = scansSheet.getDataRange().getValues();

  // Anti-proxy: duplicate student
  for (let i = 1; i < scansData.length; i++) {
    if (scansData[i][0] === sessionId && String(scansData[i][2]) === String(studentId) && scansData[i][5] === "VALID") {
      return jsonResponse({ ok: false, error: "You already marked attendance for this session" });
    }
  }

  // Anti-proxy: duplicate device
  if (deviceId) {
    for (let i = 1; i < scansData.length; i++) {
      if (scansData[i][0] === sessionId && scansData[i][3] === deviceId && scansData[i][5] === "VALID") {
        scansSheet.appendRow([sessionId, userId, studentId, deviceId, now.toISOString(), "PROXY", lat || "", lng || ""]);
        return jsonResponse({ ok: false, error: "Proxy detected — this device already marked another student" });
      }
    }
  }

  scansSheet.appendRow([sessionId, userId, studentId, deviceId || "UNKNOWN", now.toISOString(), "VALID", lat || "", lng || ""]);
  return jsonResponse({ ok: true, message: "Attendance marked successfully!", studentName: student[1] });
}

// ============================================================
//  STUDENTS
// ============================================================
function getStudents(body) {
  verifyUser(body.userId, body.pin);
  const data = getSheet(TABS.STUDENTS).getDataRange().getValues();
  const students = data.slice(1)
    .filter(r => String(r[4]) === String(body.userId) || body.role === "hod")
    .map(r => ({ id: r[0], name: r[1], email: r[2], joiningBatch: r[3], professorId: r[4], labBatch: r[5], subjectCode: r[6] }));
  return jsonResponse({ ok: true, students });
}

function addStudent(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  sheet.appendRow([body.studentId, body.name, body.email, body.joiningBatch || "2024-25", body.userId, body.labBatch || "A", body.subjectCode || "ALL", new Date().toISOString()]);
  return jsonResponse({ ok: true });
}

function removeStudent(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.studentId) && String(data[i][4]) === String(body.userId)) {
      sheet.deleteRow(i + 1); return jsonResponse({ ok: true });
    }
  }
  return jsonResponse({ ok: false, error: "Student not found" });
}

function importStudents(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const now   = new Date().toISOString();
  body.students.forEach(s => {
    sheet.appendRow([s.id, s.name, s.email || "", s.joiningBatch || "2024-25", body.userId, s.labBatch || "A", s.subjectCode || "ALL", now]);
  });
  return jsonResponse({ ok: true, count: body.students.length });
}

// ============================================================
//  ANALYTICS
// ============================================================
function getAttendance(body) {
  verifyUser(body.userId, body.pin);
  const attData  = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const students = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1)
    .filter(r => String(r[4]) === String(body.userId))
    .map(r => ({ id: String(r[0]), name: r[1], email: r[2], joiningBatch: r[3], labBatch: r[5], subjectCode: r[6] }));

  const records = {};
  for (let i = 1; i < attData.length; i++) {
    const [sessionId, profId, studentId, subjectCode, sessionType, labBatch, date, present] = attData[i];
    if (String(profId) !== String(body.userId)) continue;
    const key = subjectCode + "|" + sessionType;
    if (!records[key]) records[key] = {};
    if (!records[key][date]) records[key][date] = {};
    records[key][date][String(studentId)] = present === 1;
  }
  return jsonResponse({ ok: true, attendance: records, students });
}

function getHODDashboard(body) {
  verifyUser(body.userId, body.pin);
  const attData  = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const stuData  = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  const profData = getSheet(TABS.PROFESSORS).getDataRange().getValues().slice(1);

  // Aggregate by subject+type, by joining batch, by lab batch
  const bySubject     = {};
  const byJoinBatch   = {};
  const byLabBatch    = {};
  const atRisk        = {};

  // Build student lookup
  const stuMap = {};
  stuData.forEach(r => { stuMap[String(r[0])] = { name: r[1], joiningBatch: r[3], labBatch: r[5] }; });

  for (let i = 1; i < attData.length; i++) {
    const [sessionId, profId, studentId, subjectCode, sessionType, labBatch, date, present] = attData[i];
    const key = subjectCode + "|" + sessionType;
    if (!bySubject[key]) bySubject[key] = { present: 0, total: 0, sessions: new Set() };
    bySubject[key].total++;
    bySubject[key].sessions.add(date + "|" + sessionId);
    if (present === 1) bySubject[key].present++;

    const stu = stuMap[String(studentId)];
    if (stu) {
      const jk = stu.joiningBatch;
      if (!byJoinBatch[jk]) byJoinBatch[jk] = { present: 0, total: 0 };
      byJoinBatch[jk].total++;
      if (present === 1) byJoinBatch[jk].present++;

      const lk = stu.labBatch;
      if (!byLabBatch[lk]) byLabBatch[lk] = { present: 0, total: 0 };
      byLabBatch[lk].total++;
      if (present === 1) byLabBatch[lk].present++;
    }
  }

  // Convert session Sets to counts
  Object.values(bySubject).forEach(v => { v.sessions = v.sessions.size; });

  // At risk per student per subject
  const studentSubjectMap = {};
  for (let i = 1; i < attData.length; i++) {
    const [, profId, studentId, subjectCode, sessionType, , , present] = attData[i];
    const key = String(studentId) + "|" + subjectCode + "|" + sessionType;
    if (!studentSubjectMap[key]) studentSubjectMap[key] = { present: 0, total: 0, studentId: String(studentId) };
    studentSubjectMap[key].total++;
    if (present === 1) studentSubjectMap[key].present++;
  }

  const atRiskList = [];
  Object.entries(studentSubjectMap).forEach(([key, v]) => {
    const pct = v.total ? Math.round(v.present / v.total * 100) : 0;
    if (pct < MIN_ATTENDANCE_PCT && v.total > 0) {
      const stu = stuMap[v.studentId];
      const [sid, sub, type] = key.split("|");
      atRiskList.push({ studentId: v.studentId, name: stu ? stu.name : v.studentId, subject: sub, type, pct, present: v.present, total: v.total });
    }
  });

  return jsonResponse({ ok: true, bySubject, byJoinBatch, byLabBatch, atRiskList, subjects: SUBJECTS, labBatches: LAB_BATCHES, joiningBatches: JOINING_BATCHES });
}

function getStudentReport(body) {
  verifyUser(body.userId, body.pin);
  const attData = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const report  = {};
  for (let i = 1; i < attData.length; i++) {
    const [, , studentId, subjectCode, sessionType, , date, present] = attData[i];
    if (String(studentId) !== String(body.studentId)) continue;
    const key = subjectCode + "|" + sessionType;
    if (!report[key]) report[key] = { present: 0, total: 0, dates: {} };
    report[key].total++;
    report[key].dates[date] = present === 1;
    if (present === 1) report[key].present++;
  }
  return jsonResponse({ ok: true, report });
}

// ============================================================
//  EMAIL
// ============================================================
function buildSessionReport(userId, students, presentIds, subjectCode, sessionType, labBatch, dateStr, sessionId) {
  const total   = students.length;
  const present = presentIds.size;
  const absent  = total - present;
  const pct     = total ? Math.round(present / total * 100) : 0;
  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  const absentees   = students.filter(s => !presentIds.has(String(s[0])));

  const absentRows = absentees.map(s =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s[0]}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s[1]}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
  <div style="background:#1a1a2e;padding:20px 24px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
    <span style="font-size:24px;font-weight:900;color:#fff"><span style="color:#ea4335">data</span><span style="color:#6DBE45">vedha</span></span>
    <span style="color:rgba(255,255,255,0.5);font-size:13px">Attendance Report</span>
  </div>
  <div style="border:1px solid #e8eaf6;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <h2 style="color:#1e293b;margin:0 0 4px">${subjectName} — ${sessionType} Session</h2>
    <p style="color:#64748b;margin:0 0 20px">${dateStr} ${labBatch !== "ALL" ? "· Lab Batch " + labBatch : ""} · Session ${sessionId}</p>
    <div style="display:flex;gap:12px;margin-bottom:24px">
      <div style="flex:1;background:#e8f5e9;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#34a853">${present}</div>
        <div style="font-size:12px;color:#2e7d32;font-weight:600">Present</div>
      </div>
      <div style="flex:1;background:#fce8e6;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#ea4335">${absent}</div>
        <div style="font-size:12px;color:#c62828;font-weight:600">Absent</div>
      </div>
      <div style="flex:1;background:#e8f0fe;border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#1a73e8">${pct}%</div>
        <div style="font-size:12px;color:#1557b0;font-weight:600">Attendance</div>
      </div>
    </div>
    ${absentees.length > 0 ? `
    <h3 style="color:#ea4335;margin:0 0 10px">Absent students (${absentees.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#fce8e6">
        <th style="padding:8px 12px;text-align:left">Roll No.</th>
        <th style="padding:8px 12px;text-align:left">Name</th>
      </tr></thead>
      <tbody>${absentRows}</tbody>
    </table>` : `<p style="color:#34a853;font-weight:700">🎉 Full attendance today!</p>`}
    <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #f0f0f0;padding-top:12px">
      Powered by <strong>datavedha</strong> · ${new Date().toLocaleString("en-IN")}
    </p>
  </div>
</div>`;

  return { html, summary: { total, present, absent, pct, subjectCode, sessionType, labBatch, dateStr } };
}

function sendSessionEmail(userId, report, subjectCode, sessionType, dateStr) {
  const profData = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  let email = null, name = null;
  for (let i = 1; i < profData.length; i++) {
    if (String(profData[i][0]) === String(userId)) { email = profData[i][2]; name = profData[i][1]; break; }
  }
  if (!email) return;
  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  GmailApp.sendEmail(email,
    `[DataVedha] ${subjectName} ${sessionType} Report — ${dateStr}`,
    "Please view in HTML format.",
    { htmlBody: report.html, name: "DataVedha Attendance" }
  );
}

function checkAndSendAtRiskAlert(userId, subjectCode, sessionType) {
  const attData = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const stuData = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  const stuMap  = {};
  stuData.forEach(r => { if (String(r[4]) === String(userId)) stuMap[String(r[0])] = { name: r[1], email: r[2] }; });

  const perStudent = {};
  for (let i = 1; i < attData.length; i++) {
    const [, profId, studentId, subCode, sessType, , , present] = attData[i];
    if (String(profId) !== String(userId) || subCode !== subjectCode || sessType !== sessionType) continue;
    if (!perStudent[studentId]) perStudent[studentId] = { present: 0, total: 0 };
    perStudent[studentId].total++;
    if (present === 1) perStudent[studentId].present++;
  }

  const atRisk = [];
  Object.entries(perStudent).forEach(([sid, v]) => {
    const pct = v.total >= 3 ? Math.round(v.present / v.total * 100) : null;
    if (pct !== null && pct < MIN_ATTENDANCE_PCT) {
      const stu = stuMap[sid];
      if (stu) atRisk.push({ id: sid, name: stu.name, pct, present: v.present, total: v.total });
    }
  });

  if (!atRisk.length) return;

  const profData = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  let profEmail = null;
  for (let i = 1; i < profData.length; i++) {
    if (String(profData[i][0]) === String(userId)) { profEmail = profData[i][2]; break; }
  }
  if (!profEmail) return;

  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  const rows = atRisk.map(s =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.id}</td><td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;color:#ea4335;font-weight:700">${s.pct}%</td><td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.present}/${s.total}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
  <div style="background:#1a1a2e;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="font-size:22px;font-weight:900;color:#fff"><span style="color:#ea4335">data</span><span style="color:#6DBE45">vedha</span></span>
    <span style="color:rgba(255,255,255,0.5);font-size:13px;margin-left:12px">⚠️ Attendance Alert</span>
  </div>
  <div style="border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;margin-bottom:20px">
      <strong style="color:#92400e">⚠️ ${atRisk.length} student${atRisk.length > 1 ? "s" : ""} below ${MIN_ATTENDANCE_PCT}% attendance</strong>
      <p style="color:#a16207;font-size:13px;margin:4px 0 0">Subject: ${subjectName} · ${sessionType}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#fef3c7">
        <th style="padding:8px 12px;text-align:left">Roll No.</th>
        <th style="padding:8px 12px;text-align:left">Name</th>
        <th style="padding:8px 12px;text-align:left">Attendance %</th>
        <th style="padding:8px 12px;text-align:left">Sessions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#aaa;font-size:11px;margin-top:20px">Powered by datavedha · ${new Date().toLocaleString("en-IN")}</p>
  </div>
</div>`;

  GmailApp.sendEmail(profEmail, `[DataVedha] ⚠️ At-Risk Alert — ${subjectName} ${sessionType}`, "Please view in HTML.", { htmlBody: html, name: "DataVedha Attendance" });
}

// ============================================================
//  HELPERS
// ============================================================
function getEligibleStudents(userId, subjectCode, sessionType, labBatch, joiningBatch) {
  const data = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  return data.filter(r => {
    if (String(r[4]) !== String(userId)) return false;
    if (sessionType === "LAB" && labBatch !== "ALL" && r[5] !== labBatch) return false;
    if (joiningBatch && joiningBatch !== "ALL" && r[3] !== joiningBatch) return false;
    return true;
  });
}

function verifyUser(id, pin) {
  const data = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) && String(data[i][3]) === String(pin) && data[i][6]) return true;
  }
  throw new Error("Authentication failed");
}

function getSheet(name) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); setupHeaders(sheet, name); }
  return sheet;
}

function setupHeaders(sheet, name) {
  const h = {
    [TABS.PROFESSORS]: ["ID","Name","Email","PIN","Role","Department","Active","CreatedAt"],
    [TABS.STUDENTS]:   ["StudentID","Name","Email","JoiningBatch","ProfessorID","LabBatch","SubjectCode","CreatedAt"],
    [TABS.SESSIONS]:   ["SessionID","UserID","SubjectCode","SessionType","LabBatch","JoiningBatch","Date","StartedAt","ExpiresAt","Token","Status","PresentCount"],
    [TABS.ATTENDANCE]: ["SessionID","UserID","StudentID","SubjectCode","SessionType","LabBatch","Date","Present"],
    [TABS.SCANS]:      ["SessionID","UserID","StudentID","DeviceID","ScannedAt","Status","Lat","Lng"],
  };
  if (h[name]) {
    sheet.appendRow(h[name]);
    sheet.getRange(1, 1, 1, h[name].length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  }
}

function randomStr(n) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < n; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

// ── ONE-TIME SETUP — run once from Apps Script editor ──
function initialSetup() {
  ["Professors","Students","Sessions","Attendance","Scans"].forEach(name => getSheet(name));
  Logger.log("✅ All sheets created");
}

function registerMe() {
  registerProfessor({ id: "12345", name: "Dr. V Maheswara Rao", email: "vmrao2k8@gmail.com", pin: "1234", role: "professor", dept: "Physiology" });
  Logger.log("✅ Professor registered");
}
