"use client";

import { useT } from "@/components/i18n-provider";
import { LessonVideoPlayer } from "@/components/lessons/lesson-video-player";
import { HomeworkMediaView } from "@/components/lessons/homework-media-view";
import { attachedHomeworkMedia, type HomeworkMediaSource } from "@/lib/homework-media";

export function HomeworkMedia({ lessonId, source, state }: {
  lessonId: string;
  source: HomeworkMediaSource;
  state: Record<string, string>;
}) {
  const { t } = useT();
  const attached = attachedHomeworkMedia(state, source);
  if (!attached.video && !attached.transcript) return null;
  return (
    <HomeworkMediaView source={source} attached={attached}
      labels={{ video: t.lessonUnits.secVideo, transcript: t.lessonUnits.secTranscript, playbackHint: t.interactiveHomework.mediaPlaybackHint }}
      video={attached.video ? <LessonVideoPlayer lessonId={lessonId} url={source.videoUrl} title={source.videoTitle ?? null} teacher={false} independent /> : null} />
  );
}
