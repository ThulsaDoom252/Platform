export const CLASS_TIMER_THEMES = ["violet", "ocean", "mint", "sunset"] as const;
export const CLASS_TIMER_TICK_SOUNDS = ["soft", "wood", "digital", "pulse"] as const;
export const CLASS_TIMER_END_SOUNDS = ["bell", "success", "gong", "sparkle"] as const;

export type ClassTimerTheme = (typeof CLASS_TIMER_THEMES)[number];
export type ClassTimerTickSound = (typeof CLASS_TIMER_TICK_SOUNDS)[number];
export type ClassTimerEndSound = (typeof CLASS_TIMER_END_SOUNDS)[number];
export type ClassTimerStatus = "READY" | "RUNNING" | "PAUSED" | "FINISHED";

export type ClassTimerPreset = {
  id: string;
  name: string;
  topic: string;
  durationSeconds: number;
  theme: ClassTimerTheme;
  tickSound: ClassTimerTickSound;
  endSound: ClassTimerEndSound;
  tickSoundEnabled: boolean;
  endSoundEnabled: boolean;
  startVoiceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Snapshot shared by the teacher and the selected student. */
export type ClassTimerState = Omit<ClassTimerPreset, "createdAt" | "updatedAt"> & {
  status: ClassTimerStatus;
  remainingMs: number;
  endsAt: string | null;
  visible: boolean;
  startedSignalAt: string | null;
  updatedAt: string;
};

const oneOf = <T extends readonly string[]>(values: T, value: unknown, fallback: T[number]) =>
  values.includes(value as T[number]) ? (value as T[number]) : fallback;

export function normalizeClassTimerState(value: unknown): ClassTimerState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const durationSeconds = Math.max(5, Math.min(86_400, Number(raw.durationSeconds) || 300));
  const suppliedRemaining = Number(raw.remainingMs);
  const remainingMs = Number.isFinite(suppliedRemaining)
    ? Math.max(0, Math.min(durationSeconds * 1000, suppliedRemaining))
    : durationSeconds * 1000;
  const status = oneOf(
    ["READY", "RUNNING", "PAUSED", "FINISHED"] as const,
    raw.status,
    "READY",
  );
  return {
    id: String(raw.id ?? "").slice(0, 80),
    name: String(raw.name ?? "Timer").slice(0, 120),
    topic: String(raw.topic ?? "").slice(0, 240),
    durationSeconds,
    theme: oneOf(CLASS_TIMER_THEMES, raw.theme, "violet"),
    tickSound: oneOf(CLASS_TIMER_TICK_SOUNDS, raw.tickSound, "soft"),
    endSound: oneOf(CLASS_TIMER_END_SOUNDS, raw.endSound, "bell"),
    tickSoundEnabled: raw.tickSoundEnabled === true,
    endSoundEnabled: raw.endSoundEnabled !== false,
    startVoiceEnabled: raw.startVoiceEnabled !== false,
    status,
    remainingMs,
    endsAt: typeof raw.endsAt === "string" ? raw.endsAt : null,
    visible: raw.visible === true,
    startedSignalAt: typeof raw.startedSignalAt === "string" ? raw.startedSignalAt : null,
    updatedAt:
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
  };
}

export function classTimerRemainingMs(state: ClassTimerState, now = Date.now()) {
  if (state.status !== "RUNNING" || !state.endsAt) return state.remainingMs;
  const end = Date.parse(state.endsAt);
  return Number.isFinite(end) ? Math.max(0, end - now) : state.remainingMs;
}

export function liveClassTimerState(value: unknown, now = Date.now()) {
  const state = normalizeClassTimerState(value);
  if (!state) return null;
  const remainingMs = classTimerRemainingMs(state, now);
  return remainingMs === 0 && state.status === "RUNNING"
    ? { ...state, status: "FINISHED" as const, remainingMs: 0, endsAt: null }
    : { ...state, remainingMs };
}
