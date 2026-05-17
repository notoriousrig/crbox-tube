"""Google Takeout subscriptions.csv → channels.

Takeout CSV format:
    Channel Id,Channel Url,Channel Title
    UCxxx...,https://www.youtube.com/channel/UCxxx...,Some Channel
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Channel, Interest


log = logging.getLogger(__name__)


_DEFAULT_INTEREST_NAME = "Unsorted"


def get_or_create_unsorted_interest(db: Session) -> Interest:
    inter = db.query(Interest).filter(Interest.name == _DEFAULT_INTEREST_NAME).first()
    if inter is not None:
        return inter
    last = db.query(Interest).order_by(Interest.sort_order.desc()).first()
    sort_order = (last.sort_order + 100) if last else 100
    inter = Interest(
        name=_DEFAULT_INTEREST_NAME,
        description="Channels imported from Google Takeout, awaiting bucketing.",
        sort_order=sort_order,
        icon="📥",
    )
    db.add(inter)
    db.flush()
    return inter


def import_takeout_csv(db: Session, raw: bytes, *, interest_id: int | None = None) -> dict:
    """Parse a subscriptions.csv from Google Takeout and attach all channels
    to either the named interest or the auto-created 'Unsorted' bucket.

    Returns a dict matching `ImportResult` shape.
    """
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    if interest_id is not None:
        target = db.get(Interest, interest_id)
        if target is None:
            return {
                "source": "takeout-csv",
                "interest_id": interest_id,
                "channels_added": 0,
                "channels_skipped": 0,
                "errors": [f"Interest {interest_id} not found"],
            }
    else:
        target = get_or_create_unsorted_interest(db)

    added = 0
    skipped = 0
    errors: list[str] = []

    # Column names vary across Takeout versions; normalize.
    def get(row: dict, *keys: str) -> str:
        for k in keys:
            for variant in (k, k.lower(), k.title(), k.upper()):
                if variant in row and row[variant]:
                    return row[variant].strip()
        return ""

    for i, row in enumerate(reader, start=2):
        cid = get(row, "Channel Id", "channel_id", "ChannelId")
        if not cid:
            continue
        title = get(row, "Channel Title", "channel_title", "ChannelTitle")
        url = get(row, "Channel Url", "channel_url", "ChannelUrl")

        ch = db.get(Channel, cid)
        if ch is None:
            ch = Channel(channel_id=cid, title=title[:200])
            db.add(ch)
            db.flush()
            added += 1
        else:
            # Channel exists — only attach to interest if not already there
            if not ch.title and title:
                ch.title = title[:200]

        if target not in ch.interests:
            ch.interests.append(target)
        else:
            skipped += 1

        # Best-effort: derive handle from URL if it's an /@handle one
        if not ch.handle and "/@" in url:
            handle = "/" + url.split("/@", 1)[1].split("/")[0]
            ch.handle = ("@" + handle.lstrip("/@"))[:120]

    db.commit()
    return {
        "source": "takeout-csv",
        "interest_id": target.id,
        "channels_added": added,
        "channels_skipped": skipped,
        "errors": errors,
    }


def stamp_seen(db: Session) -> None:
    """Touch a setting so the import timestamp is recorded."""
    from app.models import Setting
    row = db.get(Setting, "last_takeout_import_at")
    iso = datetime.utcnow().isoformat()
    if row is None:
        db.add(Setting(key="last_takeout_import_at", value=iso))
    else:
        row.value = iso
    db.commit()
