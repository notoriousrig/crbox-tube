# CLAUDE.md — crbox-tube

YouTube interest tracker at `tube.crbox.ca`. Mirrors the crbox-links
pattern: FastAPI backend + React/Vite frontend behind nginx, single
Docker Compose stack, deployed via Portainer git-stack on NAS3.

## Local dev

```bash
cp .env.example .env
docker compose up --build
```

For frontend HMR: `cd frontend && npm install && npm run dev` — proxies
`/api` to `http://localhost:8000`. The backend binds the SQLite DB at
`./data/tube.db` via the volume mount.

## Architecture

- **Backend**: FastAPI on port 8000, SQLAlchemy 2.x ORM, Alembic
  migrations applied on container startup. APScheduler runs the periodic
  RSS poll (default every 2h) and the nightly SQLite `.backup` job. Auth
  is Cloudflare Access JWT, verified per request via the
  `Cf-Access-Jwt-Assertion` header.
- **Frontend**: nginx on port 80, serves the built React bundle and
  proxies `/api/*` to the backend. The proxy MUST forward the
  `Cf-Access-Jwt-Assertion` header — set in `frontend/nginx.conf`.
- **DB**: SQLite at `/data/tube.db`. Backups land in `/data/backups/`,
  retained for `BACKUP_KEEP_DAYS` (default 30) days.

## Domain model

- `interest` — a topic bucket (e.g. "Rust", "Woodworking")
- `channel` — a YouTube channel by `channel_id` (UC...)
- `interest_channel` — many-to-many; a channel can live in multiple
  interests
- `filter` — owned by interest; `kind` in
  `{title_include, title_exclude, desc_include, desc_exclude,
   max_age_days, hide_shorts}`. Applied at read time.
- `video` — cached row per video_id with the RSS-derived metadata.
  `duration_seconds` is nullable (RSS doesn't expose it; phase 2 fills
  it via the Data API).
- `video_state` — per-video local marks: `watched_at`, `hidden_at`,
  `saved_at`. `synced_to_yt_playlist_at` is pre-cut for phase-2 OAuth
  push.
- `oauth_token` — empty in phase 1; pre-cut for phase-2 YouTube OAuth.

## Phase 1 rules (RSS-only)

- **No YouTube Data API calls.** Channel resolution scrapes the YouTube
  page for `"channelId":"UC..."`. Polling hits the public RSS feed,
  which gives ~15 most recent uploads per channel.
- **Shorts heuristic** — RSS doesn't give duration, so "hide shorts"
  applies a title/description heuristic (look for `#shorts`, `#short`,
  shortform indicators). Real duration filtering ships in phase 2.
- **Watched state is local** — click-through opens youtube.com in a new
  tab; YouTube records the view in your real history natively. The app
  never tries to mark watched on YouTube.

## Adding a new feature

1. **Backend**: add the route under `backend/app/routers/`, register it
   in `app/main.py`. Add model/schema changes via Alembic
   (`alembic revision --autogenerate -m "..."`). Test with
   `curl http://localhost:8000/api/...` (skip the JWT header in local
   dev if `CF_ACCESS_AUD` is empty — auth is bypassed).
2. **Frontend**: add the component under `src/components/`, hook into
   the sidebar or grid. API calls go through `src/api.ts`. State is
   TanStack Query with a single root key per resource.

## Deployment

Portainer git-stack on NAS3 endpoint 3, pulling from
`notoriousrig/crbox-tube` on the `main` branch. Updates pushed to
GitHub; Portainer redeploys on webhook or manual "Pull and redeploy".

Cloudflare Tunnel ingress for `tube.crbox.ca` points at the shared
traefik on NAS3 (`http://traefik:8443`), and traefik dispatches by Host
header to this stack's `frontend` service.
