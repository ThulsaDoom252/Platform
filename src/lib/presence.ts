/** Единое определение присутствия для Class и остальных экранов. */
export const ONLINE_WINDOW_MS = 75_000;

export type Presence = "online" | "offline";
export type ClassPresence = Presence | "in_class";

export type SchoolPresenceMember = { clientId?: string; data?: unknown };

/** A class tab counts as online everywhere else; any connected tab keeps its owner online. */
export function platformPresence(presence: ClassPresence): Presence {
  return presence === "offline" ? "offline" : "online";
}

export function schoolPresenceMap(members: SchoolPresenceMember[]): Record<string, ClassPresence> {
  const result: Record<string, ClassPresence> = {};
  for (const member of members) {
    if (!member.clientId) continue;
    const data = member.data && typeof member.data === "object" ? member.data as Record<string, unknown> : null;
    if (data?.inClass === true) result[member.clientId] = "in_class";
    else if (result[member.clientId] !== "in_class") result[member.clientId] = "online";
  }
  return result;
}

export function classPresenceFromLastSeen(
  seen: Date | string | null | undefined,
  where: string | null | undefined,
  now = Date.now(),
): ClassPresence {
  const presence = presenceFromLastSeen(seen, now);
  return presence === "online" && (where === "class" || where === "board") ? "in_class" : presence;
}

export function presenceFromLastSeen(
  seen: Date | string | null | undefined,
  now = Date.now(),
): Presence {
  if (!seen) return "offline";
  const time = seen instanceof Date ? seen.getTime() : new Date(seen).getTime();
  return Number.isFinite(time) && now - time < ONLINE_WINDOW_MS ? "online" : "offline";
}
