# Training Management and Learning Progress Platform

A complete, full-stack Training Management and Learning Progress Platform built with **React.js (Vite + TypeScript + Tailwind CSS)** and **Python FastAPI (SQLAlchemy 2.0 + Argon2id + WebSockets)**.

The platform provides three independent, role-secured portals:
1. **Admin Portal**: Curriculum design, dynamic multi-track programs (4-in-1, 5-in-1, custom), student & employee accounts, teams, program access, checklist builder, attendance, and audit logs.
2. **Employee / Teacher Portal**: Assigned students, submission review & grading, checklist tracking, attendance recording, and real-time chat.
3. **Student Portal**: Independent sequential learning day progression, interactive daily checklists with auto-unlocking, assignment file uploads & text submissions, attendance review, and real-time messaging with assigned teachers.

---

## Technology Stack

- **Frontend**: React 18, Vite 6, TypeScript, Tailwind CSS, Lucide React, Recharts, Wouter, TanStack Query, `@vitejs/plugin-basic-ssl` (Local HTTPS).
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PyJWT, Argon2id (`passlib` + `argon2-cffi`), FastAPI WebSockets.
- **Database**: PostgreSQL (with automatic zero-config SQLite development fallback).
- **File Storage**: Local filesystem disk storage (`storage/uploads`) with authenticated permission-checked downloads.
- **Real-Time Communication**: FastAPI WebSockets + PostgreSQL persistent chat messages.

---

## Minimum Demo Authentication Accounts

In compliance with specification Section 17, the application starts with **zero fictional business data** (no fake programs, no fake teams, no fake attendance). Only the 3 minimum requested authentication test accounts are initialized:

| Portal | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin Portal** | `admin` | `agentopslabs@gmail.com` | `Gvenkat@123` |
| **Teacher Portal** | `employee` | `employee@training.local` | `EmployeePass123!` |
| **Student Portal** | `student` | `student@training.local` | `StudentPass123!` |

*(Tip: On the login page, you can click the quick **Admin**, **Employee**, or **Student** test buttons to auto-populate these credentials with one click).*

---

## Windows Local Setup Instructions

### 1. Prerequisites
- **Python 3.10+**: Download and install from [python.org](https://www.python.org/). Check "Add Python to PATH" during installation.
- **Node.js 18+ & npm**: Download and install LTS from [nodejs.org](https://nodejs.org/).
- *(Optional)* **PostgreSQL**: Download and install from [postgresql.org](https://www.postgresql.org/). If not installed, the platform automatically defaults to local SQLite with zero setup required.

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```

### 3. Backend Setup & Account Initialization
Open a PowerShell terminal in the repository root:
```powershell
# Install backend dependencies
python -m pip install -r backend/requirements.txt

# Initialize database tables and create the 3 test authentication accounts
python backend/init_db.py
```

### 4. Running the FastAPI Backend
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is available at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 5. Frontend Setup & Running Local HTTPS
Open a second PowerShell terminal in `frontend/`:
```powershell
cd frontend
npm install
npm run dev
```
The frontend will start with a trusted local HTTPS certificate at:
- **`https://localhost:5173`** (or `http://localhost:5173`)

### 6. Running Automated Tests
Run the test suite covering authentication, day locking, sequential progression, and checklist auto-unlocking:
```powershell
python -m pytest backend/tests/test_backend.py -v
```

---

## Sequential Progression Engine Details

- **Independent Progression**: Each learning track in a program progresses independently. Day 1 of each track is available upon enrollment. Completing Track 1 Day 1 unlocks Track 1 Day 2; it does NOT unlock Track 2 Day 2.
- **Mandatory Requirements**: A day unlocks when all mandatory conditions are satisfied:
  1. All required checklist items are marked complete.
  2. If a daily task is required, it must be submitted (and approved by a teacher if teacher approval is configured).
- **Backend Enforcement**: Day locking is strictly verified by the FastAPI backend (`verify_student_day_access`). Direct API requests to locked days return `403 Forbidden` with the specific missing prerequisite.
- **Private Disk Storage**: Uploaded assignment files are stored privately in `storage/uploads/` with unique UUID filenames and cannot be accessed without authenticated role/ownership verification.
