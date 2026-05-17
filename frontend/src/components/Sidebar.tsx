import { Inbox, Plus, Settings2, Tv } from "lucide-react";
import type { Interest } from "../types";

interface Props {
  interests: Interest[];
  selectedId: number | "all" | null;
  onSelect: (id: number | "all") => void;
  onNewInterest: () => void;
  onManage: (id: number) => void;
}

export function Sidebar({ interests, selectedId, onSelect, onNewInterest, onManage }: Props) {
  const totalUnwatched = interests.reduce((acc, i) => acc + i.unwatched_count, 0);

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <Tv size={20} className="text-brand-500" />
        <span className="font-semibold">crbox-tube</span>
      </div>

      <button
        onClick={() => onSelect("all")}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm w-full text-left ${
          selectedId === "all"
            ? "bg-brand-500/10 text-brand-700 dark:text-brand-200 font-medium"
            : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
        }`}
      >
        <Inbox size={16} />
        <span className="flex-1">All</span>
        {totalUnwatched > 0 && (
          <span className="text-xs text-zinc-500">{totalUnwatched}</span>
        )}
      </button>

      <div className="flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wider text-zinc-500">
        <span>Interests</span>
        <button
          onClick={onNewInterest}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
          title="New interest"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {interests.map((i) => (
          <div
            key={i.id}
            className={`group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer ${
              selectedId === i.id
                ? "bg-brand-500/10 text-brand-700 dark:text-brand-200 font-medium"
                : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
            }`}
            onClick={() => onSelect(i.id)}
          >
            <span className="w-5 text-center">{i.icon || "•"}</span>
            <span className="flex-1 truncate">{i.name}</span>
            {i.unwatched_count > 0 && (
              <span className="text-xs text-zinc-500">{i.unwatched_count}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManage(i.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
              title="Manage interest"
            >
              <Settings2 size={14} />
            </button>
          </div>
        ))}
        {interests.length === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-400">
            No interests yet. Click + to add one.
          </p>
        )}
      </div>
    </aside>
  );
}
