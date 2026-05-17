"""SQLAlchemy models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Many-to-many join: a channel can belong to multiple interests
interest_channel = Table(
    "interest_channel",
    Base.metadata,
    Column("interest_id", Integer, ForeignKey("interest.id", ondelete="CASCADE"), primary_key=True),
    Column("channel_id", String(40), ForeignKey("channel.channel_id", ondelete="CASCADE"), primary_key=True),
)


class Interest(Base):
    __tablename__ = "interest"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="brand", nullable=False)
    icon: Mapped[str] = mapped_column(String(40), default="", nullable=False)  # emoji
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    channels: Mapped[list["Channel"]] = relationship(
        secondary=interest_channel, back_populates="interests", order_by="Channel.title"
    )
    filters: Mapped[list["Filter"]] = relationship(
        back_populates="interest", cascade="all, delete-orphan", order_by="Filter.id"
    )

    __table_args__ = (UniqueConstraint("name", name="uq_interest_name"),)


class Channel(Base):
    __tablename__ = "channel"

    channel_id: Mapped[str] = mapped_column(String(40), primary_key=True)  # UC...
    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    handle: Mapped[str] = mapped_column(String(120), default="", nullable=False)  # @handle
    thumbnail_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Poll bookkeeping
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[int | None] = mapped_column(Integer, nullable=True)  # HTTP status
    last_error: Mapped[str] = mapped_column(Text, default="", nullable=False)
    etag: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    last_modified: Mapped[str] = mapped_column(String(80), default="", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    interests: Mapped[list[Interest]] = relationship(
        secondary=interest_channel, back_populates="channels"
    )
    videos: Mapped[list["Video"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )


class Filter(Base):
    """Per-interest filter row. Applied at read time when listing videos."""

    __tablename__ = "filter"

    id: Mapped[int] = mapped_column(primary_key=True)
    interest_id: Mapped[int] = mapped_column(
        ForeignKey("interest.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # title_include | title_exclude | desc_include | desc_exclude
    # | max_age_days | hide_shorts
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    # Regex pattern for the *_include / *_exclude kinds; integer string for
    # max_age_days; empty for hide_shorts (the kind alone is the toggle).
    pattern: Mapped[str] = mapped_column(Text, default="", nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    interest: Mapped[Interest] = relationship(back_populates="filters")


class Video(Base):
    __tablename__ = "video"

    video_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    channel_id: Mapped[str] = mapped_column(
        ForeignKey("channel.channel_id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    thumbnail_url: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Nullable in phase 1 — RSS doesn't expose duration. Phase 2 fills it via
    # the Data API (videos.list contentDetails.duration → seconds).
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # RSS gives a snapshot of view count at fetch time; not authoritative.
    view_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    channel: Mapped[Channel] = relationship(back_populates="videos")
    state: Mapped["VideoState | None"] = relationship(
        back_populates="video", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_video_chan_pub", "channel_id", "published_at"),
    )


class VideoState(Base):
    """Local watched/hidden/saved marks. One row max per video."""

    __tablename__ = "video_state"

    video_id: Mapped[str] = mapped_column(
        ForeignKey("video.video_id", ondelete="CASCADE"), primary_key=True
    )
    watched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    saved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Phase 2: timestamp when this video was pushed to the YT "crbox-watched"
    # playlist via OAuth. NULL until then.
    synced_to_yt_playlist_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    video: Mapped[Video] = relationship(back_populates="state")


class OAuthToken(Base):
    """Phase 2 — YouTube OAuth refresh token storage. Empty in phase 1.

    Single-user app, so one row max; key is the literal string 'youtube'.
    """

    __tablename__ = "oauth_token"

    provider: Mapped[str] = mapped_column(String(40), primary_key=True)
    refresh_token: Mapped[str] = mapped_column(Text, default="", nullable=False)
    access_token: Mapped[str] = mapped_column(Text, default="", nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scope: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class Setting(Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="", nullable=False)
