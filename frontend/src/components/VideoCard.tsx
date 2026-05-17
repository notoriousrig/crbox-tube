import { Bookmark, BookmarkCheck, Check, EyeOff, ExternalLink } from "lucide-react";
import type { Video } from "../types";
import { formatDuration, formatViewCount, relativeTime, youtubeWatchUrl } from "../lib/format";

interface Props {
  video: Video;
  onClickThrough: (v: Video) => void;
  onMarkWatched: (v: Video, watched: boolean) => void;
  onMarkHidden: (v: Video, hidden: boolean) => void;
  onMarkSaved: (v: Video, saved: boolean) => void;
}

export function VideoCard({
  video,
  onClickThrough,
  onMarkWatched,
  onMarkHidden,
  onMarkSaved,
}: Props) {
  const watched = !!video.watched_at;
  const saved = !!video.saved_at;
  const duration = formatDuration(video.duration_seconds);

  return (
    <div
      className={`group rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-card transition ${
        watched ? "opacity-60" : ""
      }`}
    >
      <a
        href={youtubeWatchUrl(video.video_id)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClickThrough(video)}
        className="block relative aspect-video bg-zinc-200 dark:bg-zinc-800"
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 text-xs bg-black/80 text-white px-1.5 py-0.5 rounded">
            {duration}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition">
          <ExternalLink size={28} className="text-white" />
        </span>
      </a>

      <div className="p-3">
        <h3
          className="text-sm font-medium line-clamp-2 leading-snug mb-1"
          title={video.title}
        >
          {video.title}
        </h3>
        <div className="text-xs text-zinc-500 truncate" title={video.channel_title}>
          {video.channel_title}
        </div>
        <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
          <span>{relativeTime(video.published_at)}</span>
          {video.view_count != null && (
            <>
              <span aria-hidden>•</span>
              <span>{formatViewCount(video.view_count)}</span>
            </>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => onMarkWatched(video, !watched)}
            className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
              watched ? "text-brand-500" : "text-zinc-500"
            }`}
            title={watched ? "Mark unwatched" : "Mark watched"}
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => onMarkSaved(video, !saved)}
            className={`p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
              saved ? "text-brand-500" : "text-zinc-500"
            }`}
            title={saved ? "Unsave" : "Save"}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
          <button
            onClick={() => onMarkHidden(video, true)}
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 ml-auto"
            title="Hide"
          >
            <EyeOff size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
