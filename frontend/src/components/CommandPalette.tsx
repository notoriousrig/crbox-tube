import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Tv } from "lucide-react";
import type { Interest, Video } from "../types";

interface Props {
  interests: Interest[];
  videos: Video[];
  onClose: () => void;
  onPickInterest: (id: number) => void;
  onPickVideo: (v: Video) => void;
}

interface Hit {
  kind: "interest" | "video";
  label: string;
  sublabel: string;
  data: Interest | Video;
}

export function CommandPalette({
  interests, videos, onClose, onPickInterest, onPickVideo,
}: Props) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits: Hit[] = useMemo(() => {
    const lower = q.trim().toLowerCase();
    const out: Hit[] = [];
    for (const i of interests) {
      if (!lower || i.name.toLowerCase().includes(lower)) {
        out.push({
          kind: "interest", data: i,
          label: i.name,
          sublabel: `${i.channel_count} channels · ${i.unwatched_count} unwatched`,
        });
      }
    }
    if (lower) {
      for (const v of videos) {
        if (
          v.title.toLowerCase().includes(lower) ||
          v.channel_title.toLowerCase().includes(lower)
        ) {
          out.push({
            kind: "video", data: v,
            label: v.title,
            sublabel: v.channel_title,
          });
          if (out.length > 50) break;
        }
      }
    }
    return out;
  }, [q, interests, videos]);

  useEffect(() => {
    setCursor(0);
  }, [q]);

  function commit(h: Hit) {
    if (h.kind === "interest") onPickInterest((h.data as Interest).id);
    else onPickVideo(h.data as Video);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-24" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-modal w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const h = hits[cursor];
              if (h) commit(h);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Jump to interest or search videos…"
          className="w-full px-4 py-3 bg-transparent outline-none text-base border-b border-zinc-200 dark:border-zinc-800"
        />
        <ul className="max-h-96 overflow-y-auto scrollbar-thin">
          {hits.map((h, i) => (
            <li
              key={`${h.kind}:${h.kind === "interest" ? (h.data as Interest).id : (h.data as Video).video_id}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => commit(h)}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                cursor === i ? "bg-brand-500/10" : ""
              }`}
            >
              {h.kind === "interest" ? <Hash size={16} className="text-zinc-400" /> : <Tv size={16} className="text-zinc-400" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{h.label}</div>
                <div className="text-xs text-zinc-500 truncate">{h.sublabel}</div>
              </div>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-zinc-400">No matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
