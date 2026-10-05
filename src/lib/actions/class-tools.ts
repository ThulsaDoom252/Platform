"use server";

import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  classLessonNotes,
  classStudentTimers,
  classTimerPresets,
  classVocabularyWords,
  lessons,
  users,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { scheduleNow } from "@/lib/schedule-time";
import {
  CLASS_TIMER_END_SOUNDS,
  CLASS_TIMER_THEMES,
  CLASS_TIMER_TICK_SOUNDS,
  classTimerRemainingMs,
  liveClassTimerState,
  normalizeClassTimerState,
  type ClassTimerEndSound,
  type ClassTimerPreset,
  type ClassTimerState,
  type ClassTimerTheme,
  type ClassTimerTickSound,
} from "@/lib/class-timer";
import { enrichSpellingMistake, type SpellingExample, type SpellingPartOfSpeech } from "@/lib/spelling-mistake";
import { CLASS_GAME_GRADES, type ClassGameGrade } from "@/lib/class-game-meta";
import { isClassReactionKind, type ClassReactionKind } from "@/lib/class-reaction";

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Teacher access required");
  return session;
}

async function teacherWithStudent() {
  const session = await requireTeacher();
  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return { session, studentId: teacher?.studentId ?? null };
}

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  values.includes(value as T[number]);

export type SaveClassTimerPresetInput = {
  id?: string;
  name: string;
  topic: string;
  durationSeconds: number;
  theme: ClassTimerTheme;
  tickSound: ClassTimerTickSound;
  endSound: ClassTimerEndSound;
  tickSoundEnabled: boolean;
  endSoundEnabled: boolean;
  startVoiceEnabled: boolean;
};

function timerPresetValues(input: SaveClassTimerPresetInput) {
  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) return null;
  return {
    name,
    topic: String(input.topic ?? "").trim().slice(0, 240),
    durationSeconds: Math.max(5, Math.min(86_400, Math.round(Number(input.durationSeconds) || 300))),
    theme: isOneOf(CLASS_TIMER_THEMES, input.theme) ? input.theme : "violet",
    tickSound: isOneOf(CLASS_TIMER_TICK_SOUNDS, input.tickSound) ? input.tickSound : "soft",
    endSound: isOneOf(CLASS_TIMER_END_SOUNDS, input.endSound) ? input.endSound : "bell",
    tickSoundEnabled: input.tickSoundEnabled === true,
    endSoundEnabled: input.endSoundEnabled !== false,
    startVoiceEnabled: input.startVoiceEnabled !== false,
  };
}

type TimerRow =
  | typeof classTimerPresets.$inferSelect
  | typeof classStudentTimers.$inferSelect;

const timerCard = (row: TimerRow): ClassTimerPreset => ({
  id: row.id,
  name: row.name,
  topic: row.topic,
  durationSeconds: row.durationSeconds,
  theme: isOneOf(CLASS_TIMER_THEMES, row.theme) ? row.theme : "violet",
  tickSound: isOneOf(CLASS_TIMER_TICK_SOUNDS, row.tickSound) ? row.tickSound : "soft",
  endSound: isOneOf(CLASS_TIMER_END_SOUNDS, row.endSound) ? row.endSound : "bell",
  tickSoundEnabled: row.tickSoundEnabled,
  endSoundEnabled: row.endSoundEnabled,
  startVoiceEnabled: row.startVoiceEnabled,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function listClassTimerPresetsAction(): Promise<ClassTimerPreset[]> {
  const session = await requireTeacher();
  const rows = await db
    .select()
    .from(classTimerPresets)
    .where(eq(classTimerPresets.teacherId, session.userId))
    .orderBy(desc(classTimerPresets.updatedAt));
  return rows.map(timerCard);
}

export async function listClassStudentTimersAction(): Promise<ClassTimerPreset[]> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return [];
  const rows = await db
    .select()
    .from(classStudentTimers)
    .where(
      and(
        eq(classStudentTimers.teacherId, session.userId),
        eq(classStudentTimers.studentId, studentId),
      ),
    )
    .orderBy(desc(classStudentTimers.updatedAt));
  return rows.map(timerCard);
}

export async function saveClassTimerPresetAction(
  input: SaveClassTimerPresetInput,
): Promise<{ preset?: ClassTimerPreset; error?: string }> {
  const session = await requireTeacher();
  const values = timerPresetValues(input);
  if (!values) return { error: "Enter a timer name" };

  if (input.id) {
    const [row] = await db
      .update(classTimerPresets)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(classTimerPresets.id, String(input.id)),
          eq(classTimerPresets.teacherId, session.userId),
        ),
      )
      .returning();
    return row ? { preset: timerCard(row) } : { error: "Timer not found" };
  }

  const [row] = await db
    .insert(classTimerPresets)
    .values({ teacherId: session.userId, ...values })
    .returning();
  return { preset: timerCard(row) };
}

export async function saveClassStudentTimerAction(
  input: SaveClassTimerPresetInput,
  saveAsPreset = false,
): Promise<{ timer?: ClassTimerPreset; preset?: ClassTimerPreset; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const values = timerPresetValues(input);
  if (!values) return { error: "Enter a timer name" };

  if (input.id) {
    const [row] = await db
      .update(classStudentTimers)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(classStudentTimers.id, String(input.id)),
          eq(classStudentTimers.teacherId, session.userId),
          eq(classStudentTimers.studentId, studentId),
        ),
      )
      .returning();
    return row ? { timer: timerCard(row) } : { error: "Timer not found" };
  }

  return db.transaction(async (tx) => {
    const [timerRow] = await tx
      .insert(classStudentTimers)
      .values({ teacherId: session.userId, studentId, ...values })
      .returning();
    const [presetRow] = saveAsPreset
      ? await tx
        .insert(classTimerPresets)
        .values({ teacherId: session.userId, ...values })
        .returning()
      : [];
    return {
      timer: timerCard(timerRow),
      ...(presetRow ? { preset: timerCard(presetRow) } : {}),
    };
  });
}

export async function deleteClassStudentTimerAction(
  timerId: string,
): Promise<{ error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const [row] = await db
    .delete(classStudentTimers)
    .where(
      and(
        eq(classStudentTimers.id, String(timerId)),
        eq(classStudentTimers.teacherId, session.userId),
        eq(classStudentTimers.studentId, studentId),
      ),
    )
    .returning({ id: classStudentTimers.id });
  return row ? {} : { error: "Timer not found" };
}

export async function deleteClassTimerPresetAction(
  presetId: string,
): Promise<{ error?: string }> {
  const session = await requireTeacher();
  const [row] = await db
    .delete(classTimerPresets)
    .where(
      and(
        eq(classTimerPresets.id, String(presetId)),
        eq(classTimerPresets.teacherId, session.userId),
      ),
    )
    .returning({ id: classTimerPresets.id });
  return row ? {} : { error: "Timer not found" };
}

async function studentFocus(studentId: string) {
  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .limit(1);
  return student?.classFocus ?? null;
}

export async function sendClassReactionAction(
  kind: ClassReactionKind,
  sound = false,
): Promise<{ error?: string }> {
  const { studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  if (!isClassReactionKind(kind)) return { error: "Unknown reaction" };

  const reaction = {
    id: crypto.randomUUID(),
    kind,
    sound: sound === true,
    sentAt: new Date().toISOString(),
  };
  await db
    .update(users)
    .set({
      classFocus: sql`jsonb_set(coalesce(${users.classFocus}, '{}'::jsonb), '{reaction}', ${JSON.stringify(reaction)}::jsonb, true)`,
    })
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")));
  return {};
}

async function storeTimerState(studentId: string, timerState: ClassTimerState | null) {
  const focus = (await studentFocus(studentId)) ?? {};
  const next = { ...focus };
  if (timerState) next.timerState = timerState;
  else delete next.timerState;
  await db.update(users).set({ classFocus: next }).where(eq(users.id, studentId));
}

export async function prepareClassTimerAction(
  timerId: string,
  source: "student" | "preset" = "preset",
): Promise<{ state?: ClassTimerState; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const [timer] = source === "student"
    ? await db
      .select()
      .from(classStudentTimers)
      .where(
        and(
          eq(classStudentTimers.id, String(timerId)),
          eq(classStudentTimers.teacherId, session.userId),
          eq(classStudentTimers.studentId, studentId),
        ),
      )
      .limit(1)
    : await db
      .select()
      .from(classTimerPresets)
      .where(
        and(
          eq(classTimerPresets.id, String(timerId)),
          eq(classTimerPresets.teacherId, session.userId),
        ),
      )
      .limit(1);
  if (!timer) return { error: "Timer not found" };

  const now = new Date().toISOString();
  const state: ClassTimerState = {
    ...timerCard(timer),
    status: "READY",
    remainingMs: timer.durationSeconds * 1000,
    endsAt: null,
    visible: false,
    startedSignalAt: null,
    rating: null,
    updatedAt: now,
  };
  await storeTimerState(studentId, state);
  return { state };
}

export type ActiveClassTimerPatch = Partial<Pick<
  ClassTimerState,
  | "topic"
  | "theme"
  | "tickSound"
  | "endSound"
  | "tickSoundEnabled"
  | "endSoundEnabled"
  | "startVoiceEnabled"
>>;

export async function updateActiveClassTimerAction(
  patch: ActiveClassTimerPatch,
): Promise<{ state?: ClassTimerState; error?: string }> {
  const { studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const focus = await studentFocus(studentId);
  const current = normalizeClassTimerState(focus?.timerState);
  if (!current) return { error: "Open a timer first" };

  const next: ClassTimerState = {
    ...current,
    ...(current.status !== "RUNNING" && typeof patch.topic === "string"
      ? { topic: patch.topic.trim().slice(0, 240) }
      : {}),
    ...(current.status !== "RUNNING" && isOneOf(CLASS_TIMER_THEMES, patch.theme)
      ? { theme: patch.theme }
      : {}),
    ...(isOneOf(CLASS_TIMER_TICK_SOUNDS, patch.tickSound)
      ? { tickSound: patch.tickSound }
      : {}),
    ...(isOneOf(CLASS_TIMER_END_SOUNDS, patch.endSound)
      ? { endSound: patch.endSound }
      : {}),
    ...(typeof patch.tickSoundEnabled === "boolean"
      ? { tickSoundEnabled: patch.tickSoundEnabled }
      : {}),
    ...(typeof patch.endSoundEnabled === "boolean"
      ? { endSoundEnabled: patch.endSoundEnabled }
      : {}),
    ...(typeof patch.startVoiceEnabled === "boolean"
      ? { startVoiceEnabled: patch.startVoiceEnabled }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  await storeTimerState(studentId, next);
  return { state: next };
}

export async function setClassTimerVisibleAction(
  visible: boolean,
): Promise<{ state?: ClassTimerState; error?: string }> {
  const { studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const focus = await studentFocus(studentId);
  const current = liveClassTimerState(focus?.timerState);
  if (!current) return { error: "Open a timer first" };
  const state = { ...current, visible, updatedAt: new Date().toISOString() };
  await storeTimerState(studentId, state);
  return { state };
}

export async function controlClassTimerAction(
  command: "START" | "PAUSE" | "RESET" | "CLOSE",
): Promise<{ state?: ClassTimerState | null; error?: string }> {
  const { studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const focus = await studentFocus(studentId);
  const current = liveClassTimerState(focus?.timerState);
  if (!current) return { error: "Open a timer first" };

  if (command === "CLOSE") {
    await storeTimerState(studentId, null);
    return { state: null };
  }

  const now = Date.now();
  let state: ClassTimerState;
  if (command === "START") {
    const remainingMs = current.remainingMs > 0
      ? current.remainingMs
      : current.durationSeconds * 1000;
    const signal = new Date(now).toISOString();
    state = {
      ...current,
      status: "RUNNING",
      remainingMs,
      endsAt: new Date(now + remainingMs).toISOString(),
      startedSignalAt: signal,
      rating: current.status === "FINISHED" || current.remainingMs === 0 ? null : current.rating,
      updatedAt: signal,
    };
  } else if (command === "PAUSE") {
    const updatedAt = new Date(now).toISOString();
    state = {
      ...current,
      status: "PAUSED",
      remainingMs: classTimerRemainingMs(current, now),
      endsAt: null,
      updatedAt,
    };
  } else {
    const updatedAt = new Date(now).toISOString();
    state = {
      ...current,
      status: "READY",
      remainingMs: current.durationSeconds * 1000,
      endsAt: null,
      startedSignalAt: null,
      rating: null,
      updatedAt,
    };
  }
  await storeTimerState(studentId, state);
  return { state };
}

/** Save an overall rating for the completed timer run. */
export async function saveClassTimerRatingAction(
  grade: ClassGameGrade,
  visible: boolean,
): Promise<{ state?: ClassTimerState; error?: string }> {
  const { studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  if (!CLASS_GAME_GRADES.includes(grade)) return { error: "Choose a rating" };
  const focus = await studentFocus(studentId);
  const current = liveClassTimerState(focus?.timerState);
  if (!current) return { error: "Open a timer first" };
  if (current.status !== "FINISHED" && classTimerRemainingMs(current) > 0) {
    return { error: "The timer has not finished yet" };
  }
  const state: ClassTimerState = {
    ...current,
    status: "FINISHED",
    remainingMs: 0,
    endsAt: null,
    rating: {
      grade,
      visible: visible === true,
      at: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  await storeTimerState(studentId, state);
  return { state };
}

export type ClassLessonNote = {
  id: string;
  kind: "NOTE" | "SPELLING";
  body: string;
  translation: string | null;
  translationLang: "RU" | "UK";
  partOfSpeech: SpellingPartOfSpeech | null;
  icon: string | null;
  examples: SpellingExample[];
  publishedAt: string | null;
  lessonId: string | null;
  lessonDay: string;
  createdAt: string;
  updatedAt: string;
};

const noteCard = (row: typeof classLessonNotes.$inferSelect): ClassLessonNote => ({
  id: row.id,
  kind: row.kind === "SPELLING" ? "SPELLING" : "NOTE",
  body: row.body,
  translation: row.translation,
  translationLang: row.translationLang,
  partOfSpeech:
    row.partOfSpeech === "NOUN" ||
    row.partOfSpeech === "ADJECTIVE" ||
    row.partOfSpeech === "VERB" ||
    row.partOfSpeech === "PHRASE"
      ? row.partOfSpeech
      : null,
  icon: row.icon,
  examples: (row.examples ?? []) as SpellingExample[],
  publishedAt: row.publishedAt?.toISOString() ?? null,
  lessonId: row.lessonId,
  lessonDay: row.lessonDay.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function listClassLessonNotesAction(): Promise<ClassLessonNote[]> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return [];
  const rows = await db
    .select()
    .from(classLessonNotes)
    .where(
      and(
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
      ),
    )
    .orderBy(desc(classLessonNotes.lessonDay), asc(classLessonNotes.createdAt));
  return rows.map(noteCard);
}

async function currentLessonContext(studentId: string) {
  const day = scheduleNow();
  day.setUTCHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setUTCDate(end.getUTCDate() + 1);
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.studentId, studentId),
        gte(lessons.startTime, day),
        lt(lessons.startTime, end),
      ),
    )
    .orderBy(asc(lessons.startTime))
    .limit(1);
  return { lessonId: lesson?.id ?? null, lessonDay: day };
}

export async function createClassLessonNoteAction(
  text: string,
  kind: "NOTE" | "SPELLING" = "NOTE",
): Promise<{ note?: ClassLessonNote; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const body = String(text ?? "").trim().slice(0, 4_000);
  if (!body) return { error: "Write a note" };
  const context = await currentLessonContext(studentId);
  let spelling: Awaited<ReturnType<typeof enrichSpellingMistake>> | null = null;
  if (kind === "SPELLING") {
    const [latestWord] = await db
      .select({ translationLang: classVocabularyWords.translationLang })
      .from(classVocabularyWords)
      .where(eq(classVocabularyWords.studentId, studentId))
      .orderBy(desc(classVocabularyWords.updatedAt))
      .limit(1);
    try {
      spelling = await enrichSpellingMistake(body, latestWord?.translationLang ?? "RU");
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not prepare the spelling card",
      };
    }
  }
  const [row] = await db
    .insert(classLessonNotes)
    .values({
      teacherId: session.userId,
      studentId,
      ...context,
      kind,
      body: spelling?.english ?? body,
      translation: spelling?.translation,
      translationLang: spelling?.translationLang,
      partOfSpeech: spelling?.partOfSpeech,
      icon: spelling?.icon,
      examples: spelling?.examples ?? [],
    })
    .returning();
  return { note: noteCard(row) };
}

export async function updateClassLessonNoteAction(
  noteId: string,
  text: string,
): Promise<{ note?: ClassLessonNote; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const body = String(text ?? "").trim().slice(0, 4_000);
  if (!body) return { error: "Write a note" };
  const [existing] = await db
    .select()
    .from(classLessonNotes)
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
      ),
    )
    .limit(1);
  if (!existing) return { error: "Note not found" };
  let spelling: Awaited<ReturnType<typeof enrichSpellingMistake>> | null = null;
  if (existing.kind === "SPELLING" && existing.body !== body) {
    try {
      spelling = await enrichSpellingMistake(body, existing.translationLang);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not prepare the spelling card",
      };
    }
  }
  const [row] = await db
    .update(classLessonNotes)
    .set({
      body: spelling?.english ?? body,
      ...(spelling
        ? {
            translation: spelling.translation,
            translationLang: spelling.translationLang,
            partOfSpeech: spelling.partOfSpeech,
            icon: spelling.icon,
            examples: spelling.examples,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
      ),
    )
    .returning();
  return row ? { note: noteCard(row) } : { error: "Note not found" };
}

export async function deleteClassLessonNoteAction(
  noteId: string,
): Promise<{ deleted?: string; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };

  const [row] = await db
    .delete(classLessonNotes)
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
      ),
    )
    .returning({ id: classLessonNotes.id });

  return row ? { deleted: row.id } : { error: "Note not found" };
}

export async function publishClassLessonSpellingAction(
  noteId: string,
): Promise<{ published?: string; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const [row] = await db
    .update(classLessonNotes)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
        eq(classLessonNotes.kind, "SPELLING"),
      ),
    )
    .returning({ id: classLessonNotes.id });
  return row ? { published: row.id } : { error: "Spelling entry not found" };
}

export async function publishClassLessonSpellingDayAction(
  rawLessonDay: string,
): Promise<{ count?: number; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const lessonDay = new Date(rawLessonDay);
  if (!Number.isFinite(lessonDay.getTime())) return { error: "Lesson not found" };
  const rows = await db
    .update(classLessonNotes)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
        eq(classLessonNotes.kind, "SPELLING"),
        eq(classLessonNotes.lessonDay, lessonDay),
        isNull(classLessonNotes.publishedAt),
      ),
    )
    .returning({ id: classLessonNotes.id });
  return { count: rows.length };
}

export async function updateClassLessonSpellingPartOfSpeechAction(
  noteId: string,
  value: SpellingPartOfSpeech,
): Promise<{ note?: ClassLessonNote; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  if (value !== "NOUN" && value !== "ADJECTIVE" && value !== "VERB" && value !== "PHRASE") {
    return { error: "Unknown word category" };
  }
  const [row] = await db
    .update(classLessonNotes)
    .set({ partOfSpeech: value, updatedAt: new Date() })
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
        eq(classLessonNotes.kind, "SPELLING"),
      ),
    )
    .returning();
  return row ? { note: noteCard(row) } : { error: "Spelling entry not found" };
}

export async function focusClassLessonNoteAction(
  noteId: string,
): Promise<{ error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const [note] = await db
    .select({ id: classLessonNotes.id })
    .from(classLessonNotes)
    .where(
      and(
        eq(classLessonNotes.id, String(noteId)),
        eq(classLessonNotes.teacherId, session.userId),
        eq(classLessonNotes.studentId, studentId),
      ),
    )
    .limit(1);
  if (!note) return { error: "Note not found" };
  const focus = (await studentFocus(studentId)) ?? {};
  await db
    .update(users)
    .set({
      classFocus: {
        ...focus,
        noteFocus: { id: note.id, at: new Date().toISOString() },
      },
    })
    .where(eq(users.id, studentId));
  return {};
}
