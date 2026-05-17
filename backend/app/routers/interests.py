"""Interest CRUD + reorder. Also returns aggregate counts used by the sidebar."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Interest, Video, VideoState, interest_channel
from app.schemas import (
    FilterOut,
    InterestCreate,
    InterestDetail,
    InterestOut,
    InterestUpdate,
    ReorderRequest,
)


router = APIRouter(prefix="/api/interests", tags=["interests"], dependencies=[RequireUser])


def _serialize(i: Interest, channel_count: int = 0, unwatched_count: int = 0) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "description": i.description,
        "color": i.color,
        "icon": i.icon,
        "sort_order": i.sort_order,
        "channel_count": channel_count,
        "unwatched_count": unwatched_count,
    }


def _counts_for_all(db: Session) -> tuple[dict[int, int], dict[int, int]]:
    """Return (channel_count_by_interest, unwatched_count_by_interest)."""
    channel_counts: dict[int, int] = {}
    for row in db.execute(
        select(interest_channel.c.interest_id, func.count())
        .group_by(interest_channel.c.interest_id)
    ).all():
        channel_counts[int(row[0])] = int(row[1])

    # Unwatched/non-hidden videos per interest. Done with a single grouped
    # query joining videos through interest_channel and left-joining state.
    unwatched: dict[int, int] = {}
    stmt = (
        select(interest_channel.c.interest_id, func.count(func.distinct(Video.video_id)))
        .join(Video, Video.channel_id == interest_channel.c.channel_id)
        .join(VideoState, VideoState.video_id == Video.video_id, isouter=True)
        .where(VideoState.watched_at.is_(None))
        .where(VideoState.hidden_at.is_(None))
        .group_by(interest_channel.c.interest_id)
    )
    for row in db.execute(stmt).all():
        unwatched[int(row[0])] = int(row[1])
    return channel_counts, unwatched


@router.get("", response_model=list[InterestOut])
def list_interests(db: Session = Depends(get_db)):
    rows = db.query(Interest).order_by(Interest.sort_order, Interest.id).all()
    ch_counts, unwatched = _counts_for_all(db)
    return [_serialize(i, ch_counts.get(i.id, 0), unwatched.get(i.id, 0)) for i in rows]


@router.post("", response_model=InterestOut, status_code=201)
def create_interest(payload: InterestCreate, db: Session = Depends(get_db)):
    if db.query(Interest).filter(Interest.name == payload.name).first():
        raise HTTPException(400, "Interest with that name already exists")
    last = db.query(Interest).order_by(Interest.sort_order.desc()).first()
    sort_order = (last.sort_order + 100) if last else 100
    i = Interest(**payload.model_dump(), sort_order=sort_order)
    db.add(i)
    db.commit()
    db.refresh(i)
    return _serialize(i)


@router.get("/{interest_id}", response_model=InterestDetail)
def get_interest(interest_id: int, db: Session = Depends(get_db)):
    i = db.get(Interest, interest_id)
    if i is None:
        raise HTTPException(404, "Interest not found")
    ch_counts, unwatched = _counts_for_all(db)
    return {
        **_serialize(i, ch_counts.get(i.id, 0), unwatched.get(i.id, 0)),
        "channels": [
            {
                "channel_id": c.channel_id,
                "title": c.title,
                "handle": c.handle,
                "thumbnail_url": c.thumbnail_url,
                "description": c.description,
                "last_fetched_at": c.last_fetched_at,
                "last_status": c.last_status,
                "last_error": c.last_error,
            }
            for c in i.channels
        ],
        "filters": [FilterOut.model_validate(f) for f in i.filters],
    }


@router.patch("/{interest_id}", response_model=InterestOut)
def update_interest(interest_id: int, payload: InterestUpdate, db: Session = Depends(get_db)):
    i = db.get(Interest, interest_id)
    if i is None:
        raise HTTPException(404, "Interest not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        clash = db.query(Interest).filter(
            Interest.name == data["name"], Interest.id != i.id
        ).first()
        if clash:
            raise HTTPException(400, "Interest with that name already exists")
    for k, v in data.items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _serialize(i)


@router.delete("/{interest_id}", status_code=204)
def delete_interest(interest_id: int, db: Session = Depends(get_db)):
    i = db.get(Interest, interest_id)
    if i is None:
        raise HTTPException(404, "Interest not found")
    db.delete(i)
    db.commit()


@router.post("/reorder", status_code=204)
def reorder_interests(payload: ReorderRequest, db: Session = Depends(get_db)):
    by_id = {
        i.id: i
        for i in db.query(Interest).filter(
            Interest.id.in_([item.id for item in payload.items])
        ).all()
    }
    for item in payload.items:
        row = by_id.get(item.id)
        if row is not None:
            row.sort_order = item.sort_order
    db.commit()
