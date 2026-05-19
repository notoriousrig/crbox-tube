import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { api } from "../api";
import type { Filter, FilterKind, Interest } from "../types";
import { youtubeChannelUrl } from "../lib/format";
import { AddChannelModal } from "./AddChannelModal";

interface Props {
  open: boolean;
  interestId: number;
  onClose: () => void;
  onEdit: (i: Interest) => void;
}

const FILTER_LABELS: Record<FilterKind, { label: string; needsPattern: boolean; placeholder: string }> = {
  title_include: { label: "Title must match", needsPattern: true, placeholder: "regex e.g. ^Live: " },
  title_exclude: { label: "Title must NOT match", needsPattern: true, placeholder: "regex e.g. shorts|live" },
  desc_include: { label: "Description must match", needsPattern: true, placeholder: "regex" },
  desc_exclude: { label: "Description must NOT match", needsPattern: true, placeholder: "regex" },
  max_age_days: { label: "Hide videos older than (days)", needsPattern: true, placeholder: "e.g. 30" },
  hide_shorts: { label: "Hide shorts (heuristic)", needsPattern: false, placeholder: "" },
};

export function ManageInterestPanel({ open, interestId, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const { data: detail } = useQuery({
    queryKey: ["interest", interestId],
    queryFn: () => api.getInterest(interestId),
    enabled: open,
  });
  const [addChannelOpen, setAddChannelOpen] = useState(false);

  const detach = useMutation({
    mutationFn: (channel_id: string) => api.detachChannel(channel_id, interestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interest", interestId] });
      qc.invalidateQueries({ queryKey: ["interests"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });
  const refresh = useMutation({
    mutationFn: (channel_id: string) => api.refreshChannel(channel_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interest", interestId] });
      qc.invalidateQueries({ queryKey: ["interests"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 w-full max-w-xl h-full overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-5 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>{detail?.icon} {detail?.name ?? "…"}</span>
            {detail && (
              <button
                onClick={() => onEdit(detail)}
                className="p-1 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                title="Rename / edit"
              >
                <Pencil size={14} />
              </button>
            )}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <section className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Channels ({detail?.channels.length ?? 0})</h3>
            <button
              onClick={() => setAddChannelOpen(true)}
              className="text-sm flex items-center gap-1 px-2 py-1 rounded bg-brand-500 text-white hover:bg-brand-600"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          <ul className="space-y-1.5">
            {detail?.channels.map((c) => (
              <li
                key={c.channel_id}
                className="flex items-center gap-2 p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {c.thumbnail_url ? (
                  <img
                    src={c.thumbnail_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover bg-zinc-200 dark:bg-zinc-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{c.title || c.channel_id}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {c.handle || c.channel_id}
                    {c.last_status && c.last_status >= 400 && (
                      <span className="ml-2 text-red-500">
                        HTTP {c.last_status} {c.last_error}
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={youtubeChannelUrl(c.channel_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  title="Open on YouTube"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => refresh.mutate(c.channel_id)}
                  className="p-1.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  title="Refresh now"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => detach.mutate(c.channel_id)}
                  className="p-1.5 rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
                  title="Remove from interest"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {detail?.channels.length === 0 && (
              <li className="text-sm text-zinc-400 px-2 py-3">
                No channels yet. Click Add and paste a channel URL or @handle.
              </li>
            )}
          </ul>
        </section>

        <section className="p-5">
          <FilterEditor interestId={interestId} filters={detail?.filters ?? []} />
        </section>
      </div>

      <AddChannelModal
        open={addChannelOpen}
        interestId={interestId}
        onClose={() => setAddChannelOpen(false)}
      />
    </div>
  );
}

function FilterEditor({ interestId, filters }: { interestId: number; filters: Filter[] }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<FilterKind>("title_exclude");
  const [pattern, setPattern] = useState("");
  const [error, setError] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["interest", interestId] });
    qc.invalidateQueries({ queryKey: ["videos"] });
  };

  const create = useMutation({
    mutationFn: () => api.createFilter(interestId, { kind, pattern, enabled: true }),
    onSuccess: () => {
      setPattern("");
      setError("");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });
  const toggle = useMutation({
    mutationFn: (f: Filter) =>
      api.updateFilter(interestId, f.id, { enabled: !f.enabled }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteFilter(interestId, id),
    onSuccess: invalidate,
  });

  const needsPattern = FILTER_LABELS[kind].needsPattern;

  return (
    <>
      <h3 className="font-medium mb-3">Filters ({filters.length})</h3>
      <ul className="space-y-1.5 mb-4">
        {filters.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 p-2 rounded bg-zinc-50 dark:bg-zinc-800"
          >
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={() => toggle.mutate(f)}
              className="accent-brand-500"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500">{FILTER_LABELS[f.kind].label}</div>
              <div className="text-sm font-mono truncate">
                {f.pattern || <span className="text-zinc-400">(no pattern)</span>}
              </div>
            </div>
            <button
              onClick={() => remove.mutate(f.id)}
              className="p-1.5 rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {filters.length === 0 && (
          <li className="text-sm text-zinc-400 px-2 py-2">No filters — videos pass through unchanged.</li>
        )}
      </ul>

      <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as FilterKind)}
          className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 text-sm"
        >
          {Object.entries(FILTER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {needsPattern && (
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={FILTER_LABELS[kind].placeholder}
            className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-900 text-sm font-mono"
          />
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={() => create.mutate()}
          disabled={needsPattern && !pattern.trim()}
          className="w-full px-3 py-1.5 rounded bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:opacity-50"
        >
          Add filter
        </button>
      </div>
    </>
  );
}
