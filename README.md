# AtomQuest Goal Setting & Tracking Portal

Full-stack goal management portal for **ATOMQUEST HACKATHON 1.0**: React (Vite) frontend, Express API, PostgreSQL, Docker Compose.

## Quick start

```bash
cp .env.example .env   # edit JWT_SECRET for anything beyond local demo
docker compose up -d --build
docker compose exec backend npm run seed
```

Secrets are read from **`.env`** (gitignored). `docker-compose.yml` only references `${VAR}` placeholders — safe to commit.

| Service | URL |
| :--- | :--- |
| Frontend | http://localhost:3000 |
| API | http://localhost:5000/api/health |
| Postgres | localhost:5435 |

**Demo logins** (password `password123`): `employee@atomquest.com`, `manager@atomquest.com`, `admin@atomquest.com`

After schema changes, re-run `docker compose exec backend npm run seed`.

## BRD §2.3 — Quarterly windows

| Phase | Period | Employee / manager actions |
| :--- | :--- | :--- |
| Goal setting & approval | 1 May – 30 Jun | Draft goals, submit sheet, L1 review |
| Q1 check-in | July | Planned vs actual for Q1 |
| Q2 check-in | October | Q2 check-ins |
| Q3 check-in | January | Q3 check-ins |
| Q4 / Annual | March – April | Q4 and Annual check-ins |

- **Cycle banner** (all roles): shows the active BRD window.
- **Admin → Cycle schedule**: toggle *Enforce BRD windows* and *Demo mode* (open all windows for testing).
- **Docker**: set `CYCLE_DEMO_MODE=true` in `.env` for demo (all windows open); set `false` and disable demo mode in Admin for strict calendar behavior.

See [docs/architecture.md](docs/architecture.md) for a system diagram.

## Units of measure (Min / Max)

When creating goals (employee or admin shared KPI), pick an explicit direction:

| Selection | Scoring |
| :--- | :--- |
| Numeric / % — **Min** | Higher actual is better: `(actual ÷ target) × 100` |
| Numeric / % — **Max** | Lower actual is better: `(target ÷ actual) × 100` |
| Timeline | 100% if actual date ≤ target date |
| Zero-based | 100% if actual is 0 |

Non-numeric actuals (e.g. `"Ok"`) produce **0%** score. Status labels do not affect the score.

## Core rules

- Max **8** goals; each ≥ **10%** weight; total must equal **100%** before submit.
- Locked sheets block employee edits; managers may adjust targets/weightages during review.
- Shared KPIs: title/target read-only for recipients; primary owner syncs actuals to clones.
- Admin: CSV export, unlock sheets, push shared KPIs, cycle settings.

## Tests

```bash
# Backend (Node built-in test runner)
cd backend && npm test

# Frontend (Vitest + Testing Library)
cd frontend && npm install && npm test
```

## Go live (production)

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for VPS Docker, Render, and Railway.

Quick production test locally:

```bash
docker compose -f docker-compose.prod.yml up --build
docker compose -f docker-compose.prod.yml exec app node db/seed.js
# → http://localhost:8080
```

## Deliverables checklist

| Item | Location |
| :--- | :--- |
| Source code | `frontend/`, `backend/` |
| Architecture diagram | `docs/architecture.md` |
| Environment template | `.env.example` |
| Docker deployment | `docker-compose.yml` |
| Automated tests | `backend/tests/`, `frontend/src/**/*.test.*` |

## Local development (without Docker)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (proxies /api to backend)
cd frontend && npm install && npm run dev
```

Set `DATABASE_URL` and `JWT_SECRET` per `.env.example`.
