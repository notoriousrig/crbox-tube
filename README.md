# crbox-tube

Self-hosted YouTube interest tracker. Group channels by topic, poll their
RSS feeds, apply title/description filters, and surface recent videos
without the YouTube home-feed algorithm. Single user, behind Cloudflare
Tunnel + Access at `tube.crbox.ca`.

## Stack

- **FastAPI** — Python backend with APScheduler for periodic RSS polling
- **SQLite** — one-file DB, nightly `.backup` to `./data/backups`
- **React + Vite + Tailwind** — sidebar of interests + chronological video grid
- **httpx + lxml** — RSS fetch with ETag/Last-Modified caching
- **Cloudflare Tunnel** — no exposed ports
- **Cloudflare Access** — edge auth, JWT verified by backend

## Features (phase 1, RSS-only)

- Group channels into **interests** (topics)
- Per-interest filters: title/description include/exclude regex, max-age
  window, hide-shorts heuristic
- Periodic poll of `youtube.com/feeds/videos.xml?channel_id=…` with
  ETag/If-Modified-Since for politeness
- Resolve `@handle` / channel URL / video URL → channel ID by scraping
  (no API key required)
- Mark videos **watched** / **hidden** / **saved** — local state only
- One-shot import of Google Takeout `subscriptions.csv`
- Open videos on actual youtube.com so your real YT watch history stays
  accurate
- ⌘K command palette for jumping between interests + recent videos

## What's intentionally NOT here yet

- **YouTube Data API integration.** Phase 1 is RSS-only. Schema is
  pre-cut for the Data API (`oauth_token` table, `duration_seconds`
  nullable on `video`, `synced_to_yt_playlist_at` on `video_state`) so
  phase 2 is a feature flip:
  - Real shorts filtering (`videos.list` contentDetails.duration)
  - Keyword/topic discovery (`search.list`)
  - Push watched marks to a "crbox-watched" YT playlist over OAuth
- Multi-user. The Cloudflare Access app is restricted to one email.

## Local dev

```bash
cp .env.example .env  # leave CF_ACCESS_AUD blank to bypass auth locally
docker compose up --build
```

For frontend HMR: `cd frontend && npm install && npm run dev` — Vite
proxies `/api` to `http://localhost:8000`.

## Production deployment

See `CLOUDFLARE_SETUP.md` for the one-time tunnel + Access wiring.

The stack is deployed on NAS3 (192.168.2.30) as a Portainer git-stack
pulling from `notoriousrig/crbox-tube`.

## Data layout

```
data/
├── tube.db          # SQLite — primary DB
└── backups/         # nightly sqlite3 .backup snapshots
```

## Importing Takeout subscriptions

1. Visit https://takeout.google.com → uncheck everything except "YouTube
   and YouTube Music" → in YouTube options pick **subscriptions** only →
   download.
2. Extract the zip; find `subscriptions.csv`
   (under `Takeout/YouTube and YouTube Music/subscriptions/`).
3. In crbox-tube → "Import" → upload the CSV. All channels go into an
   "Unsorted" interest; re-bucket them in the UI.

## API docs

Once running, OpenAPI docs are at `https://tube.crbox.ca/api/docs`
(behind Cloudflare Access auth) or `http://localhost:8000/api/docs` in
local dev.
