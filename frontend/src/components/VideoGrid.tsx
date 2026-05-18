import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Video, VideoStateView } from "../types";
import type { ViewMode } from "../hooks/useViewMode";
import { VideoCard } from "./VideoCard";

interface Props {
  interestId: number | null;
  state: VideoStateView;
  mode: ViewMode;
}

const GRID_CLASS: Record<ViewMode, string> = {
  comfortable: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4",
  compact: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-3",
  list: "flex flex-col gap-2 max-w-3xl mx-auto",
};

export function VideoGrid({ interestId, state, mode }: Props) {
  const qc = useQueryClient();
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["videos", interestId, state],
    queryFn: () => api.listVideos({ interest_id: interestId, state, limit: 200 }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["videos"] });
    qc.invalidateQueries({ queryKey: ["interests"] });
  };

  const click = useMutation({
    mutationFn: (v: Video) => api.clickVideo(v.video_id),
    onSuccess: invalidateAll,
  });
  const watched = useMutation({
    mutationFn: (args: { v: Video; w: boolean }) =>
      api.setVideoState(args.v.video_id, { watched: args.w }),
    onSuccess: invalidateAll,
  });
  const hidden = useMutation({
    mutationFn: (args: { v: Video; h: boolean }) =>
      api.setVideoState(args.v.video_id, { hidden: args.h }),
    onSuccess: invalidateAll,
  });
  const saved = useMutation({
    mutationFn: (args: { v: Video; s: boolean }) =>
      api.setVideoState(args.v.video_id, { saved: args.s }),
    onSuccess: invalidateAll,
  });

  if (isLoading) {
    return <div className="text-center py-16 text-zinc-400">Loading…</div>;
  }
  if (videos.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400">
        <p className="text-lg mb-1">Nothing here.</p>
        <p className="text-sm">
          {state === "unwatched"
            ? "Add channels to this interest, or trigger a refresh."
            : `No ${state} videos.`}
        </p>
      </div>
    );
  }

  return (
    <div className={GRID_CLASS[mode]}>
      {videos.map((v) => (
        <VideoCard
          key={v.video_id}
          video={v}
          mode={mode}
          onClickThrough={(vv) => click.mutate(vv)}
          onMarkWatched={(vv, w) => watched.mutate({ v: vv, w })}
          onMarkHidden={(vv, h) => hidden.mutate({ v: vv, h })}
          onMarkSaved={(vv, s) => saved.mutate({ v: vv, s })}
        />
      ))}
    </div>
  );
}
