"""Apply per-interest filters to a list of videos at read time.

Filter kinds:
  - title_include / title_exclude — regex against title (case-insensitive)
  - desc_include  / desc_exclude  — regex against description
  - max_age_days                  — drop videos older than N days
  - hide_shorts                   — drop heuristic-detected shorts

Filters are stacked, all must accept the video for it to pass.

Hide-shorts heuristic (phase 1, no duration data):
  - Title or description contains '#shorts' or '#short' (any case)
  - Title ends with '#shorts' marker
  - When duration_seconds IS known (phase 2 fills it), <= 60s is a short
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable

from app.models import Filter, Video


log = logging.getLogger(__name__)


_SHORTS_RE = re.compile(r"#short(s)?\b", re.IGNORECASE)


@dataclass(frozen=True)
class CompiledFilter:
    kind: str
    pattern: str
    regex: re.Pattern | None
    max_age_days: int | None


def compile_filters(filters: Iterable[Filter]) -> list[CompiledFilter]:
    compiled: list[CompiledFilter] = []
    for f in filters:
        if not f.enabled:
            continue
        if f.kind in ("title_include", "title_exclude", "desc_include", "desc_exclude"):
            pattern = f.pattern or ""
            try:
                rgx = re.compile(pattern, re.IGNORECASE) if pattern else None
            except re.error:
                log.warning("Invalid regex on filter %s: %r — skipping", f.id, pattern)
                continue
            if rgx is None:
                continue
            compiled.append(CompiledFilter(
                kind=f.kind, pattern=pattern, regex=rgx, max_age_days=None,
            ))
        elif f.kind == "max_age_days":
            try:
                days = int(f.pattern)
            except (TypeError, ValueError):
                continue
            if days <= 0:
                continue
            compiled.append(CompiledFilter(
                kind=f.kind, pattern=f.pattern, regex=None, max_age_days=days,
            ))
        elif f.kind == "hide_shorts":
            compiled.append(CompiledFilter(
                kind=f.kind, pattern="", regex=None, max_age_days=None,
            ))
        else:
            log.warning("Unknown filter kind %r on filter %s", f.kind, f.id)
    return compiled


def _looks_like_short(v: Video) -> bool:
    if v.duration_seconds is not None:
        return v.duration_seconds > 0 and v.duration_seconds <= 60
    if _SHORTS_RE.search(v.title or ""):
        return True
    if _SHORTS_RE.search(v.description or ""):
        return True
    return False


def passes(video: Video, compiled: list[CompiledFilter], *, now: datetime | None = None) -> bool:
    """Return True if the video should be shown."""
    now = now or datetime.utcnow()
    for cf in compiled:
        if cf.kind == "title_include":
            assert cf.regex is not None
            if not cf.regex.search(video.title or ""):
                return False
        elif cf.kind == "title_exclude":
            assert cf.regex is not None
            if cf.regex.search(video.title or ""):
                return False
        elif cf.kind == "desc_include":
            assert cf.regex is not None
            if not cf.regex.search(video.description or ""):
                return False
        elif cf.kind == "desc_exclude":
            assert cf.regex is not None
            if cf.regex.search(video.description or ""):
                return False
        elif cf.kind == "max_age_days":
            assert cf.max_age_days is not None
            if (now - video.published_at) > timedelta(days=cf.max_age_days):
                return False
        elif cf.kind == "hide_shorts":
            if _looks_like_short(video):
                return False
    return True
