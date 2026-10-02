"use server";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  classLessonNotes,
  classTimerPresets,
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

const presetCard = (row: typeof classTimerPresets.$inferSelect): ClassTimerPreset => ({
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
  return rows.map(presetCard);
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
    return row ? { preset: presetCard(row) } : { error: "Timer not found" };
  }

  const [row] = await db
    .insert(classTimerPresets)
    .values({ teacherId: session.userId, ...values })
    .returning();
  return { preset: presetCard(row) };
}

async function studentFocus(studentId: string) {
  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .limit(1);
  return student?.classFocus ?? null;
}

async function storeTimerState(studentId: string, timerState: ClassTimerState | null) {
  const focus = (await studentFocus(studentId)) ?? {};
  const next = { ...focus };
  if (timerState) next.timerState = timerState;
  else delete next.timerState;
  await db.update(users).set({ classFocus: next }).where(eq(users.id, studentId));
}

export async function prepareClassTimerAction(
  presetId: string,
): Promise<{ state?: ClassTimerState; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const [preset] = await db
    .select()
    .from(classTimerPresets)
    .where(
      and(
        eq(classTimerPresets.id, String(presetId)),
        eq(classTimerPresets.teacherId, session.userId),
      ),
    )
    .limit(1);
  if (!preset) return { error: "Timer not found" };

  const now = new Date().toISOString();
  const state: ClassTimerState = {
    ...presetCard(preset),
    status: "READY",
    remainingMs: preset.durationSeconds * 1000,
    endsAt: null,
    visible: false,
    startedSignalAt: null,
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
      updatedAt,
    };
  }
  await storeTimerState(studentId, state);
  return { state };
}

export type ClassLessonNote = {
  id: string;
  body: string;
  lessonId: string | null;
  lessonDay: string;
  createdAt: string;
  updatedAt: string;
};

const noteCard = (row: typeof classLessonNotes.$inferSelect): ClassLessonNote => ({
  id: row.id,
  body: row.body,
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
): Promise<{ note?: ClassLessonNote; error?: string }> {
  const { session, studentId } = await teacherWithStudent();
  if (!studentId) return { error: "Pick a student first" };
  const body = String(text ?? "").trim().slice(0, 4_000);
  if (!body) return { error: "Write a note" };
  const context = await currentLessonContext(studentId);
  const [row] = await db
    .insert(classLessonNotes)
    .values({
      teacherId: session.userId,
      studentId,
      ...context,
      body,
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
  const [row] = await db
    .update(classLessonNotes)
    .set({ body, updatedAt: new Date() })
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
