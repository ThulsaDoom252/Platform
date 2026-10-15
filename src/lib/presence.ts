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
  const active = new Map<string, { visible: boolean; at: number; inClass: boolean }>();
  for (const member of members) {
    if (!member.clientId) continue;
    const data = member.data && typeof member.data === "object" ? member.data as Record<string, unknown> : null;
    if (typeof data?.visible === "boolean" && typeof data.activeAt === "number" && Number.isFinite(data.activeAt)) {
      const previous = active.get(member.clientId);
      if (!previous || (data.visible && !previous.visible) ||
        (data.visible === previous.visible && data.activeAt >= previous.at)) {
        active.set(member.clientId, { visible: data.visible, at: data.activeAt, inClass: data.inClass === true });
      }
    }
    if (data?.inClass === true) result[member.clientId] = "in_class";
    else if (result[member.clientId] !== "in_class") result[member.clientId] = "online";
  }
  // Prefer the section on the active tab; an old hidden class tab must not
  // keep saying "in class" after the student starts working elsewhere.
  for (const [id, location] of active) result[id] = location.inClass ? "in_class" : "online";
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
