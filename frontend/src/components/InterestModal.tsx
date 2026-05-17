import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../api";
import type { Interest } from "../types";

interface Props {
  open: boolean;
  existing: Interest | null;
  onClose: () => void;
}

export function InterestModal({ open, existing, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setDescription(existing?.description ?? "");
      setIcon(existing?.icon ?? "");
      setError("");
    }
  }, [open, existing]);

  const create = useMutation({
    mutationFn: () =>
      api.createInterest({ name, description, icon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interests"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const update = useMutation({
    mutationFn: () =>
      api.updateInterest(existing!.id, { name, description, icon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interests"] });
      qc.invalidateQueries({ queryKey: ["interest", existing!.id] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteInterest(existing!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interests"] });
      onClose();
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
          <h2 className="text-lg font-semibold">
            {existing ? "Edit interest" : "New interest"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Woodworking"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Icon (emoji)</span>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="🪚"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="mt-5 flex items-center gap-2">
          {existing && (
            <button
              onClick={() => {
                if (confirm(`Delete "${existing.name}"? Channels are kept but unbucketed.`)) {
                  remove.mutate();
                }
              }}
              className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => (existing ? update.mutate() : create.mutate())}
            disabled={!name.trim()}
            className="ml-auto px-4 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {existing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
