"""FastAPI entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import CurrentUser, RequireUser
from app.config import settings
from app.routers import channels, filters, imports_, interests, settings_, videos
from app.scheduler import shutdown_scheduler, start_scheduler


logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.data_dir, "backups").mkdir(parents=True, exist_ok=True)
    log.info("Starting up — data dir %s", settings.data_dir)
    start_scheduler()
    yield
    log.info("Shutting down")
    shutdown_scheduler()


app = FastAPI(
    title="crbox-tube",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Local dev: vite on :5173 makes XHR to :8000 — allow that.
if not settings.cf_access_aud:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:5174"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(interests.router)
app.include_router(channels.router)
app.include_router(filters.router)
app.include_router(videos.router)
app.include_router(imports_.router)
app.include_router(settings_.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/me")
def me(user: CurrentUser = RequireUser):
    return {"email": user.email}
