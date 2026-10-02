/** Состояние общего видеоплеера для одной пары учитель ↔ ученик. */
export type ClassVideoState = {
  assignmentId: string;
  currentTime: number;
  playing: boolean;
  captions: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  /** YouTube captions default to English; local files simply ignore this field. */
  captionLanguage: string;
  /** Requested YouTube quality. The API may fall back when a level is unavailable. */
  quality: string;
  /** Когда учитель зафиксировал это состояние. */
  at: string;
  /** Отдельная команда перевести ученика именно в секцию Video. */
  focusAt?: string;
};

export type ParsedLessonVideoSource =
  | { kind: "youtube"; src: string; videoId: string }
  | { kind: "file" | "link"; src: string };

const VIDEO_FILE = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i;

/** Resolve every supported YouTube shape or an uploaded/local video file. */
export function parseLessonVideoSource(url: string): ParsedLessonVideoSource | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      if (videoId) return { kind: "youtube", src: raw, videoId };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const videoId = parsed.searchParams.get("v") || (
        ["embed", "shorts", "live"].includes(pathParts[0] ?? "") ? pathParts[1] : ""
      );
      if (videoId) return { kind: "youtube", src: raw, videoId };
    }
    if (VIDEO_FILE.test(parsed.pathname)) return { kind: "file", src: raw };
    return { kind: "link", src: raw };
  } catch {
    return VIDEO_FILE.test(raw) ? { kind: "file", src: raw } : { kind: "link", src: raw };
  }
}

const finite = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function normalizeClassVideoState(value: unknown): ClassVideoState | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const assignmentId = typeof item.assignmentId === "string" ? item.assignmentId : "";
  const at = typeof item.at === "string" ? item.at : "";
  if (!assignmentId || !at || Number.isNaN(Date.parse(at))) return null;

  return {
    assignmentId,
    currentTime: Math.max(0, Math.min(86_400, finite(item.currentTime, 0))),
    playing: item.playing === true,
    captions: item.captions !== false,
    muted: item.muted === true,
    volume: Math.max(0, Math.min(1, finite(item.volume, 1))),
    playbackRate: Math.max(0.25, Math.min(4, finite(item.playbackRate, 1))),
    captionLanguage: typeof item.captionLanguage === "string"
      ? item.captionLanguage.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "en"
      : "en",
    quality: typeof item.quality === "string"
      ? item.quality.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "auto"
      : "auto",
    at,
    ...(typeof item.focusAt === "string" && !Number.isNaN(Date.parse(item.focusAt))
      ? { focusAt: item.focusAt }
      : {}),
  };
}

/** Текущая позиция с учётом времени, прошедшего после команды Play. */
export function expectedClassVideoTime(
  state: ClassVideoState,
  now = Date.now(),
): number {
  if (!state.playing) return state.currentTime;
  const elapsed = Math.max(0, now - Date.parse(state.at)) / 1_000;
  return state.currentTime + elapsed * state.playbackRate;
}
