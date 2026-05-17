"""Channel CRUD + add-by-paste + attach/detach to interests + manual refresh."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Channel, Interest
from app.schemas import (
    ChannelAddRequest,
    ChannelAttachRequest,
    ChannelOut,
    RefreshResult,
)
from app.services.channel_resolver import ChannelResolveError, resolve
from app.services import rss_poller


router = APIRouter(prefix="/api/channels", tags=["channels"], dependencies=[RequireUser])


def _serialize(c: Channel) -> dict:
    return {
        "channel_id": c.channel_id,
        "title": c.title,
        "handle": c.handle,
        "thumbnail_url": c.thumbnail_url,
        "description": c.description,
        "last_fetched_at": c.last_fetched_at,
        "last_status": c.last_status,
        "last_error": c.last_error,
    }


@router.get("", response_model=list[ChannelOut])
def list_channels(db: Session = Depends(get_db)):
    rows = db.query(Channel).order_by(Channel.title).all()
    return [_serialize(c) for c in rows]


@router.post("", response_model=ChannelOut, status_code=201)
def add_channel(payload: ChannelAddRequest, db: Session = Depends(get_db)):
    """Resolve a pasted URL/handle/ID to a channel and (optionally) attach
    it to an interest. Idempotent: if the channel already exists, returns
    it and just adds the interest link."""
    try:
        resolved = resolve(payload.input)
    except ChannelResolveError as exc:
        raise HTTPException(400, str(exc)) from exc

    ch = db.get(Channel, resolved.channel_id)
    if ch is None:
        ch = Channel(
            channel_id=resolved.channel_id,
            title=resolved.title,
            handle=resolved.handle,
            thumbnail_url=resolved.thumbnail_url,
            description=resolved.description,
        )
        db.add(ch)
        db.flush()
    else:
        # Backfill metadata we didn't have before
        if not ch.title and resolved.title:
            ch.title = resolved.title
        if not ch.handle and resolved.handle:
            ch.handle = resolved.handle
        if not ch.thumbnail_url and resolved.thumbnail_url:
            ch.thumbnail_url = resolved.thumbnail_url

    if payload.interest_id is not None:
        interest = db.get(Interest, payload.interest_id)
        if interest is None:
            raise HTTPException(400, "Interest not found")
        if interest not in ch.interests:
            ch.interests.append(interest)

    db.commit()
    db.refresh(ch)

    # Kick off an immediate poll so the user sees videos right away
    try:
        rss_poller.poll_channel(ch.channel_id)
        db.refresh(ch)
    except Exception:
        # Non-fatal — scheduler will catch it next cycle
        pass

    return _serialize(ch)


@router.post("/attach", status_code=204)
def attach(payload: ChannelAttachRequest, db: Session = Depends(get_db)):
    ch = db.get(Channel, payload.channel_id)
    if ch is None:
        raise HTTPException(404, "Channel not found")
    interest = db.get(Interest, payload.interest_id)
    if interest is None:
        raise HTTPException(404, "Interest not found")
    if interest not in ch.interests:
        ch.interests.append(interest)
        db.commit()


@router.post("/detach", status_code=204)
def detach(payload: ChannelAttachRequest, db: Session = Depends(get_db)):
    ch = db.get(Channel, payload.channel_id)
    if ch is None:
        raise HTTPException(404, "Channel not found")
    interest = db.get(Interest, payload.interest_id)
    if interest is None:
        raise HTTPException(404, "Interest not found")
    if interest in ch.interests:
        ch.interests.remove(interest)
        db.commit()


@router.delete("/{channel_id}", status_code=204)
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.get(Channel, channel_id)
    if ch is None:
        raise HTTPException(404, "Channel not found")
    db.delete(ch)
    db.commit()


@router.post("/{channel_id}/refresh", response_model=ChannelOut)
def refresh_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.get(Channel, channel_id)
    if ch is None:
        raise HTTPException(404, "Channel not found")
    rss_poller.poll_channel(channel_id)
    db.refresh(ch)
    return _serialize(ch)


@router.post("/refresh", response_model=RefreshResult)
def refresh_all():
    """Poll every channel right now. Bypasses ETag because the user asked."""
    result = rss_poller.poll_all()
    return result.as_dict()
