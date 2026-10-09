import type { TranscriptLine } from "./lesson-unit";

/** Teacher-owned preferences only; the lesson already supplies the media. */
export const HOMEWORK_MEDIA_KEY = "hw:media";
export type HomeworkMediaSelection = { video: boolean; transcript: boolean };
export type HomeworkMediaSource = {
  videoUrl: string | null;
  videoTitle?: string | null;
  transcript: TranscriptLine[];
};

export function isHomeworkMediaSelection(value: unknown): value is HomeworkMediaSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.video === "boolean" && typeof item.transcript === "boolean";
}

export function homeworkMediaAvailability(source: unknown): HomeworkMediaSelection {
  const item = source && typeof source === "object" ? source as Record<string, unknown> : {};
  return {
    video: typeof item.videoUrl === "string" && Boolean(item.videoUrl.trim()),
    transcript: Array.isArray(item.transcript) && item.transcript.some(
      (line) => line && typeof line.text === "string" && Boolean(line.text.trim()),
    ),
  };
}

export function storedHomeworkMedia(state: Record<string, string>): HomeworkMediaSelection | null {
  try {
    const value: unknown = JSON.parse(state[HOMEWORK_MEDIA_KEY] ?? "null");
    return isHomeworkMediaSelection(value) ? { video: value.video, transcript: value.transcript } : null;
  } catch { return null; }
}

/** New assignments opt in to available media; explicit teacher choices survive reassignment. */
export function homeworkMediaSelection(
  state: Record<string, string>,
  available: HomeworkMediaSelection,
  requested?: HomeworkMediaSelection,
): HomeworkMediaSelection {
  const choice = requested ?? storedHomeworkMedia(state) ?? available;
  return { video: available.video && choice.video, transcript: available.transcript && choice.transcript };
}

/** Existing homework does not acquire materials until the teacher assigns them. */
export function attachedHomeworkMedia(state: Record<string, string>, source: HomeworkMediaSource): HomeworkMediaSelection {
  if (!state["hw:assigned-at"] || state["hw:removed-at"]) return { video: false, transcript: false };
  return homeworkMediaSelection(state, homeworkMediaAvailability(source), storedHomeworkMedia(state) ?? { video: false, transcript: false });
}

/** Merge teacher preferences without replacing the answer currently being typed in class. */
export function mergeHomeworkMedia(state: Record<string, string>, incoming: Record<string, string>) {
  const next = { ...state };
  for (const key of [HOMEWORK_MEDIA_KEY, "hw:assigned-at", "hw:removed-at"]) {
    if (key in incoming) next[key] = incoming[key];
    else delete next[key];
  }
  return next;
}
