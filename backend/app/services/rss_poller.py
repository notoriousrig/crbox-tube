"""Poll YouTube channel RSS feeds, upsert videos.

Feed URL: https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>
Returns the channel's ~15 most recent uploads as an Atom feed.

We use ETag/If-Modified-Since for politeness. Concurrency is bounded so
we don't slam YouTube; default is 8 simultaneous requests.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Channel, Video


log = logging.getLogger(__name__)


_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={cid}"
_USER_AGENT = "crbox-tube/0.1 (+https://tube.crbox.ca)"


class PollResult:
    __slots__ = (
        "channels_polled", "channels_failed",
        "videos_new", "videos_updated", "duration_seconds",
    )

    def __init__(self) -> None:
        self.channels_polled = 0
        self.channels_failed = 0
        self.videos_new = 0
        self.videos_updated = 0
        self.duration_seconds = 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "channels_polled": self.channels_polled,
            "channels_failed": self.channels_failed,
            "videos_new": self.videos_new,
            "videos_updated": self.videos_updated,
            "duration_seconds": round(self.duration_seconds, 2),
        }


def _fetch_one(
    client: httpx.Client, channel_id: str, etag: str, last_modified: str,
) -> tuple[int, bytes | None, str, str, str]:
    """Return (status, body_or_none, new_etag, new_last_modified, error)."""
    headers: dict[str, str] = {}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    try:
        resp = client.get(_FEED_URL.format(cid=channel_id), headers=headers)
    except httpx.HTTPError as exc:
        return 0, None, etag, last_modified, str(exc)[:500]

    new_etag = resp.headers.get("ETag", etag)
    new_lm = resp.headers.get("Last-Modified", last_modified)

    if resp.status_code == 304:
        return 304, None, new_etag, new_lm, ""
    if resp.status_code >= 400:
        return resp.status_code, None, new_etag, new_lm, f"HTTP {resp.status_code}"
    return resp.status_code, resp.content, new_etag, new_lm, ""


def _parse_published(entry: Any) -> datetime | None:
    """feedparser gives us a struct_time in UTC for atom 'published'."""
    parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if not parsed:
        return None
    return datetime.fromtimestamp(time.mktime(parsed), tz=timezone.utc).replace(tzinfo=None)


def _extract_video(entry: Any) -> dict[str, Any] | None:
    # Atom <id> is "yt:video:<VIDEO_ID>" for YouTube feeds.
    raw_id = getattr(entry, "id", "") or ""
    if not raw_id.startswith("yt:video:"):
        return None
    video_id = raw_id.split(":", 2)[2]
    if not video_id:
        return None
    published_at = _parse_published(entry)
    if not published_at:
        return None
    title = getattr(entry, "title", "") or ""

    description = ""
    media_group = entry.get("media_group") if isinstance(entry, dict) else getattr(entry, "media_group", None)
    if isinstance(media_group, dict):
        description = (media_group.get("media_description") or {}).get("content", "") or ""
    if not description:
        # feedparser sometimes surfaces it as media_description directly
        media_desc = entry.get("media_description") if isinstance(entry, dict) else None
        if isinstance(media_desc, str):
            description = media_desc

    thumb_url = ""
    thumbnails = entry.get("media_thumbnail") if isinstance(entry, dict) else None
    if isinstance(thumbnails, list) and thumbnails:
        thumb_url = thumbnails[0].get("url", "") or ""
    if not thumb_url:
        # Deterministic fallback — hqdefault always exists for a real video
        thumb_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    view_count: int | None = None
    stats = entry.get("media_statistics") if isinstance(entry, dict) else None
    if isinstance(stats, dict):
        try:
            view_count = int(stats.get("views", "0") or 0) or None
        except (TypeError, ValueError):
            view_count = None

    return {
        "video_id": video_id,
        "title": title[:500],
        "description": description,
        "published_at": published_at,
        "thumbnail_url": thumb_url,
        "view_count": view_count,
    }


def _upsert_videos(
    db: Session, channel_id: str, parsed_feed: Any
) -> tuple[int, int, str, str]:
    """Returns (new_count, updated_count, channel_title, channel_thumbnail)."""
    new_count = 0
    updated_count = 0
    channel_title = ""
    channel_thumb = ""

    feed_meta = getattr(parsed_feed, "feed", None)
    if feed_meta is not None:
        channel_title = (getattr(feed_meta, "title", "") or "")[:200]
        # Atom <author><name> is the channel name; sometimes title has " - YouTube"
        channel_title = channel_title.replace(" - YouTube", "")
        author = getattr(feed_meta, "author", None)
        if isinstance(author, str) and not channel_title:
            channel_title = author[:200]

    for entry in parsed_feed.entries or []:
        v = _extract_video(entry)
        if not v:
            continue
        existing = db.get(Video, v["video_id"])
        if existing is None:
            db.add(Video(
                video_id=v["video_id"],
                channel_id=channel_id,
                title=v["title"],
                description=v["description"],
                published_at=v["published_at"],
                thumbnail_url=v["thumbnail_url"],
                view_count=v["view_count"],
            ))
            new_count += 1
        else:
            # Refresh title/description/thumbnail (creators sometimes edit
            # these post-publish). Don't touch published_at.
            changed = False
            if existing.title != v["title"]:
                existing.title = v["title"]
                changed = True
            if existing.description != v["description"]:
                existing.description = v["description"]
                changed = True
            if v["view_count"] is not None and existing.view_count != v["view_count"]:
                existing.view_count = v["view_count"]
                changed = True
            if changed:
                updated_count += 1
    return new_count, updated_count, channel_title, channel_thumb


def poll_channel(channel_id: str) -> dict[str, Any]:
    """Poll a single channel and update the DB. Returns counts."""
    db = SessionLocal()
    try:
        ch = db.get(Channel, channel_id)
        if ch is None:
            return {"error": "Channel not found"}
        with httpx.Client(
            timeout=20.0,
            headers={"User-Agent": _USER_AGENT, "Accept": "application/atom+xml,*/*"},
        ) as client:
            status, body, new_etag, new_lm, err = _fetch_one(
                client, channel_id, ch.etag, ch.last_modified,
            )
        ch.last_fetched_at = datetime.utcnow()
        ch.last_status = status
        ch.last_error = err
        ch.etag = new_etag or ""
        ch.last_modified = new_lm or ""

        if status == 304 or body is None:
            db.commit()
            return {"status": status, "new": 0, "updated": 0}

        parsed = feedparser.parse(body)
        new_count, upd_count, title, _thumb = _upsert_videos(db, channel_id, parsed)
        if title and not ch.title:
            ch.title = title
        db.commit()
        return {"status": status, "new": new_count, "updated": upd_count}
    finally:
        db.close()


def poll_all(channel_ids: list[str] | None = None) -> PollResult:
    """Poll many channels in parallel. If `channel_ids` is None, poll all."""
    started = time.monotonic()
    result = PollResult()

    db = SessionLocal()
    try:
        if channel_ids is None:
            ids = [c.channel_id for c in db.execute(select(Channel)).scalars()]
        else:
            ids = list(channel_ids)
    finally:
        db.close()

    if not ids:
        result.duration_seconds = time.monotonic() - started
        return result

    workers = max(1, min(settings.poll_concurrency, len(ids)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(poll_channel, cid): cid for cid in ids}
        for f in as_completed(futures):
            cid = futures[f]
            try:
                outcome = f.result()
            except Exception:
                log.exception("Poll crashed for %s", cid)
                result.channels_failed += 1
                continue
            if outcome.get("error"):
                result.channels_failed += 1
                continue
            status = outcome.get("status", 0)
            if status == 0 or status >= 400:
                result.channels_failed += 1
                continue
            result.channels_polled += 1
            result.videos_new += outcome.get("new", 0)
            result.videos_updated += outcome.get("updated", 0)

    result.duration_seconds = time.monotonic() - started
    log.info(
        "Poll done — %d ok, %d failed, %d new, %d updated, %.1fs",
        result.channels_polled, result.channels_failed,
        result.videos_new, result.videos_updated, result.duration_seconds,
    )
    return result


def prune_old_videos() -> int:
    """Drop video rows older than VIDEO_RETENTION_DAYS, preserving any with
    a video_state row (watched/saved/hidden). Returns count pruned."""
    if settings.video_retention_days <= 0:
        return 0
    cutoff = datetime.utcnow().timestamp() - settings.video_retention_days * 86400
    cutoff_dt = datetime.fromtimestamp(cutoff)
    db = SessionLocal()
    try:
        from app.models import VideoState
        # SQL: delete videos where published < cutoff AND no state row exists.
        # Done in two passes since SQLite has no nice DELETE..LEFT JOIN.
        stmt = (
            select(Video.video_id)
            .where(Video.published_at < cutoff_dt)
            .outerjoin(VideoState, VideoState.video_id == Video.video_id)
            .where(VideoState.video_id.is_(None))
        )
        ids = [row[0] for row in db.execute(stmt).all()]
        if not ids:
            return 0
        for vid in ids:
            db.delete(db.get(Video, vid))
        db.commit()
        return len(ids)
    finally:
        db.close()
