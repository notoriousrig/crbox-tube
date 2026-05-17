"""Video listing (per-interest, filtered) and state marks."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import RequireUser
from app.database import get_db
from app.models import Channel, Interest, Video, VideoState, interest_channel
from app.schemas import VideoOut, VideoStateUpdate
from app.services.filter_engine import compile_filters, passes


router = APIRouter(prefix="/api/videos", tags=["videos"], dependencies=[RequireUser])


def _serialize(v: Video, channel_title: str) -> dict:
    st = v.state
    return {
        "video_id": v.video_id,
        "channel_id": v.channel_id,
        "channel_title": channel_title,
        "title": v.title,
        "description": v.description,
        "published_at": v.published_at,
        "thumbnail_url": v.thumbnail_url,
        "duration_seconds": v.duration_seconds,
        "view_count": v.view_count,
        "watched_at": st.watched_at if st else None,
        "hidden_at": st.hidden_at if st else None,
        "saved_at": st.saved_at if st else None,
    }


@router.get("", response_model=list[VideoOut])
def list_videos(
    interest_id: int | None = Query(default=None),
    state: Literal["unwatched", "watched", "saved", "hidden", "all"] = "unwatched",
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """List videos, optionally scoped to an interest, with filters applied.

    State filter is applied AFTER per-interest filters so hidden videos
    can still be revealed via state=hidden.
    """
    q = (
        select(Video, Channel.title)
        .join(Channel, Channel.channel_id == Video.channel_id)
        .options(selectinload(Video.state))
    )

    interest: Interest | None = None
    if interest_id is not None:
        interest = db.get(Interest, interest_id)
        if interest is None:
            raise HTTPException(404, "Interest not found")
        q = q.join(
            interest_channel, interest_channel.c.channel_id == Video.channel_id,
        ).where(interest_channel.c.interest_id == interest_id)

    q = q.order_by(Video.published_at.desc()).limit(limit * 3)  # over-fetch for filtering

    rows = db.execute(q).all()
    out: list[dict] = []

    compiled = compile_filters(interest.filters) if interest else []

    for video, channel_title in rows:
        st = video.state
        # State filter
        if state == "unwatched":
            if st and (st.watched_at or st.hidden_at):
                continue
        elif state == "watched":
            if not (st and st.watched_at):
                continue
        elif state == "saved":
            if not (st and st.saved_at):
                continue
        elif state == "hidden":
            if not (st and st.hidden_at):
                continue
        # state == "all" passes through

        if compiled and not passes(video, compiled):
            continue

        out.append(_serialize(video, channel_title))
        if len(out) >= limit:
            break

    return out


@router.get("/{video_id}", response_model=VideoOut)
def get_video(video_id: str, db: Session = Depends(get_db)):
    v = db.get(Video, video_id, options=[selectinload(Video.state)])
    if v is None:
        raise HTTPException(404, "Video not found")
    return _serialize(v, v.channel.title if v.channel else "")


@router.post("/{video_id}/state", response_model=VideoOut)
def set_state(video_id: str, payload: VideoStateUpdate, db: Session = Depends(get_db)):
    v = db.get(Video, video_id, options=[selectinload(Video.state)])
    if v is None:
        raise HTTPException(404, "Video not found")
    st = v.state
    if st is None:
        st = VideoState(video_id=video_id)
        db.add(st)
        db.flush()
        v.state = st
    now = datetime.utcnow()
    if payload.watched is not None:
        st.watched_at = now if payload.watched else None
    if payload.hidden is not None:
        st.hidden_at = now if payload.hidden else None
    if payload.saved is not None:
        st.saved_at = now if payload.saved else None
    db.commit()
    db.refresh(v)
    return _serialize(v, v.channel.title if v.channel else "")


@router.post("/{video_id}/click", response_model=VideoOut)
def record_click(video_id: str, db: Session = Depends(get_db)):
    """Click-through: mark watched. UI also opens the YT page in a new tab,
    where YouTube records the real history entry."""
    return set_state(video_id, VideoStateUpdate(watched=True), db)
