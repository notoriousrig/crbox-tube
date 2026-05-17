"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-16

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "interest",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(20), nullable=False, server_default="brand"),
        sa.Column("icon", sa.String(40), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_interest_name"),
    )

    op.create_table(
        "channel",
        sa.Column("channel_id", sa.String(40), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("handle", sa.String(120), nullable=False, server_default=""),
        sa.Column("thumbnail_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("last_fetched_at", sa.DateTime(), nullable=True),
        sa.Column("last_status", sa.Integer(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("etag", sa.String(120), nullable=False, server_default=""),
        sa.Column("last_modified", sa.String(80), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "interest_channel",
        sa.Column("interest_id", sa.Integer(),
                  sa.ForeignKey("interest.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("channel_id", sa.String(40),
                  sa.ForeignKey("channel.channel_id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "filter",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("interest_id", sa.Integer(),
                  sa.ForeignKey("interest.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("pattern", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_filter_interest_id", "filter", ["interest_id"])

    op.create_table(
        "video",
        sa.Column("video_id", sa.String(20), primary_key=True),
        sa.Column("channel_id", sa.String(40),
                  sa.ForeignKey("channel.channel_id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=True),
        sa.Column("seen_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_video_channel_id", "video", ["channel_id"])
    op.create_index("ix_video_published_at", "video", ["published_at"])
    op.create_index("ix_video_chan_pub", "video", ["channel_id", "published_at"])

    op.create_table(
        "video_state",
        sa.Column("video_id", sa.String(20),
                  sa.ForeignKey("video.video_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("watched_at", sa.DateTime(), nullable=True),
        sa.Column("hidden_at", sa.DateTime(), nullable=True),
        sa.Column("saved_at", sa.DateTime(), nullable=True),
        sa.Column("synced_to_yt_playlist_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "oauth_token",
        sa.Column("provider", sa.String(40), primary_key=True),
        sa.Column("refresh_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("access_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("scope", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "setting",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("setting")
    op.drop_table("oauth_token")
    op.drop_table("video_state")
    op.drop_index("ix_video_chan_pub", table_name="video")
    op.drop_index("ix_video_published_at", table_name="video")
    op.drop_index("ix_video_channel_id", table_name="video")
    op.drop_table("video")
    op.drop_index("ix_filter_interest_id", table_name="filter")
    op.drop_table("filter")
    op.drop_table("interest_channel")
    op.drop_table("channel")
    op.drop_table("interest")
