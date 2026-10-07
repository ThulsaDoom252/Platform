"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  activityGames,
  classActivityPreferences,
  notifications,
  users,
  wordRevisions,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { fmt, getDictFor } from "@/lib/i18n";
import {
  CLASS_GAME_GRADES,
  classActivityKey,
  classGameGradeStyle,
  normalizeClassGameReview,
  type ClassActivityMeta,
  type ClassActivitySetting,
  type ClassGameGrade,
  type ClassGameReview,
} from "@/lib/class-game-meta";
import { normalizeWordDeckSettings } from "@/lib/word-deck";
import { ensureClassActivityPreferencesTable } from "@/lib/db/ensure-class-activity-preferences";
import { publishClassRealtime, publishUserRealtime } from "@/lib/realtime-server";

async function teacherForStudent(studentId: string) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Only for teachers");
  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!teacher?.studentId || teacher.studentId !== studentId) {
    throw new Error("This student is not in the current class");
  }
  return session;
}

async function activityRows(studentId: string) {
  const [games, revisions] = await Promise.all([
    db
      .select({
        id: activityGames.id,
        kind: activityGames.kind,
        wordDeck: activityGames.wordDeck,
        createdAt: activityGames.createdAt,
      })
      .from(activityGames)
      .where(
        and(
          eq(activityGames.studentId, studentId),
          inArray(activityGames.kind, ["GUESS_PICTURE", "WORD_DECK"]),
        ),
      )
      .orderBy(asc(activityGames.createdAt)),
    db
      .select({ id: wordRevisions.id, createdAt: wordRevisions.createdAt })
      .from(wordRevisions)
      .where(
        and(
          eq(wordRevisions.studentId, studentId),
          eq(wordRevisions.placement, "CLASS"),
        ),
      )
      .orderBy(asc(wordRevisions.createdAt)),
  ]);

  return [
    ...games.map((game) => ({
      key: classActivityKey("game", game.id),
      createdAt: game.createdAt,
      teacherAnswers:
        game.kind === "GUESS_PICTURE" ||
        (game.kind === "WORD_DECK" &&
          ["WORDS", "GUESS_DESCRIPTION", "GUESS_PICTURE"].includes(
            normalizeWordDeckSettings(game.wordDeck?.settings).gameType,
          )),
    })),
    ...revisions.map((revision) => ({
      key: classActivityKey("revision", revision.id),
      createdAt: revision.createdAt,
      teacherAnswers: false,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function cleanOrder(stored: unknown, available: string[]) {
  const allowed = new Set(available);
  const seen = new Set<string>();
  const order = Array.isArray(stored)
    ? stored.flatMap((value) => {
        const key = String(value);
        if (!allowed.has(key) || seen.has(key)) return [];
        seen.add(key);
        return [key];
      })
    : [];
  return [...order, ...available.filter((key) => !seen.has(key))];
}

async function storedMeta(studentId: string, teacherId: string) {
  const [row] = await db
    .select()
    .from(classActivityPreferences)
    .where(
      and(
        eq(classActivityPreferences.studentId, studentId),
        eq(classActivityPreferences.teacherId, teacherId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listClassActivityMetaAction(
  studentId: string,
): Promise<ClassActivityMeta> {
  const target = String(studentId ?? "");
  const session = await teacherForStudent(target);
  await ensureClassActivityPreferencesTable();
  const [activities, stored] = await Promise.all([
    activityRows(target),
    storedMeta(target, session.userId),
  ]);
  const keys = activities.map((activity) => activity.key);
  const allowed = new Set(keys);
  const answerKeys = new Set(
    activities.filter((activity) => activity.teacherAnswers).map((activity) => activity.key),
  );
  const settings = Object.fromEntries(
    Object.entries(stored?.settings ?? {}).flatMap(([key, value]) =>
      allowed.has(key) && answerKeys.has(key)
        ? [[key, { teacherSeesAnswers: value?.teacherSeesAnswers === true }]]
        : [],
    ),
  ) as Record<string, ClassActivitySetting>;
  const reviews = Object.fromEntries(
    Object.entries(stored?.reviews ?? {}).flatMap(([key, value]) => {
      const review = normalizeClassGameReview(value);
      return review && allowed.has(key) ? [[key, review]] : [];
    }),
  );
  return {
    order: cleanOrder(stored?.activityOrder, keys),
    settings,
    reviews,
  };
}

export async function saveClassActivityOrderAction(
  studentId: string,
  requestedOrder: string[],
): Promise<{ order: string[] }> {
  const target = String(studentId ?? "");
  const session = await teacherForStudent(target);
  await ensureClassActivityPreferencesTable();
  const activities = await activityRows(target);
  const order = cleanOrder(requestedOrder, activities.map((activity) => activity.key));
  await db
    .insert(classActivityPreferences)
    .values({ studentId: target, teacherId: session.userId, activityOrder: order })
    .onConflictDoUpdate({
      target: classActivityPreferences.studentId,
      set: { teacherId: session.userId, activityOrder: order, updatedAt: new Date() },
    });
  return { order };
}

export async function setClassGameAnswerVisibilityAction(
  studentId: string,
  activityKey: string,
  teacherSeesAnswers: boolean,
): Promise<{ error?: string }> {
  const target = String(studentId ?? "");
  const key = String(activityKey ?? "");
  const session = await teacherForStudent(target);
  await ensureClassActivityPreferencesTable();
  const activities = await activityRows(target);
  const activity = activities.find((item) => item.key === key);
  if (!activity?.teacherAnswers) return { error: "This setting is not available for this game" };
  const stored = await storedMeta(target, session.userId);
  const settings = {
    ...(stored?.settings ?? {}),
    [key]: { teacherSeesAnswers: teacherSeesAnswers === true },
  };
  await db
    .insert(classActivityPreferences)
    .values({ studentId: target, teacherId: session.userId, settings })
    .onConflictDoUpdate({
      target: classActivityPreferences.studentId,
      set: { teacherId: session.userId, settings, updatedAt: new Date() },
    });
  return {};
}

const gradeLabel = (grade: ClassGameGrade, locale: string) => {
  const t = getDictFor(locale);
  return grade === "GREAT"
    ? t.classRoom.gradeGreat
    : grade === "GOOD"
      ? t.classRoom.gradeGood
      : grade === "NOT_BAD"
        ? t.classRoom.gradeNotBad
        : t.classRoom.gradeRidiculous;
};

export async function saveClassGameReviewAction(input: {
  studentId: string;
  activityKey: string;
  title: string;
  grade: ClassGameGrade;
  notes: string;
  visible: boolean;
}): Promise<{ review?: ClassGameReview; error?: string }> {
  const studentId = String(input?.studentId ?? "");
  const activityKey = String(input?.activityKey ?? "");
  const session = await teacherForStudent(studentId);
  await ensureClassActivityPreferencesTable();
  const activities = await activityRows(studentId);
  if (!activities.some((activity) => activity.key === activityKey)) {
    return { error: "Game not found" };
  }
  if (!CLASS_GAME_GRADES.includes(input.grade)) return { error: "Choose a rating" };
  const title = String(input.title ?? "").trim().slice(0, 120) || "Game";
  const review: ClassGameReview = {
    activityKey,
    title,
    grade: input.grade,
    notes: String(input.notes ?? "").trim().slice(0, 1000),
    visible: input.visible === true,
    at: new Date().toISOString(),
  };
  const [stored, student] = await Promise.all([
    storedMeta(studentId, session.userId),
    db
      .select({ locale: users.locale })
      .from(users)
      .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  if (!student) return { error: "Student not found" };
  const previous = normalizeClassGameReview(stored?.reviews?.[activityKey]);
  const reviews = { ...(stored?.reviews ?? {}), [activityKey]: review };
  await db
    .insert(classActivityPreferences)
    .values({
      studentId,
      teacherId: session.userId,
      reviews,
      reviewNotice: review.visible ? review : null,
    })
    .onConflictDoUpdate({
      target: classActivityPreferences.studentId,
      set: {
        teacherId: session.userId,
        reviews,
        reviewNotice: review.visible ? review : null,
        updatedAt: new Date(),
      },
    });

  const changedForStudent =
    review.visible &&
    (!previous?.visible ||
      previous.grade !== review.grade ||
      previous.notes !== review.notes);
  if (changedForStudent) {
    const t = getDictFor(student.locale);
    await db.insert(notifications).values({
      recipientId: studentId,
      senderId: session.userId,
      type: "HOMEWORK_SUBMITTED",
      message: fmt(t.classRoom.gameReviewNotification, {
        title,
        grade: gradeLabel(review.grade, student.locale),
        emoji: classGameGradeStyle[review.grade].emoji,
      }),
      href: "/student/class",
      relatedStudentId: studentId,
    });
    await publishUserRealtime(studentId, "notification");
  }
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  await publishClassRealtime(studentId, "class-sync");
  return { review };
}
