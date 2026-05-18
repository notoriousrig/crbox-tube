import { useEffect, useState } from "react";

export type ViewMode = "comfortable" | "compact" | "list";

const STORAGE_KEY = "crbox-tube:viewmode";
const ORDER: ViewMode[] = ["comfortable", "compact", "list"];

function detectInitial(): ViewMode {
  if (typeof window === "undefined") return "comfortable";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "comfortable" || stored === "compact" || stored === "list") return stored;
  return "comfortable";
}

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(detectInitial);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const cycle = () => {
    setMode((m) => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]);
  };

  return { mode, setMode, cycle };
}
