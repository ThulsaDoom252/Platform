/** Состояние общего видеоплеера для одной пары учитель ↔ ученик. */
export type ClassVideoState = {
  assignmentId: string;
  currentTime: number;
  playing: boolean;
  captions: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  /** Когда учитель зафиксировал это состояние. */
  at: string;
  /** Отдельная команда перевести ученика именно в секцию Video. */
  focusAt?: string;
};

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
