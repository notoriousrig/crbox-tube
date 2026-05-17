"""Per-interest filter CRUD."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Filter, Interest
from app.schemas import FilterCreate, FilterOut, FilterUpdate


router = APIRouter(prefix="/api/interests/{interest_id}/filters", tags=["filters"], dependencies=[RequireUser])


def _validate_pattern(kind: str, pattern: str) -> None:
    if kind in ("title_include", "title_exclude", "desc_include", "desc_exclude"):
        if not pattern.strip():
            raise HTTPException(400, "Pattern is required for regex filters")
        try:
            re.compile(pattern)
        except re.error as exc:
            raise HTTPException(400, f"Invalid regex: {exc}") from exc
    elif kind == "max_age_days":
        try:
            n = int(pattern)
        except (TypeError, ValueError):
            raise HTTPException(400, "max_age_days requires an integer pattern")
        if n <= 0:
            raise HTTPException(400, "max_age_days must be positive")
    elif kind == "hide_shorts":
        pass  # no pattern needed
    else:
        raise HTTPException(400, f"Unknown filter kind: {kind}")


@router.get("", response_model=list[FilterOut])
def list_filters(interest_id: int, db: Session = Depends(get_db)):
    interest = db.get(Interest, interest_id)
    if interest is None:
        raise HTTPException(404, "Interest not found")
    return [FilterOut.model_validate(f) for f in interest.filters]


@router.post("", response_model=FilterOut, status_code=201)
def create_filter(interest_id: int, payload: FilterCreate, db: Session = Depends(get_db)):
    interest = db.get(Interest, interest_id)
    if interest is None:
        raise HTTPException(404, "Interest not found")
    _validate_pattern(payload.kind, payload.pattern)
    f = Filter(interest_id=interest_id, **payload.model_dump())
    db.add(f)
    db.commit()
    db.refresh(f)
    return FilterOut.model_validate(f)


@router.patch("/{filter_id}", response_model=FilterOut)
def update_filter(
    interest_id: int, filter_id: int, payload: FilterUpdate, db: Session = Depends(get_db),
):
    f = db.get(Filter, filter_id)
    if f is None or f.interest_id != interest_id:
        raise HTTPException(404, "Filter not found")
    data = payload.model_dump(exclude_unset=True)
    kind = data.get("kind", f.kind)
    pattern = data.get("pattern", f.pattern)
    _validate_pattern(kind, pattern)
    for k, v in data.items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return FilterOut.model_validate(f)


@router.delete("/{filter_id}", status_code=204)
def delete_filter(interest_id: int, filter_id: int, db: Session = Depends(get_db)):
    f = db.get(Filter, filter_id)
    if f is None or f.interest_id != interest_id:
        raise HTTPException(404, "Filter not found")
    db.delete(f)
    db.commit()
