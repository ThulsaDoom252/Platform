/** Small, durable navigation commands; reading a command never acknowledges it. */
export const CLASS_SUMMONS_TTL_MS = 120_000;

export type ClassSummonsCommand = {
  id: string;
  requestedAt: string;
  expiresAt: string;
};

export type StoredClassSummons = ClassSummonsCommand & { teacherId: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClassSummonsId(value: unknown): value is string {
  return typeof value === "string" && (uuid.test(value) ||
    (value.startsWith("legacy:") && value.length <= 80 && Number.isFinite(Date.parse(value.slice(7)))));
}

/** A legacy timestamp is supported during rolling deployment and twister focus. */
export function pendingClassSummons(
  focus: { enterClassCommand?: unknown; enterClassAt?: unknown } | null | undefined,
  now = Date.now(),
): (ClassSummonsCommand & { teacherId: string | null }) | null {
  if (!focus) return null;
  const raw = focus.enterClassCommand;
  if (raw !== undefined) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const command = raw as Partial<StoredClassSummons>;
    if (typeof command.id !== "string" || !uuid.test(command.id) ||
      typeof command.teacherId !== "string" || !uuid.test(command.teacherId) ||
      typeof command.requestedAt !== "string" || typeof command.expiresAt !== "string") return null;
    const requested = Date.parse(command.requestedAt);
    const expires = Date.parse(command.expiresAt);
    if (!Number.isFinite(requested) || !Number.isFinite(expires) ||
      requested > now + 5_000 || expires <= now || expires <= requested ||
      expires - requested > CLASS_SUMMONS_TTL_MS) return null;
    return { id: command.id, teacherId: command.teacherId,
      requestedAt: command.requestedAt, expiresAt: command.expiresAt };
  }
  if (typeof focus.enterClassAt !== "string") return null;
  const requested = Date.parse(focus.enterClassAt);
  if (!Number.isFinite(requested) || requested > now + 5_000 || now - requested >= CLASS_SUMMONS_TTL_MS) return null;
  return { id: `legacy:${focus.enterClassAt}`, teacherId: null,
    requestedAt: focus.enterClassAt, expiresAt: new Date(requested + CLASS_SUMMONS_TTL_MS).toISOString() };
}
