import type { QueuedGame } from "./actions/guess-picture";
import type { ClassWordDeckActivity } from "./actions/word-deck";
import type { RevisionCard } from "./actions/revision";
import type { ClassActivityMeta } from "./class-game-meta";

export type ClassActivitySections = {
  queue: QueuedGame[];
  decks: ClassWordDeckActivity[];
  revisions: RevisionCard[];
  meta: ClassActivityMeta;
};

export type ClassActivityLoad = Partial<ClassActivitySections> & {
  studentId: string;
  failed: (keyof ClassActivitySections)[];
};

/** A failed section is absent, never an authoritative empty list. */
export async function loadClassActivitySections(
  studentId: string,
  loaders: { [K in keyof ClassActivitySections]: () => Promise<ClassActivitySections[K]> },
): Promise<ClassActivityLoad> {
  const [queue, decks, revisions, meta] = await Promise.allSettled([
    Promise.resolve().then(loaders.queue),
    Promise.resolve().then(loaders.decks),
    Promise.resolve().then(loaders.revisions),
    Promise.resolve().then(loaders.meta),
  ]);
  const result: ClassActivityLoad = { studentId, failed: [] };
  if (queue.status === "fulfilled") result.queue = queue.value;
  else result.failed.push("queue");
  if (decks.status === "fulfilled") result.decks = decks.value;
  else result.failed.push("decks");
  if (revisions.status === "fulfilled") result.revisions = revisions.value;
  else result.failed.push("revisions");
  if (meta.status === "fulfilled") result.meta = meta.value;
  else result.failed.push("meta");
  return result;
}
