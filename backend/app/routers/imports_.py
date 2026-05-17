"""Takeout CSV importer endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.schemas import ImportResult
from app.services.importers import import_takeout_csv, stamp_seen


router = APIRouter(prefix="/api/import", tags=["import"], dependencies=[RequireUser])


@router.post("/takeout", response_model=ImportResult)
async def import_takeout(
    file: UploadFile = File(...),
    interest_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty upload")
    try:
        result = import_takeout_csv(db, data, interest_id=interest_id)
    except Exception as exc:
        raise HTTPException(400, f"Import failed: {exc}") from exc
    stamp_seen(db)
    return result
