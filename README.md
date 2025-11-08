# NOID – Dynamic ID Card Generation Web App

Flask + MySQL web app to generate student ID cards by PID. Frontend is HTML + CSS (no framework). Database seeds a few sample students and auto-migrates on first run.

## Quick start

1) Start MySQL and confirm credentials in `app.py` under `MYSQL_CONFIG` (defaults to `root/pooja@2006`, DB `noid_db`). The app will create DB/tables and seed data automatically.

2) Create venv and install deps (Windows PowerShell):
```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

3) Run the app:
```bash
python app.py
```
Open `http://localhost:5000`, enter a PID (e.g., EU1244001, EU1244003, EU1244004, EU1244051), and view the generated ID card.

4) Images
- Homepage/logo: `static/photos/NOID.jpg`
- Aldel logo (ID card right): `static/photos/aldel.jpg`
- Student photos: `static/photos/<filename>` (e.g., `pooja.jpg`)

---

## Presentation (PPT) – Script and Slide Outline

Copy/paste into your slides editor (Google Slides/PowerPoint). Each bullet is a slide; indented lines are talking points.

1. Title – NOID: Dynamic ID Card Generation Web App
   - Team: Solo (Pooja) | Stack: Flask, MySQL, HTML/CSS
   - Demo-first project to generate student IDs by PID

2. Problem & Goal
   - Manual ID creation is slow/error-prone
   - Goal: Instant, consistent ID cards from a trusted database

3. High-Level Architecture
   - Client: HTML form submits PID
   - Server: Flask routes (`/`, `/generate`)
   - DB: MySQL (`students` table)
   - Static assets: photos and logos

4. Tech Stack & Rationale
   - Flask: simple, fast to develop
   - MySQL: familiar RDBMS, easy seeding/migrations
   - HTML/CSS: lightweight, no JS framework

5. Database Design
   - Table: `students(pid PK, name, course, department, dob, email, contact, photo_url)`
   - PID is VARCHAR → supports alphanumeric IDs (e.g., EU1244001)

6. Backend Flow (Code tour)
   - `create_app()` configures routes and DB initialization
   - `ensure_database_and_tables()` creates DB/tables, adds columns if missing, seeds data
   - `fetch_student_by_pid(pid)` returns row and builds `url_for('static', ...)` photo URL

7. Frontend Flow
   - `templates/index.html`: single input form for PID within a responsive card
   - `templates/id_card.html`: prints card with logos, photo, name, PID, course, year, DOB
   - `static/style.css`: responsive, modern gradients and shadows

8. Demo
   - Try PIDs: EU1244001, EU1244003, EU1244004, EU1244051
   - Show photo rendering and layout

9. Security & Validation (current + next)
   - Current: server-side parameter binding prevents SQL injection
   - Next: auth for admin pages, rate-limits, input normalization

10. Challenges & Fixes
   - Migrating `pid` from INT → VARCHAR to support alphanumeric IDs
   - Handling missing logos via graceful fallbacks
   - Making the design responsive without a framework

11. Results
   - <1s card generation, consistent format
   - Clean UX for non-technical staff

12. Roadmap
   - Admin CRUD for students; CSV import
   - Export PNG/PDF; batch generation
   - Theming; print layout optimizations

13. Thank You / Q&A
   - Repo walkthrough or live code if time

---

## PPT (Emoji Slides to Copy-Paste)

- 🏷️ Title: NOID – Dynamic ID Card Generator
  - 👩‍💻 Pooja • 🧩 Flask + MySQL + HTML/CSS • ⚡ Demo-first

- 🎯 Problem → Goal
  - ❌ Manual, slow, inconsistent IDs
  - ✅ Instant, accurate, standardized IDs from DB

- 🏗️ Architecture
  - 🖥️ Client: HTML form (PID)
  - 🐍 Server: Flask (`/`, `/generate`)
  - 🗄️ DB: MySQL `students`
  - 🖼️ Assets: logos + photos

- 🧰 Stack Choices
  - 🐍 Flask: lightweight, fast
  - 🗄️ MySQL: reliable, familiar
  - 🎨 HTML/CSS: zero framework overhead

- 📊 Database Schema
  - 🔑 `pid` (VARCHAR) • `name` • `course` • `department` • `dob` • `email` • `contact` • `photo_url`
  - ✨ Alphanumeric PID supported (e.g., EU1244001)

- 🔁 Flow
  - ✍️ Enter PID → 📡 POST `/generate` → 🔎 Query → 🖨️ Render `id_card.html`

- 🧩 Key Backend Bits
  - 🔧 Auto-create DB/tables and seed on first run
  - 🛡️ Parameterized queries (safe)
  - 🖼️ `url_for('static', ...)` for images

- 🖼️ Frontend Highlights
  - 🏠 `index.html`: clean card with single PID input
  - 🪪 `id_card.html`: photo + name + PID + course + year + DOB
  - 📱 Responsive CSS, elegant gradients/shadows

- 🧪 Demo PIDs
  - 🆔 EU1244001 • EU1244003 • EU1244004 • EU1244051

- 🧱 Challenges → ✅ Fixes
  - 🔢 INT → VARCHAR migration for PID
  - 🖼️ Logo fallbacks to avoid broken images
  - 📱 Responsive layout without JS framework

- 🔐 Security (now → next)
  - ✅ Param binding; no SQL injection
  - 🔜 Auth, rate limits, admin roles

- 📈 Results
  - ⚡ <1s card generation • 🎯 Consistency • 😀 Simple UX

- 🗺️ Roadmap
  - 🧑‍💼 Admin CRUD • 📥 CSV import • 🖨️ PDF/PNG export • 🎨 Themes

- 🙏 Thank You / Q&A
  - 💡 Code tour • 🧪 Live demo • 📂 Repo overview

## Project Report (Black Book)

Use this as your black book content. Replace placeholders like <Your Name> and expand screenshots.

### 1. Title Page
- Title: NOID – Dynamic ID Card Generation Web App
- Author: <Your Name>
- Department: B.Tech IT
- Date: <Submission Date>

### 2. Abstract
This project implements a web application that generates student ID cards dynamically using a PID. The system includes a clean HTML/CSS frontend, a Python Flask backend, and a MySQL database. It automates ID creation, improves consistency, and reduces manual errors.

### 3. Objectives
- Build a minimal, fast, and reliable ID generator
- Store and fetch student records from MySQL
- Render a professional ID card with logos and photo
- Keep UX responsive and printer-friendly

### 4. Existing System vs Proposed System
- Existing: Manual design in editors; time-consuming; inconsistent
- Proposed: Data-driven, template-based generation; instant and standardized

### 5. Scope
- Department use for semester/yearly IDs
- Extensible for staff/visitor passes with minor template changes

### 6. System Requirements
- Python 3.9+, MySQL 8+
- OS: Windows 10/11 (tested), others supported

### 7. Technology Stack
- Frontend: HTML5, CSS3
- Backend: Python 3 (Flask)
- Database: MySQL
- Libraries: `mysql-connector-python`

### 8. System Design
- Architecture: Client (form) → Flask → MySQL → Template render
- Routes: `/` (form), `/generate` (POST → render card)
- Assets: `static/photos/*` for student and logo images

### 9. Database Design
Table `students` (final migrated schema):
- `pid` VARCHAR(32) PRIMARY KEY
- `name` VARCHAR(100)
- `course` VARCHAR(50)
- `department` VARCHAR(100)
- `dob` VARCHAR(20)
- `email` VARCHAR(120)
- `contact` VARCHAR(30)
- `photo_url` VARCHAR(255)

### 10. Implementation Details
- DB bootstrap in `ensure_database_and_tables()` creates and seeds rows if missing
- Template builds correct static image URLs with `url_for('static', ...)`
- Responsive card achieved with CSS grid/flex and media queries

### 11. Test Cases
- Valid PID returns populated card
- Invalid/empty PID shows error and back link
- Missing photo/logo still renders layout with graceful fallbacks

### 12. Screenshots (to paste)
- Homepage (PID input)
- Valid ID card for each seeded PID

### 13. Usage Instructions
1. Update MySQL credentials in `app.py` if needed
2. Install requirements and run `python app.py`
3. Visit `http://localhost:5000` and enter PID

### 14. Security Considerations
- Parameterized queries prevent injection
- Future: authentication/authorization for admin edits, audit logs

### 15. Future Enhancements
- Admin panel for CRUD and CSV import
- PDF/PNG export
- Printer margins and bleed safe area template

### 16. Conclusion
The application demonstrates an end‑to‑end pipeline for generating standardized ID cards from structured data, with a clean UI, modular backend, and maintainable schema.

---

## Troubleshooting
- 1366 error (Incorrect integer value for `pid`): drop old DB or let migration alter `pid` to `VARCHAR(32)` and retry
- MySQL connection errors: verify `MYSQL_CONFIG` host/user/password
- Images not loading: ensure files exist under `static/photos/` with correct names

## Project Structure
```
NOID/
  app.py
  requirements.txt
  schema.sql
  templates/
    index.html
    id_card.html
  static/
    style.css
    photos/
      NOID.jpg
      aldel.jpg
      <student-photos>
```

