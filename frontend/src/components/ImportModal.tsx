import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { api } from "../api";
import type { ImportResult } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const importMut = useMutation({
    mutationFn: (file: File) => api.importTakeout(file, null),
    onSuccess: (r) => {
      setResult(r);
      setError("");
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
          <h2 className="text-lg font-semibold">Import Takeout subscriptions</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Upload <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">subscriptions.csv</code> from
          Google Takeout. All channels are dropped into a new <strong>Unsorted</strong> interest you can re-bucket in
          the sidebar.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importMut.mutate(f);
          }}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importMut.isPending}
          className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-brand-500 flex items-center justify-center gap-2 text-sm"
        >
          <Upload size={16} />
          {importMut.isPending ? "Importing…" : "Choose subscriptions.csv"}
        </button>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        {result && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">
            <p className="font-medium mb-1">Imported.</p>
            <p>
              {result.channels_added} added, {result.channels_skipped} already present.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 text-xs text-red-500 list-disc pl-5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
