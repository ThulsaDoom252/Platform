export const CLASS_REACTION_KINDS = [
  "great",
  "thumbs-up",
  "confused",
  "dont-understand",
  "angry",
] as const;

export type ClassReactionKind = (typeof CLASS_REACTION_KINDS)[number];

export type ClassReaction = {
  id: string;
  kind: ClassReactionKind;
  sound: boolean;
  sentAt: string;
};

export const CLASS_REACTION_MAX_AGE_MS = 20_000;

export function isClassReactionKind(value: unknown): value is ClassReactionKind {
  return CLASS_REACTION_KINDS.includes(value as ClassReactionKind);
}

export function normalizeClassReaction(
  value: unknown,
  now = Date.now(),
): ClassReaction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ClassReaction>;
  if (
    typeof raw.id !== "string" ||
    raw.id.length < 8 ||
    raw.id.length > 100 ||
    !isClassReactionKind(raw.kind) ||
    typeof raw.sentAt !== "string"
  ) {
    return null;
  }

  const sentAt = Date.parse(raw.sentAt);
  if (
    !Number.isFinite(sentAt) ||
    sentAt > now + 5_000 ||
    now - sentAt > CLASS_REACTION_MAX_AGE_MS
  ) {
    return null;
  }

  return {
    id: raw.id,
    kind: raw.kind,
    sound: raw.sound === true,
    sentAt: raw.sentAt,
  };
}
