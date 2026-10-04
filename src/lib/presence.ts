/** Единое определение присутствия для Class и остальных экранов. */
export const ONLINE_WINDOW_MS = 75_000;

export type Presence = "online" | "offline";

export function presenceFromLastSeen(
  seen: Date | string | null | undefined,
  now = Date.now(),
): Presence {
  if (!seen) return "offline";
  const time = seen instanceof Date ? seen.getTime() : new Date(seen).getTime();
  return Number.isFinite(time) && now - time < ONLINE_WINDOW_MS ? "online" : "offline";
}

