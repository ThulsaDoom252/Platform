import { planWords, type RevisionSection } from "./revision-build";
import type { RevisionWord } from "./revision-modes";

export type RevisionStrugglingWord = { phraseId: string; word: string };

/** The frozen attempt, not a subsequently edited vocabulary, is authoritative. */
export function uniqueRevisionWords(plan: RevisionSection[]): RevisionWord[] {
  const seen = new Set<string>();
  return planWords(plan).flatMap(({ word }) => {
    if (seen.has(word.phraseId)) return [];
    seen.add(word.phraseId);
    return [word];
  });
}

/** Reject forged words; only IDs present in this attempt may be selected. */
export function validateRevisionStrugglingIds(plan: RevisionSection[], value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 5_000) return null;
  const allowed = new Set(uniqueRevisionWords(plan).map((word) => word.phraseId));
  if (value.some((id) => typeof id !== "string" || !allowed.has(id))) return null;
  return [...new Set(value as string[])];
}

export function revisionStrugglingWords(plan: RevisionSection[], stored: unknown): RevisionStrugglingWord[] {
  const selected = new Set(validateRevisionStrugglingIds(plan, stored) ?? []);
  return uniqueRevisionWords(plan)
    .filter((word) => selected.has(word.phraseId))
    .map(({ phraseId, word }) => ({ phraseId, word }));
}
