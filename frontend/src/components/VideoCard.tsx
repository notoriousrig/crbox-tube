import { Bookmark, BookmarkCheck, Check, EyeOff, ExternalLink } from "lucide-react";
import type { Video } from "../types";
import type { ViewMode } from "../hooks/useViewMode";
import { formatDuration, formatViewCount, relativeTime, youtubeWatchUrl } from "../lib/format";

interface Props {
  video: Video;
  mode: ViewMode;
  onClickThrough: (v: Video) => void;
  onMarkWatched: (v: Video, watched: boolean) => void;
  onMarkHidden: (v: Video, hidden: boolean) => void;
  onMarkSaved: (v: Video, saved: boolean) => void;
}

export function VideoCard({
  video,
  mode,
  onClickThrough,
  onMarkWatched,
  onMarkHidden,
  onMarkSaved,
}: Props) {
  const watched = !!video.watched_at;
  const saved = !!video.saved_at;
  const duration = formatDuration(video.duration_seconds);

  if (mode === "list") {
    return (
      <ListItem
        video={video}
        watched={watched}
        saved={saved}
        duration={duration}
        onClickThrough={onClickThrough}
        onMarkWatched={onMarkWatched}
        onMarkHidden={onMarkHidden}
        onMarkSaved={onMarkSaved}
      />
    );
  }

  if (mode === "text") {
    return (
      <TextItem
        video={video}
        watched={watched}
        saved={saved}
        duration={duration}
        onClickThrough={onClickThrough}
        onMarkWatched={onMarkWatched}
        onMarkHidden={onMarkHidden}
        onMarkSaved={onMarkSaved}
      />
    );
  }

  const isCompact = mode === "compact";
  const titleSize = isCompact ? "text-xs" : "text-sm";
  const metaSize = isCompact ? "text-[11px]" : "text-xs";
  const padding = isCompact ? "p-2" : "p-3";
  const iconSize = isCompact ? 14 : 16;
  const btnPad = isCompact ? "p-1" : "p-1.5";

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
          <span
            className={`absolute bottom-1.5 right-1.5 ${metaSize} bg-black/80 text-white px-1.5 py-0.5 rounded`}
          >
            {duration}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition">
          <ExternalLink size={isCompact ? 22 : 28} className="text-white" />
        </span>
      </a>

      <div className={padding}>
        <h3
          className={`${titleSize} font-medium line-clamp-2 leading-snug mb-1`}
          title={video.title}
        >
          {video.title}
        </h3>
        <div className={`${metaSize} text-zinc-500 truncate`} title={video.channel_title}>
          {video.channel_title}
        </div>
        <div className={`${metaSize} text-zinc-500 flex items-center gap-2 mt-0.5`}>
          <span>{relativeTime(video.published_at)}</span>
          {video.view_count != null && (
            <>
              <span aria-hidden>•</span>
              <span>{formatViewCount(video.view_count)}</span>
            </>
          )}
        </div>

        <div className={`${isCompact ? "mt-1" : "mt-2"} flex items-center gap-1`}>
          <button
            onClick={() => onMarkWatched(video, !watched)}
            className={`${btnPad} rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
              watched ? "text-brand-500" : "text-zinc-500"
            }`}
            title={watched ? "Mark unwatched" : "Mark watched"}
          >
            <Check size={iconSize} />
          </button>
          <button
            onClick={() => onMarkSaved(video, !saved)}
            className={`${btnPad} rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
              saved ? "text-brand-500" : "text-zinc-500"
            }`}
            title={saved ? "Unsave" : "Save"}
          >
            {saved ? <BookmarkCheck size={iconSize} /> : <Bookmark size={iconSize} />}
          </button>
          <button
            onClick={() => onMarkHidden(video, true)}
            className={`${btnPad} rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 ml-auto`}
            title="Hide"
          >
            <EyeOff size={iconSize} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ListItemProps {
  video: Video;
  watched: boolean;
  saved: boolean;
  duration: string | null;
  onClickThrough: (v: Video) => void;
  onMarkWatched: (v: Video, watched: boolean) => void;
  onMarkHidden: (v: Video, hidden: boolean) => void;
  onMarkSaved: (v: Video, saved: boolean) => void;
}

function TextItem({
  video,
  watched,
  saved,
  duration,
  onClickThrough,
  onMarkWatched,
  onMarkHidden,
  onMarkSaved,
}: ListItemProps) {
  return (
    <div
      className={`group flex items-center gap-2 py-1.5 px-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition ${
        watched ? "opacity-60" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <a
          href={youtubeWatchUrl(video.video_id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onClickThrough(video)}
          className="block"
        >
          <span
            className="text-sm font-medium truncate hover:underline block"
            title={video.title}
          >
            {video.title}
          </span>
        </a>
        <div className="text-xs text-zinc-500 flex items-center gap-2 truncate">
          <span className="truncate" title={video.channel_title}>
            {video.channel_title}
          </span>
          <span aria-hidden>•</span>
          <span className="flex-shrink-0">{relativeTime(video.published_at)}</span>
          {video.view_count != null && (
            <>
              <span aria-hidden>•</span>
              <span className="flex-shrink-0">{formatViewCount(video.view_count)}</span>
            </>
          )}
          {duration && (
            <>
              <span aria-hidden>•</span>
              <span className="flex-shrink-0 tabular-nums">{duration}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onMarkWatched(video, !watched)}
          className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
            watched ? "text-brand-500" : "text-zinc-400"
          }`}
          title={watched ? "Mark unwatched" : "Mark watched"}
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => onMarkSaved(video, !saved)}
          className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
            saved ? "text-brand-500" : "text-zinc-400"
          }`}
          title={saved ? "Unsave" : "Save"}
        >
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>
        <button
          onClick={() => onMarkHidden(video, true)}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100 transition"
          title="Hide"
        >
          <EyeOff size={14} />
        </button>
      </div>
    </div>
  );
}

function ListItem({
  video,
  watched,
  saved,
  duration,
  onClickThrough,
  onMarkWatched,
  onMarkHidden,
  onMarkSaved,
}: ListItemProps) {
  return (
    <div
      className={`group flex gap-3 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-card transition ${
        watched ? "opacity-60" : ""
      }`}
    >
      <a
        href={youtubeWatchUrl(video.video_id)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClickThrough(video)}
        className="relative flex-shrink-0 w-40 sm:w-48 aspect-video bg-zinc-200 dark:bg-zinc-800"
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
          <span className="absolute bottom-1 right-1 text-[10px] bg-black/80 text-white px-1 py-0.5 rounded">
            {duration}
          </span>
        )}
      </a>
      <div className="flex-1 min-w-0 py-2 pr-2 flex flex-col">
        <a
          href={youtubeWatchUrl(video.video_id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onClickThrough(video)}
          className="block"
        >
          <h3
            className="text-sm font-medium line-clamp-2 leading-snug hover:underline"
            title={video.title}
          >
            {video.title}
          </h3>
        </a>
        <div
          className="text-xs text-zinc-500 truncate mt-0.5"
          title={video.channel_title}
        >
          {video.channel_title}
        </div>
        <div className="text-xs text-zinc-500 flex items-center gap-2 mt-auto pt-1">
          <span>{relativeTime(video.published_at)}</span>
          {video.view_count != null && (
            <>
              <span aria-hidden>•</span>
              <span>{formatViewCount(video.view_count)}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => onMarkWatched(video, !watched)}
              className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                watched ? "text-brand-500" : "text-zinc-500"
              }`}
              title={watched ? "Mark unwatched" : "Mark watched"}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => onMarkSaved(video, !saved)}
              className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
                saved ? "text-brand-500" : "text-zinc-500"
              }`}
              title={saved ? "Unsave" : "Save"}
            >
              {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>
            <button
              onClick={() => onMarkHidden(video, true)}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
              title="Hide"
            >
              <EyeOff size={14} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
