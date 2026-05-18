# AtomQuest — Goal Setting & Tracking Portal

In-house portal for **ATOMQUEST HACKATHON 1.0**: employees draft weighted goals, managers review and approve sheets, admins run analytics and cycle controls, with quarterly check-ins and BRD-aligned scoring.

**Stack:** React (Vite) · Express · PostgreSQL · Docker

**Live app:** [https://atomquest-portal-9u7c.onrender.com](https://atomquest-portal-9u7c.onrender.com)

---

## Live demo

| Role | Email | Password |
|------|-------|----------|
| Employee | `employee@atomquest.com` | `password123` |
| Manager | `manager@atomquest.com` | `password123` |
| Admin | `admin@atomquest.com` | `password123` |

Also seeded: `alex@atomquest.com` (employee, same password).

---

## Features

| Role | Highlights |
|------|------------|
| **Employee** | Up to 8 goals (100% weight), Min/Max UoM, submit sheet, quarterly check-ins |
| **Manager** | Team review, approve/rework, add goals for reports, shared KPIs |
| **Admin** | Analytics, QoQ charts, escalation rules, integrations, CSV export, unlock sheets |

**Rules:** 8 goals max · each ≥ 10% weight · total = 100% to submit · locked sheets block employee edits.

**Good-to-have (§5):** in-app notifications · Teams webhook · Entra ID demo SSO · rule-based escalations · QoQ analytics.

---

## Quick start (local)

```bash
cp .env.example .env          # set JWT_SECRET for non-demo use
docker compose up -d --build
docker compose exec backend npm run seed
```

| Service | URL |
|---------|-----|
| App (UI) | http://localhost:3000 |
| API health | http://localhost:5000/api/health |
| Postgres | `localhost:5435` |

`docker-compose.yml` uses `${VAR}` from `.env` only — **never commit `.env`**.

**BRD cycles:** `CYCLE_DEMO_MODE=true` in `.env` opens all quarterly windows for testing. Admin → **Cycle schedule** can toggle enforcement and demo mode.

---

## Deploy on Render (production)

Same app as local, one URL for UI + API (no port 3000/5000 split).

| | Local Docker | Render |
|---|--------------|--------|
| URL | http://localhost:3000 | https://atomquest-portal-9u7c.onrender.com |
| Database | Postgres container | Render Postgres (`DATABASE_URL`) |
| Config | `.env` | `render.yaml` + dashboard |

**Push latest code → auto-redeploy:**

```bash
git add .
git commit -m "Render production: good-to-have features + fixes"
git push origin main
```

**First-time or new Blueprint:** [render.com](https://render.com) → **New → Blueprint** → connect repo → Apply.

On deploy the app **auto-migrates the DB** and **seeds demo users** if empty. Set in Render dashboard (optional):

- `APP_URL` = your `*.onrender.com` URL (Blueprint sets from service host)
- `TEAMS_WEBHOOK_URL` = Teams incoming webhook for real cards
- `AZURE_SSO_DEMO=true` = Microsoft sign-in button on login

**Health:** `GET /api/health` on your Render URL.

Details: [docs/DEPLOY.md](docs/DEPLOY.md)

## Local production test (optional)

```bash
docker compose -f docker-compose.prod.yml up --build
# → http://localhost:8080 (UI + API together)
```

---

## Scoring (Min / Max)

| UoM | Direction | Formula |
|-----|-----------|---------|
| Numeric / % | **Min** | `(actual ÷ target) × 100` |
| Numeric / % | **Max** | `(target ÷ actual) × 100` |
| Timeline | — | 100% if actual date ≤ target |
| Zero-based | — | 100% if actual is 0 |

---

## Tests

```bash
cd backend && npm test
cd frontend && npm install && npm test
```

---

## Project layout

```
frontend/          React UI (Vite)
backend/           Express API, migrations, seed
docs/
  architecture.md  System diagram & flows
  DEPLOY.md        Production hosting steps
docker-compose.yml       Dev (UI :3000, API :5000)
docker-compose.prod.yml  Prod (UI+API :8080)
Dockerfile.prod          Render / production image
render.yaml              Render Blueprint
.env.example             Safe template (commit this)
```

---

## Docs

- [Architecture](docs/architecture.md) — components, approval flow, quarterly windows
- [Deploy](docs/DEPLOY.md) — Render, Railway, VPS

---

*ATOMQUEST HACKATHON 1.0 — Goal Setting & Tracking Portal*
