# AtomQuest Portal — Architecture

## System overview

```mermaid
flowchart TB
  subgraph client [Browser]
    UI[React SPA - Vite]
  end
  subgraph api [Backend]
    Express[Express API]
    Auth[JWT middleware]
    Goals[goalController]
    Checkins[checkinController]
    Cycles[cycleController]
    Analytics[analyticsController]
  end
  subgraph data [Data]
    PG[(PostgreSQL)]
  end
  UI -->|REST /api| Express
  Express --> Auth
  Auth --> Goals
  Auth --> Checkins
  Auth --> Cycles
  Auth --> Analytics
  Goals --> PG
  Checkins --> PG
  Cycles --> PG
  Analytics --> PG
```

## BRD §2.3 — Cycle enforcement

| Window | Calendar period | Allowed actions |
| :--- | :--- | :--- |
| Goal Setting & Approval | 1 May – 30 Jun | Create/edit/delete goals, submit sheet, manager review, shared KPI push |
| Q1 check-in | July | Log actuals & status for Q1 |
| Q2 check-in | October | Q2 check-ins |
| Q3 check-in | January | Q3 check-ins |
| Q4 / Annual | March – April | Q4 and Annual check-ins |

Enforcement is controlled by `cycle_settings` (Admin UI) and `CYCLE_DEMO_MODE` (Docker env). When bypass is active, all windows behave as open for demos.

## Scoring (explicit UoM direction)

Goals store `uom` and `uom_direction` (`Min` | `Max`, null for Timeline / Zero-based). The score calculator uses direction instead of inferring from goal title keywords.

## Repository layout

| Path | Role |
| :--- | :--- |
| `frontend/` | React UI, Vitest component tests |
| `backend/` | Express API, Node test runner |
| `docker-compose.yml` | Postgres + API + UI |
| `docs/architecture.md` | This document |
