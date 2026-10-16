import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { studentLearningTranslations, users } from "@/lib/db/schema";
import { translateLearningSegments } from "@/lib/material-translation";
import { applyLearningTranslations, collectLearningTranslations, learningLanguage, validLearningTranslation, type LearningLanguage, type LearningSegment } from "@/lib/learning-language-content";
import { learningRegularOverrides } from "@/lib/learning-language-regular";

export async function studentLearningLanguage(studentId: string): Promise<LearningLanguage | null> {
  const [student] = await db.select({ language: users.learningLanguage }).from(users)
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT"))).limit(1);
  return learningLanguage(student?.language);
}
export function learningSegmentId(studentId: string, language: LearningLanguage, segment: LearningSegment) {
  return createHash("sha256").update(JSON.stringify([studentId, language, segment.text, segment.source ?? null, segment.context])).digest("hex");
}
const pending = new Map<string, Promise<string[]>>();

/** No stale full-object caching: only translated strings are shared between the student's views. */
export async function resolveLearningSegments(studentId: string, language: LearningLanguage, segments: LearningSegment[]): Promise<string[]> {
  if (!segments.length) return [];
  const keys = segments.map(segment => learningSegmentId(studentId, language, segment));
  const unique = new Map(keys.map((key, index) => [key, segments[index]]));
  const translated = new Map<string, string>();
  const invalidCached = new Map<string, string>();
  const ids = [...unique.keys()];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const rows = await db.select({ id: studentLearningTranslations.id, text: studentLearningTranslations.translation })
      .from(studentLearningTranslations).where(and(eq(studentLearningTranslations.studentId, studentId), eq(studentLearningTranslations.language, language), inArray(studentLearningTranslations.id, ids.slice(offset, offset + 500))));
    rows.forEach(row => {
      if (validLearningTranslation(unique.get(row.id)!, row.text)) translated.set(row.id, row.text);
      else invalidCached.set(row.id, row.text);
    });
  }
  const missing = ids.filter(id => !translated.has(id));
  if (missing.length) {
    const requestKey = studentId + ":" + language + ":" + missing.join(",");
    let request = pending.get(requestKey);
    if (!request) {
      request = (async () => {
        const values = await translateLearningSegments(missing.map(id => unique.get(id)!), language);
        if (values.length !== missing.length || values.some((text, index) => !validLearningTranslation(unique.get(missing[index])!, text))) {
          throw new Error("Перевод не завершён: английское слово не может заменять готовый перевод.");
        }
        for (let offset = 0; offset < missing.length; offset += 500) {
          await db.insert(studentLearningTranslations).values(missing.slice(offset, offset + 500).map((id, index) => ({ id, studentId, language, translation: values[offset + index] }))).onConflictDoNothing();
        }
        // Repair only the exact stale machine-generated cache value we read.
        // A concurrent valid replacement and all learner answers remain intact.
        for (const [index, id] of missing.entries()) if (invalidCached.has(id)) {
          await db.update(studentLearningTranslations).set({ translation: values[index] }).where(and(
            eq(studentLearningTranslations.id, id), eq(studentLearningTranslations.studentId, studentId),
            eq(studentLearningTranslations.language, language), eq(studentLearningTranslations.translation, invalidCached.get(id)!),
          ));
        }
        return values;
      })();
      pending.set(requestKey, request);
    }
    try { (await request).forEach((text, index) => translated.set(missing[index], text)); }
    finally { pending.delete(requestKey); }
  }
  return keys.map(key => translated.get(key)!);
}

/** Call only after the existing resource ownership/grant checks. */
export async function personalizeLearningContent<T>(studentId: string, value: T, language?: LearningLanguage | null): Promise<T> {
  const target = language === undefined ? await studentLearningLanguage(studentId) : language;
  if (!target) return value;
  const plan = collectLearningTranslations(value, target);
  const translated = await resolveLearningSegments(studentId, target, plan.segments);
  return applyLearningTranslations(value, target, plan, translated);
}

/** Instruction overrides live beside answers, but answers themselves must remain byte-for-byte intact. */
export async function personalizeAssignedLearningContent<T>(studentId: string, lesson: T, answers: Record<string, string>) {
  const language = await studentLearningLanguage(studentId);
  if (!language) return { lesson, answers };
  const sections = (lesson as { regularSections?: unknown })?.regularSections;
  const overrides = learningRegularOverrides(sections, answers);
  const translated = await personalizeLearningContent(studentId, { lesson, overrides }, language);
  const state = { ...answers };
  for (const [key, override] of Object.entries(translated.overrides)) state[key] = JSON.stringify(override);
  return { lesson: translated.lesson, answers: state };
}
