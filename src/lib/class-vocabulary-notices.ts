export type ClassVocabularyNoticeWord = {
  id: string;
  english: string;
  translation: string;
  createdAt: string;
};

/** Each visit to one student's class has its own silent history baseline.
 * Recent-word snapshots can backfill old IDs after a deletion, so unseen IDs
 * alone do not mean that a word was just added.
 */
export function createClassVocabularyNoticeTracker(studentId: string) {
  const seen = new Set<string>();
  let historyReady = false;
  let historyBoundary = 0;
  return {
    studentId,
    receive(ownerId: string | null, words: ClassVocabularyNoticeWord[]) {
      if (ownerId !== studentId) return null;
      const fresh = historyReady ? words.filter((word) =>
        !seen.has(word.id) && Number.isFinite(Date.parse(word.createdAt)) &&
        Date.parse(word.createdAt) > historyBoundary,
      ) : [];
      if (!historyReady) {
        historyBoundary = Math.max(0, ...words.map((word) => Date.parse(word.createdAt)).filter(Number.isFinite));
        historyReady = true;
      }
      words.forEach((word) => seen.add(word.id));
      // The server's recent list is newest first; do not replay a burst of history.
      return fresh[0] ?? null;
    },
    added(word: Pick<ClassVocabularyNoticeWord, "id">) {
      if (seen.has(word.id)) return false;
      seen.add(word.id);
      return true;
    },
  };
}
