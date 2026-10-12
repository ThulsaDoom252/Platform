import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityGames, classLessonNotes, classVocabularyWords, lessonAssignments, lessonUnits, lessonWords, materialPhrases, vocabularyWords, wordDeckActivities, wordRevisionAttempts, wordRevisions } from "@/lib/db/schema";
import { getOwnedTree, getStudentLibrary } from "@/lib/materials";
import { collectLearningTranslations, type LearningLanguage, type LearningSegment } from "@/lib/learning-language-content";
import { homeworkPlanForAssignment, interactiveHomeworkFromEntries } from "@/lib/lesson-homework";
import { normalizeRegularLessonSections } from "@/lib/regular-lesson";
import { learningRegularOverrides } from "@/lib/learning-language-regular";
import { IRREGULAR_VERBS_BASE } from "@/lib/irregular-verbs-base";
import { learningSegmentId } from "@/lib/student-learning-language";

/** Reads only one student's granted/copied content; never scans somebody else's personal tree. */
export async function learningLanguageInventory(studentId: string, language: LearningLanguage): Promise<LearningSegment[]> {
  const [materials, mistakes, assignments, games, classWords, personalWords, notes, revisionAttempts, revisions] = await Promise.all([
    getStudentLibrary(studentId, false), getOwnedTree("MISTAKE", studentId, false),
    db.select({ assignment: lessonAssignments, unit: lessonUnits }).from(lessonAssignments).innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId)).where(eq(lessonAssignments.studentId, studentId)),
    db.select().from(activityGames).where(eq(activityGames.studentId, studentId)),
    db.select().from(classVocabularyWords).where(eq(classVocabularyWords.studentId, studentId)),
    db.select().from(vocabularyWords).where(eq(vocabularyWords.studentId, studentId)),
    db.select().from(classLessonNotes).where(eq(classLessonNotes.studentId, studentId)),
    db.select({ plan: wordRevisionAttempts.plan }).from(wordRevisionAttempts).innerJoin(wordRevisions, eq(wordRevisions.id, wordRevisionAttempts.revisionId)).where(eq(wordRevisions.studentId, studentId)),
    db.select({ phraseIds: wordRevisions.phraseIds }).from(wordRevisions).where(eq(wordRevisions.studentId, studentId)),
  ]);
  const unitIds = [...new Set(assignments.map(row => row.unit.id))];
  const words = unitIds.length ? await db.select().from(lessonWords).where(inArray(lessonWords.unitId, unitIds)) : [];
  const activityIds = [...new Set(assignments.flatMap(row => {
    const override = row.assignment.contentOverride;
    return Array.isArray(override?.activityIds) ? override.activityIds.map(String) : row.unit.activityIds ?? [];
  }))];
  const activities = activityIds.length ? await db.select().from(wordDeckActivities).where(inArray(wordDeckActivities.id, activityIds)) : [];
  const phraseIds = [...new Set(revisions.flatMap(revision => revision.phraseIds ?? []))];
  const revisionWords = phraseIds.length ? await db.select().from(materialPhrases).where(inArray(materialPhrases.id, phraseIds)) : [];
  const payloads: unknown[] = [materials, mistakes, games.map(game => ({ cards: game.wordDeck?.cards ?? game.cards })), classWords, personalWords, notes.filter(note => note.kind === "SPELLING"), revisionAttempts, revisionWords, { translationLang: "RU", verbs: IRREGULAR_VERBS_BASE }];
  for (const { assignment, unit } of assignments) {
    const draft = assignment.contentOverride;
    const sections = normalizeRegularLessonSections(draft?.regularSections ?? unit.sections);
    const overrides = learningRegularOverrides(sections, assignment.answers ?? {});
    const basePlan = draft ? (draft.interactiveHomework as Parameters<typeof homeworkPlanForAssignment>[0]) : interactiveHomeworkFromEntries(unit.homework);
    const plan = homeworkPlanForAssignment(basePlan, assignment.answers ?? {});
    const linkedIds = Array.isArray(draft?.activityIds) ? draft.activityIds.map(String) : unit.activityIds ?? [];
    payloads.push({ words: draft?.words ?? words.filter(word => word.unitId === unit.id), lexis: draft?.lexis ?? unit.lexis, regularSections: sections, regularOverrides: overrides, interactiveHomework: plan, activities: activities.filter(activity => linkedIds.includes(activity.id)).map(activity => ({ cards: activity.cards })) });
  }
  const unique = new Map<string, LearningSegment>();
  for (const payload of payloads) for (const segment of collectLearningTranslations(payload, language).segments) unique.set(learningSegmentId(studentId, language, segment), segment);
  return [...unique.values()];
}
