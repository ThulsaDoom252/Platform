/** Shared default for newly configured countdowns; existing saved values stay intact. */
export const DEFAULT_TIMER_SECONDS = 120;

/** Missing settings get the default. An explicitly empty field or zero stays zero. */
export function normalizeTimerSeconds(value: unknown, maximum = 86_400): number {
  const seconds = value === undefined ? DEFAULT_TIMER_SECONDS : Number(value);
  return Number.isFinite(seconds)
    ? Math.min(maximum, Math.max(0, Math.round(seconds)))
    : Math.min(maximum, DEFAULT_TIMER_SECONDS);
}

/** Nullable revision timers keep an explicit Off setting, rather than enabling it. */
export function normalizeOptionalTimerSeconds(value: unknown, maximum = 86_400): number | null {
  return value === null ? null : normalizeTimerSeconds(value, maximum);
}

export type TimerInputDraft = { value: number; text: string };

export function editTimerInput(text: string): TimerInputDraft {
  const parsed = Number(text);
  return { text, value: Number.isFinite(parsed) ? parsed : 0 };
}

/** A parent's acknowledgement of zero must not overwrite the user's blank draft. */
export function syncTimerInput(draft: TimerInputDraft, value: number): TimerInputDraft {
  return draft.value === value ? draft : { value, text: String(value) };
}
