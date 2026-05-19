import type {
  Channel,
  ContentFilter,
  Filter,
  ImportResult,
  Interest,
  InterestDetail,
  RefreshResult,
  SortMode,
  TimeWindow,
  Video,
  VideoStateView,
} from "./types";

const BASE = "/api";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? ((await res.json()) as T)
    : ((await res.text()) as unknown as T);
}

export const api = {
  me: () => req<{ email: string }>("/me"),

  listInterests: () => req<Interest[]>("/interests"),
  getInterest: (id: number) => req<InterestDetail>(`/interests/${id}`),
  createInterest: (data: Partial<Interest>) =>
    req<Interest>("/interests", { method: "POST", body: JSON.stringify(data) }),
  updateInterest: (id: number, data: Partial<Interest>) =>
    req<Interest>(`/interests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInterest: (id: number) =>
    req<void>(`/interests/${id}`, { method: "DELETE" }),
  reorderInterests: (items: { id: number; sort_order: number }[]) =>
    req<void>("/interests/reorder", { method: "POST", body: JSON.stringify({ items }) }),

  listChannels: () => req<Channel[]>("/channels"),
  addChannel: (input: string, interest_id: number | null) =>
    req<Channel>("/channels", {
      method: "POST",
      body: JSON.stringify({ input, interest_id }),
    }),
  attachChannel: (channel_id: string, interest_id: number) =>
    req<void>("/channels/attach", {
      method: "POST",
      body: JSON.stringify({ channel_id, interest_id }),
    }),
  detachChannel: (channel_id: string, interest_id: number) =>
    req<void>("/channels/detach", {
      method: "POST",
      body: JSON.stringify({ channel_id, interest_id }),
    }),
  deleteChannel: (channel_id: string) =>
    req<void>(`/channels/${channel_id}`, { method: "DELETE" }),
  refreshChannel: (channel_id: string) =>
    req<Channel>(`/channels/${channel_id}/refresh`, { method: "POST" }),
  refreshAll: () => req<RefreshResult>("/channels/refresh", { method: "POST" }),

  listFilters: (interest_id: number) =>
    req<Filter[]>(`/interests/${interest_id}/filters`),
  createFilter: (interest_id: number, data: Partial<Filter>) =>
    req<Filter>(`/interests/${interest_id}/filters`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFilter: (interest_id: number, id: number, data: Partial<Filter>) =>
    req<Filter>(`/interests/${interest_id}/filters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteFilter: (interest_id: number, id: number) =>
    req<void>(`/interests/${interest_id}/filters/${id}`, { method: "DELETE" }),

  listVideos: (params: {
    interest_id?: number | null;
    state?: VideoStateView;
    time_window?: TimeWindow;
    content?: ContentFilter;
    sort?: SortMode;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.interest_id != null) q.set("interest_id", String(params.interest_id));
    if (params.state) q.set("state", params.state);
    if (params.time_window) q.set("time_window", params.time_window);
    if (params.content) q.set("content", params.content);
    if (params.sort) q.set("sort", params.sort);
    if (params.limit) q.set("limit", String(params.limit));
    return req<Video[]>(`/videos?${q.toString()}`);
  },
  setVideoState: (
    video_id: string,
    data: { watched?: boolean; hidden?: boolean; saved?: boolean },
  ) =>
    req<Video>(`/videos/${video_id}/state`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  clickVideo: (video_id: string) =>
    req<Video>(`/videos/${video_id}/click`, { method: "POST" }),

  importTakeout: async (
    file: File,
    interest_id: number | null,
  ): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    if (interest_id != null) form.append("interest_id", String(interest_id));
    const res = await fetch(`${BASE}/import/takeout`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} — ${t}`);
    }
    return (await res.json()) as ImportResult;
  },

  getSettings: () => req<Record<string, string>>("/settings"),
  setSetting: (key: string, value: string) =>
    req<{ key: string; value: string }>(`/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
