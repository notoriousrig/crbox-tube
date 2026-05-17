"""Resolve any user-pasteable YouTube identifier to a channel_id (UC...).

Supports:
  - Raw channel ID: "UCxxxxxxxxxxxxxxxxxxxxxx"
  - Channel URL: youtube.com/channel/UC...
  - Handle URL: youtube.com/@handle  -> scrape page
  - Bare handle: @handle             -> scrape /@handle
  - Legacy /user/<name> or /c/<name> -> scrape that page
  - Video URL (youtube.com/watch?v=… / youtu.be/…) -> scrape, find channel

Strategy: extract obvious things by regex first, then for everything else
fetch the page and grep the HTML for `"channelId":"UC..."`. Works without
an API key.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

import httpx


log = logging.getLogger(__name__)


_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)

_CHANNEL_ID_RE = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
# YouTube's handle pages no longer emit `"channelId":"UC..."` — try several
# attributes that consistently appear in the embedded ytInitialData JSON,
# then fall back to scraping a `/channel/UC...` link out of the HTML.
_HTML_CHANNEL_ID_PATTERNS = (
    re.compile(r'"externalId":"(UC[A-Za-z0-9_-]{22})"'),
    re.compile(r'"channelId":"(UC[A-Za-z0-9_-]{22})"'),
    re.compile(r'"browseId":"(UC[A-Za-z0-9_-]{22})"'),
    re.compile(r'/channel/(UC[A-Za-z0-9_-]{22})'),
)
_HTML_TITLE_RE = re.compile(r'<meta property="og:title" content="([^"]+)"')
_HTML_HANDLE_RE = re.compile(r'"canonicalBaseUrl":"/(@[\w.\-]+)"')
_HTML_THUMB_RE = re.compile(r'<meta property="og:image" content="([^"]+)"')
_HTML_DESC_RE = re.compile(r'<meta property="og:description" content="([^"]+)"')


@dataclass
class ResolvedChannel:
    channel_id: str
    title: str = ""
    handle: str = ""
    thumbnail_url: str = ""
    description: str = ""


class ChannelResolveError(Exception):
    pass


def _normalize(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        raise ChannelResolveError("Empty input")
    return raw


def _try_extract_video_channel(url: str) -> str | None:
    """If the URL points at a video, return a page URL to fetch."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host in ("youtu.be",):
        vid = parsed.path.lstrip("/").split("/")[0]
        return f"https://www.youtube.com/watch?v={vid}" if vid else None
    if host.endswith("youtube.com") or host == "youtube.com":
        if parsed.path.startswith("/watch"):
            qs = parse_qs(parsed.query)
            vid = (qs.get("v") or [None])[0]
            return f"https://www.youtube.com/watch?v={vid}" if vid else None
        if parsed.path.startswith("/shorts/"):
            vid = parsed.path.split("/", 2)[2].split("/")[0]
            return f"https://www.youtube.com/watch?v={vid}" if vid else None
    return None


def _build_fetch_url(raw: str) -> str:
    if raw.startswith("@"):
        return f"https://www.youtube.com/{raw}"

    if "://" not in raw and "/" not in raw and "." not in raw:
        # Probably a handle without @
        return f"https://www.youtube.com/@{raw}"

    if raw.startswith("youtube.com") or raw.startswith("www.youtube.com"):
        raw = "https://" + raw

    video_url = _try_extract_video_channel(raw)
    if video_url:
        return video_url

    parsed = urlparse(raw)
    if parsed.path.startswith("/channel/"):
        cid = parsed.path.split("/", 3)[2].split("/")[0]
        # We'll still fetch the channel page to populate metadata
        return f"https://www.youtube.com/channel/{cid}"
    if (
        parsed.path.startswith("/@")
        or parsed.path.startswith("/user/")
        or parsed.path.startswith("/c/")
    ):
        return f"https://www.youtube.com{parsed.path}"

    # Fallback: treat as a bare-handle attempt
    return f"https://www.youtube.com/@{raw.lstrip('@')}"


def resolve(raw: str, *, client: httpx.Client | None = None) -> ResolvedChannel:
    raw = _normalize(raw)

    # Fast path: raw channel ID
    if _CHANNEL_ID_RE.match(raw):
        return _populate_metadata(ResolvedChannel(channel_id=raw), client=client)

    # Direct /channel/UC… URL — extract the ID even before fetching
    if "/channel/UC" in raw:
        m = re.search(r"/channel/(UC[A-Za-z0-9_-]{22})", raw)
        if m:
            return _populate_metadata(ResolvedChannel(channel_id=m.group(1)), client=client)

    fetch_url = _build_fetch_url(raw)
    own = client is None
    if own:
        client = httpx.Client(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        )
    try:
        resp = client.get(fetch_url)
    except httpx.HTTPError as exc:
        raise ChannelResolveError(f"Fetch failed: {exc}") from exc
    finally:
        if own:
            client.close()

    if resp.status_code >= 400:
        raise ChannelResolveError(
            f"YouTube returned HTTP {resp.status_code} for {fetch_url}"
        )

    html = resp.text
    channel_id = _extract_channel_id(html)
    if not channel_id:
        raise ChannelResolveError(
            f"Could not find channelId in page for {fetch_url}. "
            "Bad handle, or YouTube changed their markup."
        )
    return _populate_from_html(channel_id, html)


def _extract_channel_id(html: str) -> str | None:
    for pat in _HTML_CHANNEL_ID_PATTERNS:
        m = pat.search(html)
        if m:
            return m.group(1)
    return None


def _populate_from_html(channel_id: str, html: str) -> ResolvedChannel:
    title_m = _HTML_TITLE_RE.search(html)
    handle_m = _HTML_HANDLE_RE.search(html)
    thumb_m = _HTML_THUMB_RE.search(html)
    desc_m = _HTML_DESC_RE.search(html)
    return ResolvedChannel(
        channel_id=channel_id,
        title=(title_m.group(1) if title_m else "")[:200],
        handle=(handle_m.group(1) if handle_m else "")[:120],
        thumbnail_url=(thumb_m.group(1) if thumb_m else "")[:500],
        description=(desc_m.group(1) if desc_m else "")[:1000],
    )


def _populate_metadata(
    rc: ResolvedChannel, *, client: httpx.Client | None
) -> ResolvedChannel:
    """For inputs that resolved without fetching (raw UC…), fetch the page
    once to populate title/handle/thumb."""
    own = client is None
    if own:
        client = httpx.Client(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
        )
    try:
        resp = client.get(f"https://www.youtube.com/channel/{rc.channel_id}")
        if resp.status_code < 400:
            return _populate_from_html(rc.channel_id, resp.text)
    except httpx.HTTPError as exc:
        log.warning("Metadata fetch failed for %s: %s", rc.channel_id, exc)
    finally:
        if own:
            client.close()
    return rc
