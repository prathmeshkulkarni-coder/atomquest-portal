# Deploy AtomQuest Goal Portal (go live)

The production build serves **React + API from one URL** (`Dockerfile.prod` → Express serves `/api` and static UI).

## Before you deploy

1. Copy env file: `cp .env.example .env`
2. Set a strong **`JWT_SECRET`** (long random string).
3. **Never commit `.env`** — it stays local / in the hosting dashboard only.

---

## Option A — VPS / any server (Docker, recommended)

Works on DigitalOcean, AWS EC2, Oracle Cloud free VM, etc.

```bash
# On the server (with Docker installed)
git clone <your-repo-url> atomquest && cd atomquest
cp .env.example .env
nano .env   # set JWT_SECRET, POSTGRES_PASSWORD, DB_PASSWORD

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app node db/seed.js
```

Open: **http://YOUR_SERVER_IP:8080** (or set `APP_PORT=80` in `.env`).

Optional: put **Caddy** or **Nginx** in front with HTTPS and your domain.

---

## Option B — Render.com (free tier, no server admin)

1. Push code to **GitHub** (include `Dockerfile.prod`, `render.yaml`).
2. [render.com](https://render.com) → **New** → **Blueprint** → connect repo.
3. Render creates **Postgres** + **Web Service** from `render.yaml`.
4. Wait until the web service is **Live**. On first start the app **creates tables and demo users automatically** (no Shell tab needed on free tier).

5. Open the URL Render gives you (e.g. `https://atomquest-portal.onrender.com`).

**Optional (local reset):** `node db/seed.js` wipes the DB and reloads demo data — use only for a full reset, not on every deploy.

**Note:** Free tier sleeps after inactivity; first load may take ~30s.

Set `CORS_ORIGIN` in Render dashboard to your public URL if you split frontend/API later (not needed for single-container deploy).

---

## Option C — Railway

1. [railway.app](https://railway.app) → New project → Deploy from GitHub.
2. Add **PostgreSQL** plugin → copy `DATABASE_URL` into app variables.
3. Set service **Dockerfile path** to `Dockerfile.prod` (root).
4. Variables: `NODE_ENV=production`, `JWT_SECRET=...`, `DATABASE_SSL=true`.
5. After deploy, run seed once in Railway shell: `node db/seed.js`.

---

## After deploy (all options)

On first start the app **creates tables and demo users** when the database is empty.

| Step | Command / action |
|------|------------------|
| Demo users | Automatic on first deploy; or `node db/seed.js` for a **full wipe + reseed** (VPS/Docker only) |
| Health check | `GET /api/health` |
| Login | `employee@atomquest.com` / `manager@atomquest.com` / `admin@atomquest.com` — password `password123` |

---

## Local production test

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up --build
# another terminal:
docker compose -f docker-compose.prod.yml exec app node db/seed.js
```

Visit http://localhost:8080

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `JWT_SECRET` / password errors on compose | Fill required vars in `.env` |
| Blank page | Check `docker compose logs app`; ensure seed ran |
| DB connection failed on Render | `DATABASE_SSL=true` and linked Postgres |
| 502 on Render free | Wait for cold start; check logs |
