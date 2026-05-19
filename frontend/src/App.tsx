import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Upload } from "lucide-react";

import { api } from "./api";
import type {
  ContentFilter,
  Interest,
  SortMode,
  TimeWindow,
  Video,
  VideoStateView,
} from "./types";
import { youtubeWatchUrl } from "./lib/format";

import { Sidebar } from "./components/Sidebar";
import { VideoGrid } from "./components/VideoGrid";
import { InterestModal } from "./components/InterestModal";
import { ManageInterestPanel } from "./components/ManageInterestPanel";
import { ImportModal } from "./components/ImportModal";
import { AddChannelModal } from "./components/AddChannelModal";
import { CommandPalette } from "./components/CommandPalette";
import { ThemeToggle } from "./components/ThemeToggle";
import { ViewModeToggle } from "./components/ViewModeToggle";
import { useViewMode } from "./hooks/useViewMode";

const VIEW_TABS: { id: VideoStateView; label: string }[] = [
  { id: "unwatched", label: "Unwatched" },
  { id: "saved", label: "Saved" },
  { id: "watched", label: "Watched" },
  { id: "hidden", label: "Hidden" },
  { id: "all", label: "All" },
];

const TIME_OPTIONS: { id: TimeWindow; label: string }[] = [
  { id: "all", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const CONTENT_OPTIONS: { id: ContentFilter; label: string; title?: string }[] = [
  { id: "all", label: "All" },
  { id: "no_shorts", label: "No shorts" },
  { id: "shorts_only", label: "Shorts" },
  { id: "long", label: "Long", title: "≥ 20 min. Needs phase 2 (YOUTUBE_API_KEY); empty in phase 1." },
];

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "most_viewed", label: "Most viewed" },
];

export default function App() {
  const qc = useQueryClient();
  const { data: interests = [] } = useQuery({
    queryKey: ["interests"],
    queryFn: api.listInterests,
  });

  const [selectedId, setSelectedId] = useState<number | "all">("all");
  const [state, setState] = useState<VideoStateView>("unwatched");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const { mode: viewMode, setMode: setViewMode, cycle: cycleViewMode } = useViewMode();

  const [interestModal, setInterestModal] = useState<{ open: boolean; existing: Interest | null }>({
    open: false, existing: null,
  });
  const [manageId, setManageId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const interestId = selectedId === "all" ? null : selectedId;
  const selectedInterest = interests.find((i) => i.id === selectedId);

  // Auto-select first interest if none chosen yet but interests exist
  useEffect(() => {
    if (selectedId === "all" && interests.length > 0) {
      // Stay on "all" — that's the natural default
    }
  }, [interests, selectedId]);

  // ⌘K palette + n shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const inField = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (!inField && e.key === "n") {
        e.preventDefault();
        setInterestModal({ open: true, existing: null });
      } else if (!inField && e.key === "r") {
        e.preventDefault();
        refreshAll.mutate();
      } else if (!inField && e.key === "v") {
        e.preventDefault();
        cycleViewMode();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const refreshAll = useMutation({
    mutationFn: api.refreshAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interests"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  // Pre-fetched videos for palette search (only when palette opens)
  const { data: paletteVideos = [] } = useQuery({
    queryKey: ["videos-palette"],
    queryFn: () => api.listVideos({ state: "unwatched", limit: 300 }),
    enabled: paletteOpen,
  });

  return (
    <div className="h-full flex">
      <Sidebar
        interests={interests}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNewInterest={() => setInterestModal({ open: true, existing: null })}
        onManage={(id) => setManageId(id)}
        onEdit={(i) => setInterestModal({ open: true, existing: i })}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
          <div className="px-5 py-3 flex items-center gap-3">
            <h1 className="text-lg font-semibold truncate">
              {selectedId === "all" ? "All" : selectedInterest?.name ?? ""}
            </h1>
            {selectedInterest && (
              <span className="text-sm text-zinc-500">
                {selectedInterest.channel_count} channels
              </span>
            )}

            <div className="ml-auto flex items-center gap-1">
              {selectedInterest && (
                <button
                  onClick={() => setAddChannelOpen(true)}
                  className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  title="Add channel to this interest"
                >
                  <Plus size={18} />
                </button>
              )}
              <button
                onClick={() => refreshAll.mutate()}
                disabled={refreshAll.isPending}
                className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                title="Refresh all channels (r)"
              >
                <RefreshCw size={18} className={refreshAll.isPending ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
                title="Import Takeout subscriptions"
              >
                <Upload size={18} />
              </button>
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              <ThemeToggle />
            </div>
          </div>

          <div className="px-5 pb-2 flex items-center gap-1 text-sm">
            {VIEW_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setState(t.id)}
                className={`px-3 py-1 rounded ${
                  state === t.id
                    ? "bg-brand-500 text-white"
                    : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {t.label}
              </button>
            ))}
            {refreshAll.data && !refreshAll.isPending && (
              <span className="ml-auto text-xs text-zinc-500">
                Last refresh: {refreshAll.data.videos_new} new,{" "}
                {refreshAll.data.channels_polled} channels in{" "}
                {refreshAll.data.duration_seconds.toFixed(1)}s
              </span>
            )}
          </div>

          <div className="px-5 pb-2 flex flex-wrap items-center gap-1 text-xs">
            <PillGroup
              options={TIME_OPTIONS}
              value={timeWindow}
              onChange={setTimeWindow}
            />
            <span className="mx-2 text-zinc-300 dark:text-zinc-700" aria-hidden>
              |
            </span>
            <PillGroup
              options={CONTENT_OPTIONS}
              value={contentFilter}
              onChange={setContentFilter}
            />
            <span className="mx-2 text-zinc-300 dark:text-zinc-700" aria-hidden>
              |
            </span>
            <label className="flex items-center gap-1 text-zinc-500">
              <span>Sort:</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
          <VideoGrid
            interestId={interestId}
            state={state}
            mode={viewMode}
            timeWindow={timeWindow}
            content={contentFilter}
            sort={sortMode}
          />
        </main>
      </div>

      <InterestModal
        open={interestModal.open}
        existing={interestModal.existing}
        onClose={() => setInterestModal({ open: false, existing: null })}
      />
      {manageId != null && (
        <ManageInterestPanel
          open
          interestId={manageId}
          onClose={() => setManageId(null)}
          onEdit={(i) => setInterestModal({ open: true, existing: i })}
        />
      )}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      {addChannelOpen && selectedInterest && (
        <AddChannelModal
          open
          interestId={selectedInterest.id}
          onClose={() => setAddChannelOpen(false)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          interests={interests}
          videos={paletteVideos}
          onClose={() => setPaletteOpen(false)}
          onPickInterest={(id) => setSelectedId(id)}
          onPickVideo={(v: Video) => {
            api.clickVideo(v.video_id).catch(() => {});
            window.open(youtubeWatchUrl(v.video_id), "_blank", "noopener,noreferrer");
          }}
        />
      )}
    </div>
  );
}

interface PillGroupProps<T extends string> {
  options: { id: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}

function PillGroup<T extends string>({ options, value, onChange }: PillGroupProps<T>) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={o.title}
          className={`px-2 py-0.5 rounded ${
            value === o.id
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
