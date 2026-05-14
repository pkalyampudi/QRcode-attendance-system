# Attendance System — Complete Deployment Guide
# Dr. V Maheswara Rao · Medical College · Physiology Dept
# ============================================================
# Total cost: ₹0/month (uses Google free tier + Netlify free tier)
# Time to deploy: ~30 minutes
# ============================================================


## STEP 1 — Create the Google Sheet (your free database)

1. Go to https://sheets.google.com → click "+ Blank spreadsheet"
2. Name it: "Attendance System DB"
3. Copy the Sheet ID from the URL:
      https://docs.google.com/spreadsheets/d/  >>>THIS_LONG_ID<<<  /edit
4. Save this ID — you'll need it in Step 2.

The backend will auto-create these tabs when it first runs:
  • Professors   — professor accounts
  • Students     — student rosters per professor
  • Sessions     — each QR session
  • Attendance   — daily records
  • Scans        — raw scan log (anti-proxy evidence)


## STEP 2 — Deploy the Google Apps Script backend (free API server)

1. Go to https://script.google.com → click "+ New project"
2. Name it: "Attendance System API"
3. Delete all existing code in the editor
4. Open the file:  backend/Code.gs  from this project
5. Paste the ENTIRE contents into the Apps Script editor
6. On line 6, replace YOUR_GOOGLE_SHEET_ID_HERE with your Sheet ID from Step 1:
      const SHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms";
7. Click "Save" (floppy disk icon)
8. Click "Deploy" → "New deployment"
9. Settings:
      Type:         Web app
      Description:  v1
      Execute as:   Me (your Google account)
      Who has access: Anyone
10. Click "Deploy" → Google asks you to authorise → click "Allow"
11. COPY the Web App URL — looks like:
      https://script.google.com/macros/s/AKfycbx.../exec
    Save this — you'll need it in Step 3.

Important: Every time you edit Code.gs, you must redeploy:
  Deploy → Manage deployments → edit → New version → Deploy


## STEP 3 — Register the first professor account (yourself)

Open this URL in your browser (replace with your actual Web App URL and your details):

  https://YOUR_WEB_APP_URL/exec?   ← don't use this format, use the POST below

Instead, run this one-time script in your browser console OR use curl:

curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "registerProfessor",
    "id":     "12345",
    "name":   "Dr. V Maheswara Rao",
    "email":  "vmrao2k8@gmail.com",
    "pin":    "1234"
  }'

→ Change "1234" to any 4-digit PIN you want. This is your login password.
→ Repeat this for each professor at your college (use different IDs and PINs).


## STEP 4 — Set up the frontend and deploy to Netlify (free hosting)

Prerequisites: Node.js 18+ and Git installed on your computer.

### 4a. Install and configure
  cd attendance-system
  cp .env.example .env
  # Open .env and paste your Web App URL from Step 2:
  #   VITE_API_URL=https://script.google.com/macros/s/YOUR_ID/exec
  npm install

### 4b. Test locally
  npm run dev
  # Opens http://localhost:5173
  # Login with professor ID: 12345, PIN: 1234 (whatever you set in Step 3)

### 4c. Deploy to Netlify
Option A — Drag & drop (no account needed):
  npm run build
  # Go to https://app.netlify.com/drop
  # Drag the  dist/  folder onto the page
  # Netlify gives you a URL like  https://random-name.netlify.app
  # That's your live app URL!

Option B — Git (recommended, enables auto-deploy on code change):
  git init && git add . && git commit -m "initial"
  # Push to GitHub (create a repo at github.com)
  git remote add origin https://github.com/YOURNAME/attendance-system.git
  git push -u origin main
  # Go to app.netlify.com → "Add new site" → "Import from Git"
  # Connect GitHub → select your repo
  # Build command:    npm run build
  # Publish directory: dist
  # Add environment variable: VITE_API_URL = your Apps Script URL
  # Click Deploy!

### 4d. Set up the /scan route (critical for student QR scanning)
  Netlify already handles this via public/_redirects (included in this project).
  No extra config needed.


## STEP 5 — Share with professors

Each professor needs:
  1. The app URL:  https://your-app.netlify.app
  2. Their Professor ID  (the ID you gave them in Step 3)
  3. Their PIN           (the PIN you set for them in Step 3)

They can bookmark it or add to homescreen (it's a PWA):
  iPhone: Safari → Share → "Add to Home Screen"
  Android: Chrome → menu → "Add to Home Screen"


## STEP 6 — Import students

Option A — CSV import (fastest for 200 students):
  1. Create a CSV file with columns:  StudentID, Name, Email
  2. Example:
       StudentID,Name,Email
       101,Ramesh Kumar,ramesh@med.edu
       102,Priya Sharma,priya@med.edu
  3. In the app → Students tab → "Import CSV" → select your file

Option B — Use your existing student_data.xlsx:
  Open the Excel file → File → Save As → CSV
  Then use Option A above.

Option C — Add one by one in the app (Students tab → Add student)


## STEP 7 — Daily workflow for professor

1. Open the app on your phone
2. Click "Generate QR code"
3. A QR appears — show it on screen or print it (stays for 15 min)
4. Students enter class and scan with their phones → enter their student ID
5. Watch the live counter tick up
6. After ~15 min, click "Submit attendance"
7. Report automatically emailed to vmrao2k8@gmail.com
8. Check Analytics tab for week/month/semester views


## ANTI-PROXY MECHANISMS (built in)

The system blocks proxies using three layers:
  1. Time lock    — QR expires after exactly 15 minutes
  2. Token uniqueness — every session has a cryptographically random token
  3. Device fingerprint — each device can only mark ONE student per session
     (uses browser fingerprinting stored in localStorage)
  4. Duplicate detection — same student ID cannot scan twice per session
  5. All proxy attempts are logged in the Scans sheet with status = "PROXY"


## COST BREAKDOWN

  Google Sheets:    Free (15 GB storage, 200 students × 365 days = tiny)
  Google Apps Script: Free (6 min/day execution limit — more than enough)
  Gmail API:        Free (100 emails/day via GmailApp — plenty)
  Netlify hosting:  Free (100 GB bandwidth/month)
  Domain:           Optional — Netlify gives you a free .netlify.app domain

  TOTAL: ₹0/month


## SCALING TO MORE PROFESSORS

To add a new professor:
  1. Run the registerProfessor curl command (Step 3) with their details
  2. Share the app URL + their ID + PIN
  3. They import their own student roster
  4. Everything is isolated by professorId in the database

One Google Sheet handles all professors.
One Netlify deployment serves all professors.
Each professor only sees their own students and attendance data.


## TROUBLESHOOTING

Problem: "Authentication failed" on login
  Fix: Check professor ID and PIN. Re-run Step 3 registration.

Problem: CORS error when calling API
  Fix: In Apps Script → Deploy → Make sure "Who has access" = Anyone

Problem: QR scan says "Student ID not found"
  Fix: Student must be added to the professor's roster first (Students tab)

Problem: Email not received
  Fix: Check spam. Apps Script uses your Gmail — make sure it's authorised.
  In Apps Script → Services → check GmailApp is enabled.

Problem: "Session already submitted"
  Fix: Normal — means Submit was clicked twice. Data is saved correctly...
