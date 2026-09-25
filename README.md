# Pathly

Pathly is a Student Career & Opportunity Journey Platform.

Instead of simply showing students a large list of internships, jobs, hackathons, and scholarships, Pathly will understand a student's current profile and evidence, help them discover suitable opportunities, explain why an opportunity matches them, identify skill gaps, and help them improve toward future opportunities.

Core journey:

```
Student Profile
  -> Student Capability Profile
  -> Opportunity Matching
  -> Explain Why It Matches
  -> Identify Skill Gaps
  -> Improvement
  -> Re-match with opportunities
  -> Application Tracking
```

> Note: This is the initial project setup only. Features listed above will be built step by step.

## Technology Stack

- **Frontend:** React.js + Vite (JavaScript, plain CSS for now)
- **Backend:** Node.js + Express.js (ES modules)
- **Database:** PostgreSQL with Prisma ORM
- **Development:** Git, GitHub, Postman (API testing), dotenv

## Project Structure

```
Pathly/
├── frontend/    # React + Vite app
├── backend/     # Express API + Prisma
│   └── prisma/  # Prisma schema
├── README.md
└── .gitignore
```

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL 18 installed and running locally on **port 5432**
- A database named **pathly** created in PostgreSQL

## Setup

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a second terminal)
cd frontend
npm install
```

### 2. Configure environment variables

Copy `backend/.env.example` to `backend/.env` and fill in your real PostgreSQL credentials:

```bash
cd backend
copy .env.example .env
```

Then edit `backend/.env` and replace `YOUR_PASSWORD` with your actual PostgreSQL password:

```
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/pathly?schema=public"
```

### 3. Validate the Prisma setup

```bash
cd backend
npx prisma validate
npx prisma generate
```

- `prisma validate` checks the schema and confirms `DATABASE_URL` is present (it does not connect to the database).
- `prisma generate` creates the Prisma Client.

(The database schema itself will be created in a later step; for now Prisma is only configured — no models, no migrations.)

## Running the Project

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

### Quick checks

- Backend health endpoint: open [http://localhost:5000/api/health](http://localhost:5000/api/health) or call it in Postman.
  Expected response: `{ "status": "ok", "message": "Pathly server is running", "timestamp": "..." }`
- Frontend: open [http://localhost:5173](http://localhost:5173) — you should see the Pathly landing page.

## Environment Variables

| Variable       | Location       | Description                                        |
| -------------- | -------------- | -------------------------------------------------- |
| `PORT`         | `backend/.env` | Port the Express server listens on (default 5000)  |
| `DATABASE_URL` | `backend/.env` | PostgreSQL connection string used by Prisma        |

**Important:** Never commit `backend/.env` to GitHub. It is already listed in `.gitignore`.

## Current Project Status

- [x] Backend: Express server with a `GET /api/health` endpoint
- [x] Database: PostgreSQL connection configured via Prisma (`DATABASE_URL` in `backend/.env`)
- [x] Prisma datasource configured for PostgreSQL on port 5432, database `pathly`
- [ ] Database models and migrations (schema not designed yet — Prisma is configured but no tables exist)
- [x] Frontend: React + Vite app with a simple Pathly landing page
- [ ] Student profile & capability profile
- [ ] Opportunity data & matching logic
- [ ] Match explanations & skill gap analysis
- [ ] Improvement plans
- [ ] Application tracking
- [ ] Authentication
