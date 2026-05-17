"""Pydantic schemas for request/response validation."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FilterKind = Literal[
    "title_include", "title_exclude",
    "desc_include", "desc_exclude",
    "max_age_days", "hide_shorts",
]


class FilterBase(BaseModel):
    kind: FilterKind
    pattern: str = ""
    enabled: bool = True


class FilterCreate(FilterBase):
    pass


class FilterUpdate(BaseModel):
    kind: FilterKind | None = None
    pattern: str | None = None
    enabled: bool | None = None


class FilterOut(FilterBase):
    id: int
    interest_id: int
    model_config = ConfigDict(from_attributes=True)


class InterestBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    color: str = "brand"
    icon: str = ""


class InterestCreate(InterestBase):
    pass


class InterestUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int | None = None


class InterestOut(InterestBase):
    id: int
    sort_order: int
    channel_count: int = 0
    unwatched_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class InterestDetail(InterestOut):
    channels: list["ChannelOut"] = []
    filters: list[FilterOut] = []


class ChannelOut(BaseModel):
    channel_id: str
    title: str
    handle: str
    thumbnail_url: str
    description: str
    last_fetched_at: datetime | None
    last_status: int | None
    last_error: str
    model_config = ConfigDict(from_attributes=True)


class ChannelAddRequest(BaseModel):
    # Anything paste-able: channel URL, video URL, @handle, raw UC...
    input: str = Field(min_length=1)
    interest_id: int | None = None


class ChannelAttachRequest(BaseModel):
    channel_id: str
    interest_id: int


class VideoOut(BaseModel):
    video_id: str
    channel_id: str
    channel_title: str
    title: str
    description: str
    published_at: datetime
    thumbnail_url: str
    duration_seconds: int | None
    view_count: int | None
    watched_at: datetime | None
    hidden_at: datetime | None
    saved_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class VideoStateUpdate(BaseModel):
    watched: bool | None = None
    hidden: bool | None = None
    saved: bool | None = None


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


class ImportResult(BaseModel):
    source: str
    interest_id: int
    channels_added: int
    channels_skipped: int
    errors: list[str] = []


class RefreshResult(BaseModel):
    channels_polled: int
    channels_failed: int
    videos_new: int
    videos_updated: int
    duration_seconds: float
