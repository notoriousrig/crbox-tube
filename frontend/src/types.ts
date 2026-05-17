export type FilterKind =
  | "title_include"
  | "title_exclude"
  | "desc_include"
  | "desc_exclude"
  | "max_age_days"
  | "hide_shorts";

export type VideoStateView = "unwatched" | "watched" | "saved" | "hidden" | "all";

export interface Filter {
  id: number;
  interest_id: number;
  kind: FilterKind;
  pattern: string;
  enabled: boolean;
}

export interface Interest {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  channel_count: number;
  unwatched_count: number;
}

export interface Channel {
  channel_id: string;
  title: string;
  handle: string;
  thumbnail_url: string;
  description: string;
  last_fetched_at: string | null;
  last_status: number | null;
  last_error: string;
}

export interface InterestDetail extends Interest {
  channels: Channel[];
  filters: Filter[];
}

export interface Video {
  video_id: string;
  channel_id: string;
  channel_title: string;
  title: string;
  description: string;
  published_at: string;
  thumbnail_url: string;
  duration_seconds: number | null;
  view_count: number | null;
  watched_at: string | null;
  hidden_at: string | null;
  saved_at: string | null;
}

export interface ImportResult {
  source: string;
  interest_id: number;
  channels_added: number;
  channels_skipped: number;
  errors: string[];
}

export interface RefreshResult {
  channels_polled: number;
  channels_failed: number;
  videos_new: number;
  videos_updated: number;
  duration_seconds: number;
}
