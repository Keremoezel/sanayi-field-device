# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run in production
npm start

# Run in development (auto-restart on file change)
npm run dev
```

No build step, no linter, no test suite. The app runs directly with Node.js — what you edit is what runs.

## Environment Setup

Copy `.env.example` to `.env` and fill in the values. Required for full functionality:

```env
PORT=8787
HOST=127.0.0.1
GITHUB_REPO=Keremoezel/sanayi-field-device
GITHUB_BRANCH=master
FIELD_DEVICE_KEY=<strong-secret>

# Scanner (required for /api/scanner/analyze to work)
SANAYI_API_URL=https://sanayi-uygulamasi.vercel.app
SANAYI_API_KEY=<api-key>

# Vercel integration
VERCEL_TOKEN=<token>

# Tuning (optional, have defaults)
MAX_UPLOAD_SIZE_MB=2
SCAN_RATE_LIMIT_PER_MIN=10
NODE_ENV=production
```

## Architecture

This is a **vanilla Node.js + Express backend** serving a **vanilla JS single-page app** as static files. No framework, no build tool, no TypeScript.

### Backend (`server/`)

`server/index.js` registers 8 route modules and starts the auto-updater worker:

| Route prefix | File | Purpose |
|---|---|---|
| `/api/projects` | `routes/projects.js` | CRUD for tracked projects (`data/projects.json`) |
| `/api/monitor` | `routes/monitor.js` | Health-check all tracked projects via `checker.js` |
| `/api/vercel` | `routes/vercel.js` | List deployments, trigger deploys (requires `VERCEL_TOKEN`) |
| `/api/events` | `routes/events.js` | SSE stream — real-time health events |
| `/api/tools` | `routes/tools.js` | Ping, env info, server status, restart, log export |
| `/api/history` | `routes/history.js` | Scan history read (delegates to `scan-store.js`) |
| `/api/health` | `routes/health.js` | Device heartbeat — reads version from `package.json` |
| `/api/scanner` | `routes/scanner.js` | Image upload proxy → Sanayi AI backend |

**Services** (`server/services/`):
- `checker.js` — HTTP health check helper used by monitor
- `logger.js` — Append-only JSON log, max 200 entries, persisted to `data/logs.json`
- `notifier.js` — Fires alerts on project up/down transitions
- `scan-store.js` — Scan CRUD, persisted to `data/scans.json`, max 500 entries

**Data files** (`server/data/`): `projects.json`, `logs.json`, `scans.json` — all plain JSON, no database. These are runtime state; `projects.json` is the source of truth for which projects are monitored.

**Workers** (`server/workers/`): `updater.js` — polls GitHub for new commits and auto-pulls on the device.

### Scanner flow

`POST /api/scanner/analyze` (multipart `image` field):
1. In-memory rate limit check (per IP, resets every 60s)
2. Multer validates file type (image/*) and size (default 2MB)
3. Re-posts as multipart to `SANAYI_API_URL/api/damage-analyses`
4. Saves result to local `scan-store`
5. Returns upstream JSON plus `localId`

The scanner uses Node's native `fetch` and `FormData` (Node 18+). It does **not** write images to disk.

### Frontend (`public/`)

`index.html` is a single ~890-line file containing all UI logic as vanilla JS. Five tabs: Scanner, Monitor, History, Logs, Tools. CSS lives in `style.css` (separated from HTML in the v1.0.0 rewrite).

`sw.js` — Service Worker: cache-first for static assets, network-first (stale-while-revalidate) for HTML, passes through `/api/*` requests uncached.

### Ongoing rewrite plan

`rewplan.md` documents the full v2.0 upgrade list in Turkish. Key items still pending:
- Scanner tab: live camera UI (currently placeholder)
- Logs tab: project-filtered + type-filtered view with detail modal
- Monitor tab: richer health data, countdown bar, service detail modals
- Tools tab: expanded developer toolkit
- PWA offline mode improvements

When working on UI, follow the existing dark glassmorphic design system defined in `style.css` CSS variables (`--c-bg`, `--c-surface`, `--c-card`, `--glass-*`, `--grad-*`).
