export const CLASS_REACTION_KINDS = [
  "great",
  "thumbs-up",
  "confused",
  "dont-understand",
  "angry",
] as const;

export type ClassReactionKind = (typeof CLASS_REACTION_KINDS)[number];

export const CLASS_REACTION_MODES = ["emerge", "float"] as const;

export type ClassReactionMode = (typeof CLASS_REACTION_MODES)[number];

export type ClassReaction = {
  id: string;
  kind: ClassReactionKind;
  mode: ClassReactionMode;
  sound: boolean;
  sentAt: string;
};

export const CLASS_REACTION_MAX_AGE_MS = 20_000;

export function isClassReactionKind(value: unknown): value is ClassReactionKind {
  return CLASS_REACTION_KINDS.includes(value as ClassReactionKind);
}

export function isClassReactionMode(value: unknown): value is ClassReactionMode {
  return CLASS_REACTION_MODES.includes(value as ClassReactionMode);
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
    mode: isClassReactionMode(raw.mode) ? raw.mode : "emerge",
    sound: raw.sound === true,
    sentAt: raw.sentAt,
  };
}

export function normalizeClassReactions(value: unknown, now = Date.now()): ClassReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((reaction) => normalizeClassReaction(reaction, now))
    .filter((reaction): reaction is ClassReaction => reaction !== null)
    .slice(-100);
}
