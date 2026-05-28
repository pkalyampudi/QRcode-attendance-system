// ============================================================
//  DATAVEDHA ATTENDANCE SYSTEM — Google Apps Script Backend
//  Version 3.0 — Correct data model
//  
//  DATA MODEL:
//  - Students are college-wide (no professor ownership)
//  - Students have ONE lab batch across ALL subjects
//  - Any professor can mark attendance for their subject
//  - Lab sessions filter by student's lab batch
// ============================================================

const SHEET_ID            = "1cq4Vxiu0cDO9pvMqStJ8yPOTpRLGU844Dp22a-hgmdk";
const SESSION_WINDOW_MINS = 30;
const MIN_ATTENDANCE_PCT  = 70;

const TABS = {
  PROFESSORS: "Professors",
  STUDENTS:   "Students",    // StudentID, Name, Email, JoiningBatch, LabBatch, CreatedAt
  SESSIONS:   "Sessions",
  ATTENDANCE: "Attendance",
  SCANS:      "Scans",
};

const SUBJECTS = [
  { code:"ANAT", name:"Anatomy" },
  { code:"PHYS", name:"Physiology" },
  { code:"BIOC", name:"Biochemistry" },
  { code:"PHAR", name:"Pharmacology" },
  { code:"PATH", name:"Pathology" },
  { code:"MICR", name:"Microbiology" },
];

const LAB_BATCHES     = ["A","B","C"];
const JOINING_BATCHES = ["2024-25","2025-26","2026-27"];

// ── In-memory cache ──
const _cache = {};
function getCache(key) {
  const c = _cache[key];
  return (c && (Date.now() - c.ts) < c.ttl) ? c.val : null;
}
function setCache(key, val, ttlMs) {
  _cache[key] = { val, ts: Date.now(), ttl: ttlMs };
}
function clearCache(prefix) {
  Object.keys(_cache).filter(k => k.startsWith(prefix)).forEach(k => delete _cache[k]);
}

// ============================================================
//  ROUTER
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const routes = {
      login:              () => loginUser(body),
      registerProfessor:  () => registerProfessor(body),
      createSession:      () => createSession(body),
      submitSession:      () => submitSession(body),
      getActiveSession:   () => getActiveSession(body),
      recordScan:         () => recordScan(body),
      getStudents:        () => getStudents(body),
      addStudent:         () => addStudent(body),
      removeStudent:      () => removeStudent(body),
      importStudents:     () => importStudents(body),
      getAttendance:      () => getAttendance(body),
      getHODDashboard:    () => getHODDashboard(body),
      getSubjects:        () => jsonResponse({ ok:true, subjects:SUBJECTS, labBatches:LAB_BATCHES, joiningBatches:JOINING_BATCHES }),
    };
    if (!routes[body.action]) return jsonResponse({ ok:false, error:"Unknown action: " + body.action });
    return routes[body.action]();
  } catch(err) {
    return jsonResponse({ ok:false, error:err.message });
  }
}

function doGet(e) {
  const token = e.parameter.token;
  if (token) return handleScanGet(token, e.parameter.sid);
  return ContentService.createTextOutput("DataVedha Attendance API v3.0").setMimeType(ContentService.MimeType.TEXT);
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
//  AUTH
// ============================================================
function loginUser(body) {
  const data = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const id          = String(data[i][0]);
    const name        = data[i][1];
    const email       = data[i][2];
    const pin         = String(data[i][3]);
    const role        = data[i][4] || "professor";
    const dept        = data[i][5] || "";
    const active      = data[i][6];
    const subjectCode = String(data[i][8] || "ALL");
    if (id === String(body.id) && pin === String(body.pin) && active) {
      return jsonResponse({ ok:true, user:{ id, name, email, role, dept, subjectCode } });
    }
  }
  return jsonResponse({ ok:false, error:"Invalid ID or PIN" });
}

function registerProfessor(body) {
  if (!body.id) return jsonResponse({ ok:false, error:"ID is required" });
  const sheet = getSheet(TABS.PROFESSORS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) return jsonResponse({ ok:false, error:"ID already exists" });
  }
  sheet.appendRow([
    body.id, body.name, body.email, body.pin,
    body.role        || "professor",
    body.dept        || "Physiology",
    true,
    new Date().toISOString(),
    body.subjectCode || "ALL",
  ]);
  return jsonResponse({ ok:true });
}

// ============================================================
//  SESSIONS
// ============================================================
function createSession(body) {
  verifyUser(body.userId, body.pin);
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_WINDOW_MINS * 60 * 1000);
  const dateStr   = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");
  const sessionId = "SES-" + now.getTime();
  const token     = "DV-" + body.subjectCode + "-" + (body.sessionType||"THEORY") + "-" + (body.labBatch||"ALL") + "-" + randomStr(8);

  getSheet(TABS.SESSIONS).appendRow([
    sessionId, body.userId, body.subjectCode,
    body.sessionType  || "THEORY",
    body.labBatch     || "ALL",
    body.joiningBatch || "ALL",
    dateStr, now.toISOString(), expiresAt.toISOString(),
    token, "ACTIVE", 0
  ]);

  // Cache session for fast scan lookup
  setCache("sess_" + token, {
    sessionId, userId: body.userId,
    subjectCode: body.subjectCode,
    sessionType: body.sessionType || "THEORY",
    labBatch:    body.labBatch    || "ALL",
    joiningBatch:body.joiningBatch|| "ALL",
    expiresAt:   expiresAt.toISOString(),
    status:      "ACTIVE"
  }, 1800000); // 30 min cache

  return jsonResponse({ ok:true, session:{
    sessionId, token,
    expiresAt:   expiresAt.toISOString(),
    dateStr,
    subjectCode: body.subjectCode,
    sessionType: body.sessionType || "THEORY",
    labBatch:    body.labBatch    || "ALL"
  }});
}

function getActiveSession(body) {
  verifyUser(body.userId, body.pin);
  const data = getSheet(TABS.SESSIONS).getDataRange().getValues();
  const now  = new Date();
  for (let i = data.length-1; i >= 1; i--) {
    if (String(data[i][1]) === String(body.userId) && data[i][10] === "ACTIVE") {
      if (now <= new Date(data[i][8])) {
        return jsonResponse({ ok:true, session:{
          sessionId:   data[i][0], token: data[i][9],
          expiresAt:   data[i][8], subjectCode: data[i][2],
          sessionType: data[i][3], labBatch: data[i][4]
        }});
      }
    }
  }
  return jsonResponse({ ok:true, session:null });
}

function submitSession(body) {
  verifyUser(body.userId, body.pin);
  const sessSheet = getSheet(TABS.SESSIONS);
  const sessData  = sessSheet.getDataRange().getValues();
  let   sessionRow = -1, session = null;

  for (let i = 1; i < sessData.length; i++) {
    if (sessData[i][0] === body.sessionId) { sessionRow = i+1; session = sessData[i]; break; }
  }
  if (!session)              return jsonResponse({ ok:false, error:"Session not found" });
  if (session[10] !== "ACTIVE") return jsonResponse({ ok:false, error:"Already submitted" });

  sessSheet.getRange(sessionRow, 11).setValue("SUBMITTED");

  const subjectCode  = session[2];
  const sessionType  = session[3];
  const labBatch     = session[4];
  const joiningBatch = session[5];
  const dateStr      = session[6];

  // Clear session cache
  clearCache("sess_");

  // Get eligible students using new model
  const students   = getEligibleStudents(subjectCode, sessionType, labBatch, joiningBatch);
  const scansSheet = getSheet(TABS.SCANS);
  const scansData  = scansSheet.getDataRange().getValues();
  const presentIds = new Set();
  for (let i = 1; i < scansData.length; i++) {
    if (scansData[i][0] === body.sessionId && scansData[i][5] === "VALID") {
      presentIds.add(String(scansData[i][2]));
    }
  }

  // Batch write attendance
  if (students.length > 0) {
    const attSheet = getSheet(TABS.ATTENDANCE);
    const rows = students.map(s => [
      body.sessionId, body.userId, s[0], subjectCode,
      sessionType, labBatch, dateStr, presentIds.has(String(s[0])) ? 1 : 0
    ]);
    attSheet.getRange(attSheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
  }

  sessSheet.getRange(sessionRow, 12).setValue(presentIds.size);

  const report = buildReport(body.userId, students, presentIds, subjectCode, sessionType, labBatch, dateStr, body.sessionId);
  sendEmail(body.userId, report, subjectCode, sessionType, dateStr);
  sendAtRiskAlert(body.userId, subjectCode, sessionType);

  return jsonResponse({ ok:true, summary: report.summary });
}

// ============================================================
//  STUDENT SCAN — optimized for 200 concurrent students
// ============================================================
function recordScan(body) {
  return processScan(body.token, body.studentId, body.deviceId, body.lat, body.lng);
}

function handleScanGet(token, studentId) {
  const result = processScan(token, studentId, null, null, null);
  const data   = JSON.parse(result.getContent());
  const msg    = data.ok
    ? "✅ Attendance marked! Welcome, " + (data.studentName||studentId)
    : "❌ " + data.error;
  return HtmlService.createHtmlOutput(
    "<div style='font-family:sans-serif;padding:2rem;max-width:400px;margin:auto;text-align:center'><h2>" + msg + "</h2></div>"
  );
}

function processScan(token, studentId, deviceId, lat, lng) {
  const now = new Date();

  // ── 1. Get session (cache-first) ──
  let session = getCache("sess_" + token);
  if (!session) {
    const sheet   = getSheet(TABS.SESSIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ ok:false, error:"No active session found" });
    const readRows = Math.min(lastRow - 1, 100);
    const rows     = sheet.getRange(lastRow - readRows + 1, 1, readRows, 11).getValues();
    for (let i = rows.length-1; i >= 0; i--) {
      if (rows[i][9] === token) {
        session = {
          sessionId:   rows[i][0], userId:      rows[i][1],
          subjectCode: rows[i][2], sessionType: rows[i][3],
          labBatch:    rows[i][4], joiningBatch:rows[i][5],
          expiresAt:   rows[i][8], status:      rows[i][10],
        };
        setCache("sess_" + token, session, 1800000);
        break;
      }
    }
  }

  if (!session)                            return jsonResponse({ ok:false, error:"Invalid QR code — please scan again" });
  if (now > new Date(session.expiresAt))   return jsonResponse({ ok:false, error:"QR code has expired — session window is closed" });
  if (session.status !== "ACTIVE")         return jsonResponse({ ok:false, error:"Session already closed by professor" });

  const { sessionId, userId, subjectCode, sessionType, labBatch } = session;

  // ── 2. Verify student using new model (no professor ownership) ──
  const stuCacheKey = "allstu_" + sessionType + "_" + labBatch;
  let students = getCache(stuCacheKey);
  if (!students) {
    students = getEligibleStudents(subjectCode, sessionType, labBatch, "ALL");
    setCache(stuCacheKey, students, 120000); // 2 min cache
  }

  const student = students.find(s => String(s[0]) === String(studentId));

  if (!student) {
    // Check if student exists at all in the college
    const allStu = getCache("allstu_ALL") || (() => {
      const d = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
      setCache("allstu_ALL", d, 120000);
      return d;
    })();

    const exists = allStu.find(s => String(s[0]) === String(studentId));
    if (exists) {
      // Student exists but wrong batch
      if (sessionType === "LAB" && labBatch !== "ALL" && String(exists[4]) !== labBatch) {
        return jsonResponse({ ok:false, error:"You belong to Lab Batch " + exists[4] + ", not Batch " + labBatch + ". Please attend your correct batch session." });
      }
    }
    return jsonResponse({ ok:false, error:"Roll number " + studentId + " not found. Please check and try again." });
  }

  // ── 3. Anti-proxy — cached Sets per session ──
  const scanStuKey = "sc_s_" + sessionId;
  const scanDevKey = "sc_d_" + sessionId;

  let stuSet = getCache(scanStuKey);
  let devSet = getCache(scanDevKey);

  if (!stuSet) {
    stuSet = new Set();
    devSet = new Set();
    const sc    = getSheet(TABS.SCANS);
    const lastR = sc.getLastRow();
    if (lastR > 1) {
      const rows = sc.getRange(2, 1, lastR-1, 6).getValues();
      rows.forEach(r => {
        if (r[0] === sessionId && r[5] === "VALID") {
          stuSet.add(String(r[2]));
          if (r[3] && r[3] !== "UNKNOWN") devSet.add(String(r[3]));
        }
      });
    }
    setCache(scanStuKey, stuSet, 1800000);
    setCache(scanDevKey, devSet, 1800000);
  }

  if (stuSet.has(String(studentId))) {
    return jsonResponse({ ok:false, error:"You have already marked attendance for this session" });
  }
  if (deviceId && deviceId !== "UNKNOWN" && devSet.has(deviceId)) {
    getSheet(TABS.SCANS).appendRow([sessionId, userId, studentId, deviceId, now.toISOString(), "PROXY", lat||"", lng||""]);
    return jsonResponse({ ok:false, error:"Proxy attempt blocked — this device already marked another student" });
  }

  // ── 4. Record scan ──
  getSheet(TABS.SCANS).appendRow([sessionId, userId, studentId, deviceId||"UNKNOWN", now.toISOString(), "VALID", lat||"", lng||""]);
  stuSet.add(String(studentId));
  if (deviceId && deviceId !== "UNKNOWN") devSet.add(deviceId);

  return jsonResponse({ ok:true, message:"Attendance marked!", studentName: String(student[1]) });
}

// ============================================================
//  STUDENTS — no professor ownership
// ============================================================
function getStudents(body) {
  verifyUser(body.userId, body.pin);
  const cached = getCache("students_all");
  const data   = cached || getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  if (!cached) setCache("students_all", data, 60000);

  const students = data.map(r => ({
    id: String(r[0]), name: r[1], email: r[2],
    joiningBatch: r[3], labBatch: r[4]
  }));
  return jsonResponse({ ok:true, students });
}

function addStudent(body) {
  verifyUser(body.userId, body.pin);
  getSheet(TABS.STUDENTS).appendRow([
    body.studentId, body.name, body.email||"",
    body.joiningBatch||"2024-25",
    body.labBatch||"A",
    new Date().toISOString()
  ]);
  clearCache("students_");
  clearCache("allstu_");
  return jsonResponse({ ok:true });
}

function removeStudent(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.studentId)) {
      sheet.deleteRow(i+1);
      clearCache("students_");
      clearCache("allstu_");
      return jsonResponse({ ok:true });
    }
  }
  return jsonResponse({ ok:false, error:"Student not found" });
}

function importStudents(body) {
  verifyUser(body.userId, body.pin);
  const sheet = getSheet(TABS.STUDENTS);
  const now   = new Date().toISOString();
  // Check for duplicates before inserting
  const existing = new Set(
    sheet.getDataRange().getValues().slice(1).map(r => String(r[0]))
  );
  const newRows = body.students
    .filter(s => !existing.has(String(s.id)))
    .map(s => [
      s.id, s.name, s.email||"",
      s.joiningBatch||"2024-25",
      s.labBatch||"A",
      now
    ]);
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow()+1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
  clearCache("students_");
  clearCache("allstu_");
  return jsonResponse({ ok:true, count: newRows.length, skipped: body.students.length - newRows.length });
}

// ============================================================
//  ANALYTICS
// ============================================================
function getAttendance(body) {
  verifyUser(body.userId, body.pin);

  // Get ALL students (no professor filter)
  const stuData  = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  const students = stuData.map(r => ({
    id: String(r[0]), name: r[1], email: r[2],
    joiningBatch: r[3], labBatch: r[4]
  }));

  // Get attendance for this professor's subject only
  const attData = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const records = {};
  for (let i = 1; i < attData.length; i++) {
    const [,profId,studentId,subjectCode,sessionType,,date,present] = attData[i];
    if (String(profId) !== String(body.userId)) continue;
    const key = subjectCode + "|" + sessionType;
    if (!records[key]) records[key] = {};
    if (!records[key][date]) records[key][date] = {};
    records[key][date][String(studentId)] = present === 1;
  }
  return jsonResponse({ ok:true, attendance:records, students });
}

function getHODDashboard(body) {
  verifyUser(body.userId, body.pin);
  const attData  = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const stuData  = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  const stuMap   = {};
  stuData.forEach(r => { stuMap[String(r[0])] = { name:r[1], joiningBatch:r[3], labBatch:r[4] }; });

  const bySubject={}, byJoinBatch={}, byLabBatch={}, studentSubjectMap={};

  for (let i = 1; i < attData.length; i++) {
    const [,,studentId,subjectCode,sessionType,,date,present] = attData[i];
    const key = subjectCode + "|" + sessionType;

    if (!bySubject[key]) bySubject[key] = { present:0, total:0, sessions:new Set() };
    bySubject[key].total++;
    bySubject[key].sessions.add(date);
    if (present===1) bySubject[key].present++;

    const stu = stuMap[String(studentId)];
    if (stu) {
      const jk = stu.joiningBatch;
      if (!byJoinBatch[jk]) byJoinBatch[jk] = { present:0, total:0 };
      byJoinBatch[jk].total++;
      if (present===1) byJoinBatch[jk].present++;

      const lk = stu.labBatch;
      if (!byLabBatch[lk]) byLabBatch[lk] = { present:0, total:0 };
      byLabBatch[lk].total++;
      if (present===1) byLabBatch[lk].present++;
    }

    const sk = String(studentId)+"|"+subjectCode+"|"+sessionType;
    if (!studentSubjectMap[sk]) studentSubjectMap[sk] = { present:0, total:0, studentId:String(studentId) };
    studentSubjectMap[sk].total++;
    if (present===1) studentSubjectMap[sk].present++;
  }

  Object.values(bySubject).forEach(v => { v.sessions = v.sessions.size; });

  const atRiskList = [];
  Object.entries(studentSubjectMap).forEach(([key,v]) => {
    const pct = v.total >= 3 ? Math.round(v.present/v.total*100) : null;
    if (pct !== null && pct < MIN_ATTENDANCE_PCT) {
      const stu = stuMap[v.studentId];
      const [,sub,type] = key.split("|");
      atRiskList.push({ studentId:v.studentId, name:stu?stu.name:v.studentId, subject:sub, type, pct, present:v.present, total:v.total });
    }
  });

  return jsonResponse({ ok:true, bySubject, byJoinBatch, byLabBatch, atRiskList,
    subjects:SUBJECTS, labBatches:LAB_BATCHES, joiningBatches:JOINING_BATCHES });
}

// ============================================================
//  EMAIL
// ============================================================
function buildReport(userId, students, presentIds, subjectCode, sessionType, labBatch, dateStr, sessionId) {
  const total       = students.length;
  const present     = presentIds.size;
  const absent      = total - present;
  const pct         = total ? Math.round(present/total*100) : 0;
  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  const absentees   = students.filter(s => !presentIds.has(String(s[0])));

  const absentRows = absentees.map(s =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s[0]}</td>
     <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s[1]}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
  <div style="background:#1a1a2e;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="font-size:22px;font-weight:900"><span style="color:#ea4335">data</span><span style="color:#6DBE45">vedha</span></span>
    <span style="color:rgba(255,255,255,0.45);font-size:13px;margin-left:12px">Attendance Report</span>
  </div>
  <div style="border:1px solid #e8eaf6;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <h2 style="color:#1e293b;margin:0 0 4px">${subjectName} — ${sessionType}</h2>
    <p style="color:#64748b;margin:0 0 20px">${dateStr}${labBatch!=="ALL"?" · Batch "+labBatch:""}</p>
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
    ${absentees.length > 0
      ? `<h3 style="color:#ea4335;margin:0 0 10px">Absent (${absentees.length})</h3>
         <table style="width:100%;border-collapse:collapse;font-size:13px">
           <thead><tr style="background:#fce8e6">
             <th style="padding:8px 12px;text-align:left">Roll No.</th>
             <th style="padding:8px 12px;text-align:left">Name</th>
           </tr></thead>
           <tbody>${absentRows}</tbody>
         </table>`
      : `<p style="color:#34a853;font-weight:700">🎉 Full attendance today!</p>`}
    <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #f0f0f0;padding-top:12px">
      Powered by <strong>datavedha</strong> · ${new Date().toLocaleString("en-IN")}
    </p>
  </div>
</div>`;

  return { html, summary:{ total, present, absent, pct, subjectCode, sessionType, labBatch, dateStr } };
}

function sendEmail(userId, report, subjectCode, sessionType, dateStr) {
  const data = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  let email  = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) { email = data[i][2]; break; }
  }
  if (!email) return;
  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  GmailApp.sendEmail(email,
    `[DataVedha] ${subjectName} ${sessionType} — ${dateStr}`,
    "Please view in HTML format.",
    { htmlBody: report.html, name: "DataVedha Attendance" }
  );
}

function sendAtRiskAlert(userId, subjectCode, sessionType) {
  const attData = getSheet(TABS.ATTENDANCE).getDataRange().getValues();
  const stuData = getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  const stuMap  = {};
  stuData.forEach(r => { stuMap[String(r[0])] = { name:r[1] }; });

  const perStudent = {};
  for (let i = 1; i < attData.length; i++) {
    const [,profId,studentId,subCode,sessType,,,present] = attData[i];
    if (String(profId) !== String(userId) || subCode !== subjectCode || sessType !== sessionType) continue;
    if (!perStudent[studentId]) perStudent[studentId] = { present:0, total:0 };
    perStudent[studentId].total++;
    if (present === 1) perStudent[studentId].present++;
  }

  const atRisk = [];
  Object.entries(perStudent).forEach(([sid,v]) => {
    const pct = v.total >= 3 ? Math.round(v.present/v.total*100) : null;
    if (pct !== null && pct < MIN_ATTENDANCE_PCT) {
      const stu = stuMap[sid];
      if (stu) atRisk.push({ id:sid, name:stu.name, pct, present:v.present, total:v.total });
    }
  });

  if (!atRisk.length) return;

  const profData = getSheet(TABS.PROFESSORS).getDataRange().getValues();
  let profEmail  = null;
  for (let i = 1; i < profData.length; i++) {
    if (String(profData[i][0]) === String(userId)) { profEmail = profData[i][2]; break; }
  }
  if (!profEmail) return;

  const subjectName = SUBJECTS.find(s => s.code === subjectCode)?.name || subjectCode;
  const rows = atRisk.map(s =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.id}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.name}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;color:#ea4335;font-weight:700">${s.pct}%</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5">${s.present}/${s.total}</td></tr>`
  ).join("");

  const html = `
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
  <div style="background:#1a1a2e;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="font-size:20px;font-weight:900"><span style="color:#ea4335">data</span><span style="color:#6DBE45">vedha</span></span>
    <span style="color:rgba(255,255,255,0.45);font-size:13px;margin-left:12px">⚠️ At-Risk Alert</span>
  </div>
  <div style="border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;margin-bottom:20px">
      <strong style="color:#92400e">⚠️ ${atRisk.length} student${atRisk.length>1?"s":""} below ${MIN_ATTENDANCE_PCT}%</strong>
      <p style="color:#a16207;font-size:13px;margin:4px 0 0">Subject: ${subjectName} · ${sessionType}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#fef3c7">
        <th style="padding:8px 12px;text-align:left">Roll No.</th>
        <th style="padding:8px 12px;text-align:left">Name</th>
        <th style="padding:8px 12px;text-align:left">Attendance</th>
        <th style="padding:8px 12px;text-align:left">Sessions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#aaa;font-size:11px;margin-top:20px">Powered by datavedha · ${new Date().toLocaleString("en-IN")}</p>
  </div>
</div>`;

  GmailApp.sendEmail(profEmail,
    `[DataVedha] ⚠️ At-Risk Alert — ${subjectName} ${sessionType}`,
    "Please view in HTML.",
    { htmlBody: html, name: "DataVedha Attendance" }
  );
}

// ============================================================
//  HELPERS
// ============================================================
function getEligibleStudents(subjectCode, sessionType, labBatch, joiningBatch) {
  // New model — students are college-wide, filtered by batch only
  const cached = getCache("students_all");
  const data   = cached || getSheet(TABS.STUDENTS).getDataRange().getValues().slice(1);
  if (!cached) setCache("students_all", data, 120000);

  return data.filter(r => {
    // Filter by lab batch for LAB sessions
    if (sessionType === "LAB" && labBatch !== "ALL" && String(r[4]) !== labBatch) return false;
    // Filter by joining batch if specified
    if (joiningBatch && joiningBatch !== "ALL" && String(r[3]) !== joiningBatch) return false;
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
    [TABS.PROFESSORS]: ["ID","Name","Email","PIN","Role","Department","Active","CreatedAt","SubjectCode"],
    [TABS.STUDENTS]:   ["StudentID","Name","Email","JoiningBatch","LabBatch","CreatedAt"],
    [TABS.SESSIONS]:   ["SessionID","UserID","SubjectCode","SessionType","LabBatch","JoiningBatch","Date","StartedAt","ExpiresAt","Token","Status","PresentCount"],
    [TABS.ATTENDANCE]: ["SessionID","UserID","StudentID","SubjectCode","SessionType","LabBatch","Date","Present"],
    [TABS.SCANS]:      ["SessionID","UserID","StudentID","DeviceID","ScannedAt","Status","Lat","Lng"],
  };
  if (h[name]) {
    sheet.appendRow(h[name]);
    sheet.getRange(1,1,1,h[name].length).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
  }
}

function randomStr(n) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "";
  for (let i = 0; i < n; i++) r += c[Math.floor(Math.random()*c.length)];
  return r;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  ONE-TIME SETUP & REGISTRATION
// ============================================================
function initialSetup() {
  ["Professors","Students","Sessions","Attendance","Scans"].forEach(name => getSheet(name));
  Logger.log("✅ All sheets created with new schema");
}

// ── IMPORTANT: Fix existing Students sheet ──
// Run this ONCE to remove the old ProfessorID column and fix the schema
function migrateStudentsSheet() {
  const sheet = getSheet(TABS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  
  // Check if old schema (has ProfessorID in col E = index 4)
  // Old: StudentID, Name, Email, JoiningBatch, ProfessorID, LabBatch, SubjectCode, CreatedAt
  // New: StudentID, Name, Email, JoiningBatch, LabBatch, CreatedAt
  
  if (data[0][4] === "ProfessorID") {
    Logger.log("Migrating from old schema...");
    // Clear and rewrite with new schema
    const newRows = [["StudentID","Name","Email","JoiningBatch","LabBatch","CreatedAt"]];
    for (let i = 1; i < data.length; i++) {
      const [studentId, name, email, joiningBatch, profId, labBatch, subjectCode, createdAt] = data[i];
      if (!studentId) continue;
      // LabBatch was in column F (index 5), moving to column E (index 4)
      newRows.push([studentId, name, email, joiningBatch||"2024-25", labBatch||"A", createdAt||new Date().toISOString()]);
    }
    sheet.clearContents();
    sheet.getRange(1, 1, newRows.length, newRows[0].length).setValues(newRows);
    sheet.getRange(1,1,1,6).setFontWeight("bold").setBackground("#1a1a2e").setFontColor("#ffffff");
    Logger.log("✅ Migrated " + (newRows.length-1) + " students");
  } else {
    Logger.log("Schema already up to date");
  }
}

function keepAlive() {
  Logger.log("DataVedha keepAlive — " + new Date().toISOString());
  SpreadsheetApp.openById(SHEET_ID).getName();
}

function registerMe() {
  const result = registerProfessor({
    id:"PHYS03T", name:"Dr Maheswara Rao", email:"vmrao2k8@gmail.com",
    pin:"1234", role:"tutor", dept:"Physiology", subjectCode:"PHYS"
  });
  Logger.log(result.getContent());
}

function registerAllStaff() {
  const staff = [
    { id:"PHYS01P", name:"Dr Syamala Devi",      email:"vmrao2k8@gmail.com", pin:"1234", role:"professor",      dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS02P", name:"Dr AV Suresh Babu",    email:"vmrao2k8@gmail.com", pin:"1234", role:"professor",      dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS03P", name:"Dr Himavathy",          email:"vmrao2k8@gmail.com", pin:"1234", role:"professor",      dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS01A", name:"Dr Jaya Balakrishnan", email:"vmrao2k8@gmail.com", pin:"1234", role:"asst_professor", dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS02A", name:"Dr Swati Lakshmi",     email:"vmrao2k8@gmail.com", pin:"1234", role:"asst_professor", dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS01T", name:"Dr Manas",             email:"vmrao2k8@gmail.com", pin:"1234", role:"tutor",          dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS02T", name:"Dr Harika",            email:"vmrao2k8@gmail.com", pin:"1234", role:"tutor",          dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS03T", name:"Dr Maheswara Rao",     email:"vmrao2k8@gmail.com", pin:"1234", role:"tutor",          dept:"Physiology", subjectCode:"PHYS" },
    { id:"PHYS04T", name:"Dr Prasada Rao",       email:"vmrao2k8@gmail.com", pin:"1234", role:"tutor",          dept:"Physiology", subjectCode:"PHYS" },
  ];
  let success = 0, skipped = 0;
  staff.forEach(s => {
    const result = JSON.parse(registerProfessor(s).getContent());
    if (result.ok) { success++; Logger.log("✅ " + s.name); }
    else { skipped++; Logger.log("⚠️ Skipped: " + s.name + " — " + result.error); }
  });
  Logger.log("Done — " + success + " registered, " + skipped + " skipped.");
}
