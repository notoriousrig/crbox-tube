import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../api";
import type { Channel } from "../types";

interface Props {
  open: boolean;
  interestId: number;
  onClose: () => void;
}

export function AddChannelModal({ open, interestId, onClose }: Props) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [lastAdded, setLastAdded] = useState<Channel | null>(null);

  const add = useMutation({
    mutationFn: () => api.addChannel(input.trim(), interestId),
    onSuccess: (ch) => {
      setLastAdded(ch);
      setInput("");
      setError("");
      qc.invalidateQueries({ queryKey: ["interest", interestId] });
      qc.invalidateQueries({ queryKey: ["interests"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-modal max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Add channel</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-3">
          Paste a channel URL, @handle, video URL, or raw channel ID.
        </p>
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) add.mutate();
          }}
          placeholder="@veritasium  /  youtube.com/@veritasium  /  UC..."
          className="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        {lastAdded && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            Added <strong>{lastAdded.title || lastAdded.channel_id}</strong>. Add another?
          </p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            onClick={() => add.mutate()}
            disabled={!input.trim() || add.isPending}
            className="px-4 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {add.isPending ? "Resolving…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
