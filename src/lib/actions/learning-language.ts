"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { studentLearningTranslationJobs, studentLearningTranslations, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { learningLanguage, type LearningLanguage } from "@/lib/learning-language-content";
import { learningLanguageInventory } from "@/lib/student-learning-language-inventory";
import { learningSegmentId, resolveLearningSegments } from "@/lib/student-learning-language";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";

export type LearningLanguageProgress = { language: LearningLanguage | null; token: string | null; total: number; completed: number; status: "IDLE" | "RUNNING" | "DONE" | "ERROR"; error?: string; waiting?: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function permittedStudent(studentId: string) {
  const session = await getSession();
  if (!session || !uuid.test(studentId) || (session.role !== "TEACHER" && (session.role !== "STUDENT" || session.userId !== studentId))) throw new Error("Нет доступа к профилю ученика");
  const [student] = await db.select({ id: users.id, language: users.learningLanguage }).from(users).where(and(eq(users.id, studentId), eq(users.role, "STUDENT"))).limit(1);
  if (!student) throw new Error("Ученик не найден");
  return student;
}
const progress = (job: typeof studentLearningTranslationJobs.$inferSelect): LearningLanguageProgress => ({ language: job.language, token: job.token, total: job.total, completed: job.cursor, status: job.status === "DONE" ? "DONE" : job.status === "ERROR" ? "ERROR" : "RUNNING", ...(job.error ? { error: job.error } : {}) });
function refresh(studentId: string) {
  revalidatePath("/student", "layout"); revalidatePath("/teacher", "layout");
  revalidatePath(`/teacher/students/${studentId}`);
}
async function publish(studentId: string) {
  await Promise.all([publishUserRealtime(studentId, "learning-language"), publishClassRealtime(studentId, "lesson"), publishClassRealtime(studentId, "vocabulary"), publishClassRealtime(studentId, "learning-language")]);
}
async function untranslated(studentId: string, language: LearningLanguage) {
  const segments = await learningLanguageInventory(studentId, language);
  const ids = segments.map(segment => learningSegmentId(studentId, language, segment));
  const cached = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const rows = await db.select({ id: studentLearningTranslations.id }).from(studentLearningTranslations).where(and(eq(studentLearningTranslations.studentId, studentId), eq(studentLearningTranslations.language, language), inArray(studentLearningTranslations.id, ids.slice(offset, offset + 500))));
    rows.forEach(row => cached.add(row.id));
  }
  return segments.filter((_, index) => !cached.has(ids[index]));
}
export async function learningLanguageProgressAction(studentId: string): Promise<LearningLanguageProgress> {
  const student = await permittedStudent(studentId);
  const [job] = await db.select().from(studentLearningTranslationJobs).where(eq(studentLearningTranslationJobs.studentId, studentId)).limit(1);
  return job && (job.status !== "DONE" || job.language === student.language) ? progress(job) : { language: student.language, token: null, total: 0, completed: 0, status: "IDLE" };
}

export async function saveLearningLanguageAction(_previous: LearningLanguageProgress, formData: FormData): Promise<LearningLanguageProgress> {
  const studentId = String(formData.get("studentId") ?? "");
  let current: LearningLanguage | null = null;
  try {
    const student = await permittedStudent(studentId); current = student.language;
    const language = learningLanguage(formData.get("learningLanguage"));
    if (!language) throw new Error("Выберите Russian или Ukrainian");
    const missing = await untranslated(studentId, language);
    if (missing.length && !(process.env.DEEPL_AUTH_KEY ?? process.env.DEEPL_KEY)?.trim()) throw new Error("DeepL не настроен. Язык обучения пока не изменён.");
    const token = randomUUID();
    const job = { studentId, token, language, segments: missing, cursor: 0, total: missing.length, status: missing.length ? "RUNNING" : "DONE", processingUntil: null, error: null, updatedAt: new Date() };
    await db.transaction(async tx => {
      if (!missing.length) await tx.update(users).set({ learningLanguage: language, updatedAt: new Date() }).where(and(eq(users.id, studentId), eq(users.role, "STUDENT")));
      await tx.insert(studentLearningTranslationJobs).values(job).onConflictDoUpdate({ target: studentLearningTranslationJobs.studentId, set: job });
    });
    refresh(studentId); if (!missing.length) await publish(studentId).catch(() => {});
    return progress(job);
  } catch (error) {
    return { language: current, token: null, total: 0, completed: 0, status: "ERROR", error: error instanceof Error ? error.message : "Не удалось изменить язык обучения" };
  }
}

/** Small resumable requests, with a lease so two open profiles do not pay for the same batch. */
export async function processLearningLanguageBatchAction(studentId: string, token: string): Promise<LearningLanguageProgress> {
  await permittedStudent(studentId);
  if (!uuid.test(token)) throw new Error("Неверное задание перевода");
  const [existing] = await db.select().from(studentLearningTranslationJobs).where(and(eq(studentLearningTranslationJobs.studentId, studentId), eq(studentLearningTranslationJobs.token, token))).limit(1);
  if (!existing) return learningLanguageProgressAction(studentId);
  if (existing.status === "DONE") return progress(existing);
  const now = new Date();
  const [claimed] = await db.update(studentLearningTranslationJobs).set({ processingUntil: new Date(now.getTime() + 120_000), status: "RUNNING", error: null }).where(and(eq(studentLearningTranslationJobs.studentId, studentId), eq(studentLearningTranslationJobs.token, token), eq(studentLearningTranslationJobs.cursor, existing.cursor), or(isNull(studentLearningTranslationJobs.processingUntil), lt(studentLearningTranslationJobs.processingUntil, now)))).returning();
  if (!claimed) return { ...progress(existing), waiting: true };
  try {
    const batch = claimed.segments.slice(claimed.cursor, claimed.cursor + 25);
    await resolveLearningSegments(studentId, claimed.language, batch);
    const cursor = claimed.cursor + batch.length;
    const reachedEnd = cursor >= claimed.total;
    // Content added while the profile was translating is included before the new language goes live.
    const delta = reachedEnd ? await untranslated(studentId, claimed.language) : [];
    const done = reachedEnd && delta.length === 0;
    const saved = await db.transaction(async tx => {
      const [updated] = await tx.update(studentLearningTranslationJobs).set({ cursor, total: claimed.total + delta.length, status: done ? "DONE" : "RUNNING", ...(done ? { segments: [] } : delta.length ? { segments: [...claimed.segments, ...delta] } : {}), processingUntil: null, error: null, updatedAt: new Date() }).where(and(eq(studentLearningTranslationJobs.studentId, studentId), eq(studentLearningTranslationJobs.token, token), eq(studentLearningTranslationJobs.cursor, claimed.cursor))).returning();
      if (updated && done) await tx.update(users).set({ learningLanguage: claimed.language, updatedAt: new Date() }).where(and(eq(users.id, studentId), eq(users.role, "STUDENT")));
      return updated;
    });
    if (!saved) return learningLanguageProgressAction(studentId);
    if (done) { refresh(studentId); await publish(studentId).catch(() => {}); }
    return progress(saved);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Не удалось перевести содержимое";
    const [saved] = await db.update(studentLearningTranslationJobs).set({ status: "ERROR", error: detail, processingUntil: null, updatedAt: new Date() }).where(and(eq(studentLearningTranslationJobs.studentId, studentId), eq(studentLearningTranslationJobs.token, token))).returning();
    return saved ? progress(saved) : learningLanguageProgressAction(studentId);
  }
}
