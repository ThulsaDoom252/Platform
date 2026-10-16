import { REVISION_MODES, modeReady, readShow, wordsFor, type RevisionMode, type RevisionWord } from "./revision-modes";
import type { LessonWord } from "./lesson-unit";
import { normalizeOptionalTimerSeconds } from "./timer-settings";

export type LessonRevisionSnapshot = {
  version: 1; requestId: string; unitId: string; assignmentId: string | null; words: RevisionWord[];
};
export type LessonRevisionSettings = {
  title: string; phraseIds: string[]; modes: string[]; modeWords: Record<string, string[]>;
  show: Record<string, boolean>; answerSeconds: number | null; totalSeconds: number | null; dueAt: string | null;
};
export function lessonRevisionWords(words: LessonWord[]): RevisionWord[] {
  const seen = new Set<string>();
  return words.slice(0, 600).filter(word => {
    if (!word.id || !word.word.trim() || seen.has(word.id)) return false;
    seen.add(word.id); return true;
  })
    .map(word => ({ phraseId: word.id, word: word.word, icon: word.icon, translation: word.translation, description: word.description, imageUrl: word.imageUrl }));
}
/** Null means an older materials-based revision; a malformed snapshot must not fall back to unrelated material IDs. */
export function revisionSnapshotWords(snapshot: LessonRevisionSnapshot, ids: string[]): RevisionWord[] {
  if (snapshot?.version !== 1 || !Array.isArray(snapshot.words)) throw new Error("Повреждён список слов игры");
  const allowed = new Set(ids);
  return snapshot.words.filter(word => word && typeof word.phraseId === "string" && typeof word.word === "string" && allowed.has(word.phraseId));
}
/** Never accept words, translations, images or foreign word IDs from the browser. */
export function prepareLessonRevision(words: RevisionWord[], input: LessonRevisionSettings) {
  const title = typeof input?.title === "string" ? input.title.trim().slice(0, 120) : "";
  if (!title) throw new Error("Дай игре название");
  if (!Array.isArray(input?.phraseIds) || input.phraseIds.length > 600) throw new Error("Выбери слова из этого словаря");
  const phraseIds = [...new Set(input.phraseIds)];
  const available = new Map(words.map(word => [word.phraseId, word]));
  if (!phraseIds.length || phraseIds.some(id => typeof id !== "string" || !available.has(id))) throw new Error("Список слов изменился. Открой настройки заново.");
  if (!Array.isArray(input?.modes) || !input.modes.length || input.modes.some(mode => !REVISION_MODES.includes(mode as RevisionMode))) throw new Error("Выбери доступные режимы игры");
  const modes = [...new Set(input.modes)] as RevisionMode[];
  const chosen = words.filter(word => phraseIds.includes(word.phraseId));
  const modeWords: Record<string, string[]> = {};
  const union = new Set<string>();
  for (const mode of modes) {
    const specified = input.modeWords?.[mode];
    if (specified !== undefined && (!Array.isArray(specified) || specified.some(id => !phraseIds.includes(id)))) throw new Error("Режим содержит слова из другого списка");
    const own = wordsFor(chosen, mode).filter(word => specified === undefined || specified.includes(word.phraseId));
    if (!modeReady(own, mode)) throw new Error("Для выбранного режима не хватает подходящих слов");
    modeWords[mode] = own.map(word => word.phraseId);
    own.forEach(word => union.add(word.phraseId));
  }
  if (!modes.some(mode => mode !== "flashcards")) throw new Error("Добавь хотя бы один проверочный режим к карточкам");
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (due && !Number.isFinite(due.getTime())) throw new Error("Некорректный срок сдачи");
  return {
    title, modes, phraseIds: [...union], modeWords, show: { ...readShow(input.show) },
    answerSeconds: normalizeOptionalTimerSeconds(input.answerSeconds, 3600),
    totalSeconds: normalizeOptionalTimerSeconds(input.totalSeconds, 10_800), dueAt: due,
    words: chosen.filter(word => union.has(word.phraseId)),
  };
}
