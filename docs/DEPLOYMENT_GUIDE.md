# 🚀 DineBuddy Cloud Deployment & Workflow Guide

Complete guide for managing, updating, and maintaining the deployed **DineBuddy** full-stack application.

---

## 🌐 Live Infrastructure Overview

| Component | Platform / Host | Live URL / Connection | Status |
| :--- | :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) | `https://dinebuddy.vercel.app/` | 🟢 Active |
| **Backend** | [Render](https://render.com) | `https://dinebuddy.onrender.com/api/v1` | 🟢 Active |
| **Swagger API Docs** | Render | `https://dinebuddy.onrender.com/docs` | 🟢 Active |
| **Database** | [Supabase](https://supabase.com) | `aws-1-ap-northeast-2.pooler.supabase.com:6543` | 🟢 Active |
| **Repository** | [GitHub](https://github.com) | `https://github.com/stuartevil/dinebuddy.git` | 🟢 Active |

---

## 🔑 Default Initial Credentials

### Platform Super Admin Login
* **URL:** `https://dinebuddy.vercel.app/`
* **Email:** `admin@dinebuddy.com`
* **Password:** `Admin@123`

---

## ⚙️ Environment Variables Reference

### 1. Backend Environment Variables (`backend/.env` & Render)
```env
PROJECT_NAME=DineBuddy
VERSION=0.1.0
ENVIRONMENT=production
API_V1_PREFIX=/api/v1

# Supabase PostgreSQL Pooler Connection String (%24%24 encodes $$ in password)
DATABASE_URL=postgresql://postgres.iahzjepenwomwvjjtszo:HrXbnu%24%24TmqDV4j@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres

# CORS Origins (Allowing Vercel Frontend & Local Development)
CORS_ORIGINS=https://dinebuddy.vercel.app,http://localhost:5173,http://localhost:3000,*

SECRET_KEY=dev-secret-key-change-in-production-use-strong-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 2. Frontend Environment Variables (`frontend/.env` & Vercel)
```env
VITE_API_BASE_URL=https://dinebuddy.onrender.com/api/v1
```

---

## 🔄 Daily Development & Auto-Deployment Workflow

Both **Vercel** and **Render** are connected to the `main` branch of your GitHub repository.

### How to push changes live:
Whenever you make changes to your local code, push them using standard Git commands:

```bash
# 1. Check changed files
git status

# 2. Stage all changes
git add .

# 3. Commit your updates
git commit -m "feat: added new feature or UI update"

# 4. Push to GitHub main branch
git push origin main
```

### What happens automatically after `git push`:
1. **Vercel (Frontend):** Detects the push, builds the React app, and deploys updates to `https://dinebuddy.vercel.app/` within **~1 minute**.
2. **Render (Backend):** Detects the push, rebuilds the Python Docker container, and updates `https://dinebuddy.onrender.com` within **~2-3 minutes**.

---

## 🗄️ Database Migration Workflow (Supabase + Alembic)

If you modify SQLAlchemy models in `backend/app/models/` or add new database tables:

```bash
# 1. Navigate to backend directory
cd backend

# 2. Generate a new migration script
py -m alembic revision --autogenerate -m "add new column or table"

# 3. Apply the migration directly to Supabase
py -m alembic upgrade head
```

---

## 🛠️ Troubleshooting & Support

* **Cold Starts on Render:** The free tier of Render puts the web service to sleep after 15 minutes of inactivity. The first request after a sleep period might take 30-40 seconds to spin back up.
* **CORS Errors:** Ensure `CORS_ORIGINS` in Render Environment variables includes `https://dinebuddy.vercel.app`.
* **Database Connection Issues:** Always make sure the Supabase connection string uses `%24%24` instead of raw `$$` in the password and uses the Pooler hostname/port (`6543`).
