"use server";

/**
 * Класс: присутствие, вход в урок и переписка.
 *
 * Основной транспорт — realtime-события. Короткий опрос остаётся
 * резервом, чтобы живой урок не ломался при недоступности провайдера.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  activityGames,
  classActivityPreferences,
  classMessages,
  classLessonNotes,
  classVocabularyWords,
  lessons,
  lessonPackages,
  materialNodes,
  irregularVerbs,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { personalizeLearningContent } from "@/lib/student-learning-language";
import { getOwnedTree, getStudentLibrary, type MaterialNode } from "@/lib/materials";
import { daysLeftInWeek } from "@/lib/class-order";
import { IRREGULAR_VERBS_BASE, verbKey } from "@/lib/irregular-verbs-base";
import {
  normalizeClassVideoState,
  type ClassVideoState,
} from "@/lib/class-video";
import { scheduleNow } from "@/lib/schedule-time";
import { liveClassTimerState, type ClassTimerState } from "@/lib/class-timer";
import { classPresenceFromLastSeen, type ClassPresence } from "@/lib/presence";
import {
  classActivityKey,
  normalizeClassGameReview,
  type ClassGameReview,
} from "@/lib/class-game-meta";
import { ensureClassActivityPreferencesTable } from "@/lib/db/ensure-class-activity-preferences";
import { normalizeClassReactions, type ClassReaction } from "@/lib/class-reaction";
import { CLASS_SUMMONS_TTL_MS, type StoredClassSummons } from "@/lib/class-summons";
import { readStudentClassSummons } from "@/lib/class-summons-server";
import { preserveClassSummonsSql } from "@/lib/class-summons-persistence";
import {
  publishClassRealtime,
  publishUserRealtime,
} from "@/lib/realtime-server";

export type { Presence } from "@/lib/presence";

/** Занятие ученика: начало и длительность. */
export type ClassLesson = { at: string; minutes: number };

export type ClassPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  level: string | null;
  presence: ClassPresence;
  /** Учитель уже ведёт класс с этим учеником. */
  inClass: boolean;
  unread: number;
  /** Все занятия этой недели — по ним строится порядок списка. */
  lessons: ClassLesson[];
  /** Остаток уроков: у общего пакета — общий, иначе личный. */
  balance: number;
};

export type ClassPartnerProfile = {
  name: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  viber: string | null;
  contactNote: string | null;
  hobby: string | null;
  goal: string | null;
  homeland: string | null;
  country: string | null;
  city: string | null;
};

export type ClassMessage = {
  id: string;
  authorId: string;
  mine: boolean;
  text: string;
  createdAt: string;
  editedAt: string | null;
  archived: boolean;
};

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Нужно войти");
  return session;
}

async function countUnreadMessages(userId: string, studentId: string | null) {
  if (!studentId) return 0;

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(classMessages)
    .where(
      and(
        eq(classMessages.studentId, studentId),
        ne(classMessages.authorId, userId),
        isNull(classMessages.readAt),
        isNull(classMessages.deletedAt),
      ),
    );

  return row?.n ?? 0;
}

/**
 * Отметиться живым и узнать обстановку.
 *
 * Один вызов вместо трёх: браузер и так дёргает его по таймеру, и
 * отдельные запросы на статус собеседника только множили бы трафик.
 */
export async function heartbeatAction(): Promise<{
  role: "TEACHER" | "STUDENT";
  partner: {
    id: string;
    name: string;
    avatarUrl: string | null;
    presence: ClassPresence;
  } | null;
  unread: number;
}> {
  const session = await requireUser();

  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, session.userId));

  const [me] = await db
    .select({ role: users.role, classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const role = (me?.role === "TEACHER" ? "TEACHER" : "STUDENT") as "TEACHER" | "STUDENT";

  // У учителя собеседник записан в поле, у ученика — тот, кто выбрал его.
  const [partnerRow] = role === "TEACHER"
    ? me?.classWithId
      ? await db
          .select({
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
            lastSeenAt: users.lastSeenAt,
            classWhere: users.classWhere,
          })
          .from(users)
          .where(and(eq(users.id, me.classWithId), eq(users.role, "STUDENT")))
          .limit(1)
      : []
    : await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
          lastSeenAt: users.lastSeenAt,
          classWhere: users.classWhere,
        })
        .from(users)
        .where(
          and(
            eq(users.classWithId, session.userId),
            eq(users.role, "TEACHER"),
          ),
        )
        .limit(1);

  const studentId = role === "TEACHER" ? (me?.classWithId ?? null) : session.userId;

  const unread = await countUnreadMessages(session.userId, studentId);

  return {
    role,
    partner: partnerRow
      ? {
          id: partnerRow.id,
          name: partnerRow.name,
          avatarUrl: partnerRow.avatarUrl,
          presence: classPresenceFromLastSeen(partnerRow.lastSeenAt, partnerRow.classWhere),
        }
      : null,
    unread,
  };
}

/** Быстрый счётчик для закрытого чата — без тяжёлой загрузки всей ленты. */
export async function unreadMessagesAction(): Promise<number> {
  const session = await requireUser();
  const [me] = await db
    .select({ role: users.role, classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const studentId = me?.role === "TEACHER" ? (me.classWithId ?? null) : session.userId;
  return countUnreadMessages(session.userId, studentId);
}

/** Публичная карточка именно того учителя, который сейчас ведёт класс. */
export async function classTeacherProfileAction(): Promise<{
  profile?: ClassPartnerProfile;
  error?: string;
}> {
  const session = await requireUser();
  if (session.role !== "STUDENT") return { error: "Профиль доступен ученику" };

  const [teacher] = await db
    .select({
      name: users.name,
      avatarUrl: users.avatarUrl,
      email: users.email,
      phone: users.phone,
      telegram: users.telegram,
      viber: users.viber,
      contactNote: users.contactNote,
      hobby: users.hobby,
      goal: users.goal,
      homeland: users.homeland,
      country: users.country,
      city: users.city,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "TEACHER"),
        eq(users.classWithId, session.userId),
      ),
    )
    .limit(1);

  return teacher ? { profile: teacher } : { error: "Учитель ещё не открыл класс" };
}

/** Ученики для выбора класса — с присутствием и непрочитанным. */
export async function listClassPeopleAction(): Promise<ClassPerson[]> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return [];

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      level: users.level,
      lastSeenAt: users.lastSeenAt,
      classWhere: users.classWhere,
      balance: users.lessonBalance,
      packageId: users.packageId,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));

  /*
   * Все назначенные занятия до конца недели.
   *
   * Не одно ближайшее: за неделю у человека их несколько, и он должен
   * стоять в каждом своём дне. По одному уроку неделя схлопывалась в
   * пару дней.
   *
   * Время берём обычной выборкой столбца, а не выражением в sql``:
   * сырой агрегат возвращает строку без пояса, и она разъезжается с
   * расписанием ровно на местное смещение.
   *
   * Одним запросом на всех: список обновляется на каждом такте опроса,
   * и ходить в базу за каждым учеником отдельно тут нельзя.
   */
  const dayStart = scheduleNow();
  dayStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(dayStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + daysLeftInWeek(dayStart));

  const week = await db
    .select({
      studentId: lessons.studentId,
      startTime: lessons.startTime,
      minutes: lessons.durationMinutes,
    })
    .from(lessons)
    .where(
      and(
        eq(lessons.status, "SCHEDULED"),
        gte(lessons.startTime, dayStart),
        lt(lessons.startTime, weekEnd),
      ),
    )
    .orderBy(asc(lessons.startTime));

  const lessonsOf = new Map<string, ClassLesson[]>();
  for (const row of week) {
    const list = lessonsOf.get(row.studentId) ?? [];
    // Длительность нужна, чтобы понять, идут ли уроки встык.
    list.push({ at: row.startTime.toISOString(), minutes: row.minutes });
    lessonsOf.set(row.studentId, list);
  }

  // У общего пакета остаток один на всех участников.
  const packages = await db.select().from(lessonPackages);
  const packageOf = new Map(packages.map((p) => [p.id, p.remainingLessons]));

  const [me] = await db
    .select({ classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const unreadRows = await db
    .select({ studentId: classMessages.studentId, n: sql<number>`count(*)::int` })
    .from(classMessages)
    .where(
      and(
        ne(classMessages.authorId, session.userId),
        isNull(classMessages.readAt),
        isNull(classMessages.deletedAt),
      ),
    )
    .groupBy(classMessages.studentId);
  const unreadOf = new Map(unreadRows.map((r) => [r.studentId, r.n]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: r.avatarUrl,
    level: r.level,
    presence: classPresenceFromLastSeen(r.lastSeenAt, r.classWhere),
    inClass: me?.classWithId === r.id,
    unread: unreadOf.get(r.id) ?? 0,
    lessons: lessonsOf.get(r.id) ?? [],
    balance: (r.packageId ? packageOf.get(r.packageId) : null) ?? r.balance,
  }));
}

/** Войти в класс к ученику. Класс держится, пока учитель не выйдет. */
export async function enterClassAction(studentId: string): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Класс ведёт учитель" };

  const id = String(studentId ?? "");
  const [student] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!student || student.role !== "STUDENT") return { error: "Это не ученик" };

  const [teacher] = await db
    .select({ previousStudentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (teacher?.previousStudentId && teacher.previousStudentId !== id) {
    await db
      .update(users)
      .set({
        classFocus: sql`(((coalesce(${users.classFocus}, '{}'::jsonb) - 'timerState') - 'noteFocus') - 'reaction') - 'reactions'`,
      })
      .where(eq(users.id, teacher.previousStudentId));
  }

  await db.update(users).set({ classWithId: id }).where(eq(users.id, session.userId));
  await Promise.all([
    publishClassRealtime(id, "class-sync"),
    publishUserRealtime(id, "class-people"),
    teacher?.previousStudentId && teacher.previousStudentId !== id
      ? publishClassRealtime(teacher.previousStudentId, "class-sync")
      : Promise.resolve(),
  ]);
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return {};
}

/** Выбрать ученика из расписания и сразу перейти в его класс. */
export async function enterClassFromScheduleAction(formData: FormData): Promise<void> {
  const result = await enterClassAction(String(formData.get("studentId") ?? ""));
  if (result.error) return;
  redirect("/teacher/class");
}

/** Одноразово открыть класс на уже активной вкладке выбранного ученика. */
export async function summonStudentToClassAction(expectedStudentId?: string): Promise<{ error?: string; commandId?: string; expiresAt?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Класс ведёт учитель" };
  if (expectedStudentId !== undefined && (typeof expectedStudentId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedStudentId))) {
    return { error: "Некорректный ученик" };
  }

  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "TEACHER")))
    .limit(1);
  if (!teacher?.studentId) return { error: "Сначала выбери ученика" };
  if (expectedStudentId !== undefined && expectedStudentId !== teacher.studentId) {
    return { error: "Выбранный ученик изменился. Попробуй ещё раз" };
  }

  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, teacher.studentId), eq(users.role, "STUDENT")))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };
  // Online status is a display hint, not an authority: a delayed heartbeat must
  // not reject an active browser. Bounded expiry prevents a much later pull.
  const now = Date.now();
  const requestedAt = new Date(now).toISOString();
  const command: StoredClassSummons = { id: randomUUID(), teacherId: session.userId,
    requestedAt, expiresAt: new Date(now + CLASS_SUMMONS_TTL_MS).toISOString() };
  const delivered = await db
    .update(users)
    .set({
      classFocus: sql`coalesce(${users.classFocus}, '{}'::jsonb) || ${JSON.stringify({ enterClassCommand: command, enterClassAt: requestedAt })}::jsonb`,
    })
    .where(and(eq(users.id, teacher.studentId), eq(users.role, "STUDENT"),
      sql`exists (select 1 from ${users} as summon_teacher where summon_teacher.id = ${session.userId}::uuid and summon_teacher.role = 'TEACHER' and summon_teacher.class_with_id = ${teacher.studentId}::uuid)`))
    .returning({ id: users.id });
  if (!delivered.length) return { error: "Выбранный ученик изменился. Попробуй ещё раз" };

  await publishUserRealtime(teacher.studentId, "summon", { commandId: command.id, expiresAt: command.expiresAt });

  return { commandId: command.id, expiresAt: command.expiresAt };
}

/**
 * Compatibility for already-open clients during deployment. Reading is
 * non-consuming; the independent HTTP endpoint acknowledges route arrival.
 */
export async function studentPlatformCommandAction(): Promise<{ enterClass: boolean; commandId?: string; expiresAt?: string }> {
  const session = await requireUser();
  if (session.role !== "STUDENT") return { enterClass: false };

  const command = await readStudentClassSummons(session);
  return command ? { enterClass: true, commandId: command.id, expiresAt: command.expiresAt } : { enterClass: false };
}

/** Выйти из класса — учитель возвращается к выбору ученика. */
export async function leaveClassAction(): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Класс ведёт учитель" };

  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (teacher?.studentId) {
    await db
      .update(users)
      .set({
        classFocus: sql`(((coalesce(${users.classFocus}, '{}'::jsonb) - 'timerState') - 'noteFocus') - 'reaction') - 'reactions'`,
      })
      .where(eq(users.id, teacher.studentId));
  }
  await db.update(users).set({ classWithId: null }).where(eq(users.id, session.userId));
  if (teacher?.studentId) {
    await publishClassRealtime(teacher.studentId, "class-sync");
  }
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return {};
}

/** Чей это разговор: у ученика свой, у учителя — того, с кем он в классе. */
async function conversationOf(userId: string, role: string): Promise<string | null> {
  if (role !== "TEACHER") return userId;
  const [me] = await db
    .select({ classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me?.classWithId ?? null;
}

/** Лента переписки. Архив отдаётся отдельно — он не мешает уроку. */
export async function listMessagesAction(
  studentId?: string,
  withArchived = false,
): Promise<ClassMessage[]> {
  const session = await requireUser();

  const conversation =
    session.role === "TEACHER"
      ? (studentId ?? (await conversationOf(session.userId, session.role)))
      : session.userId;
  if (!conversation) return [];

  const rows = await db
    .select()
    .from(classMessages)
    .where(and(eq(classMessages.studentId, conversation), isNull(classMessages.deletedAt)))
    .orderBy(asc(classMessages.createdAt));

  // Входящие считаем прочитанными самим фактом открытия ленты.
  await db
    .update(classMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(classMessages.studentId, conversation),
        ne(classMessages.authorId, session.userId),
        isNull(classMessages.readAt),
      ),
    );

  return rows
    .filter((r) => withArchived || !r.archivedAt)
    .map((r) => ({
      id: r.id,
      authorId: r.authorId,
      mine: r.authorId === session.userId,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt?.toISOString() ?? null,
      archived: !!r.archivedAt,
    }));
}

export async function sendMessageAction(
  text: string,
  studentId?: string,
): Promise<{ error?: string }> {
  const session = await requireUser();

  const body = String(text ?? "").trim().slice(0, 4000);
  if (!body) return { error: "Пустое сообщение" };

  const conversation =
    session.role === "TEACHER"
      ? (studentId ?? (await conversationOf(session.userId, session.role)))
      : session.userId;
  if (!conversation) return { error: "Не выбран ученик" };

  await db.insert(classMessages).values({
    studentId: conversation,
    authorId: session.userId,
    text: body,
  });
  await publishClassRealtime(conversation, "chat");
  return {};
}

/** Правка, удаление и архивация — только своего сообщения либо учителем. */
async function ownMessage(id: string, userId: string, role: string) {
  const [row] = await db
    .select({
      id: classMessages.id,
      authorId: classMessages.authorId,
      studentId: classMessages.studentId,
    })
    .from(classMessages)
    .where(eq(classMessages.id, id))
    .limit(1);
  if (!row) return null;
  if (row.authorId !== userId && role !== "TEACHER") return null;
  return row;
}

export async function editMessageAction(
  id: string,
  text: string,
): Promise<{ error?: string }> {
  const session = await requireUser();
  const row = await ownMessage(String(id ?? ""), session.userId, session.role);
  if (!row) return { error: "Сообщение не найдено" };

  const body = String(text ?? "").trim().slice(0, 4000);
  if (!body) return { error: "Пустое сообщение" };

  await db
    .update(classMessages)
    .set({ text: body, editedAt: new Date() })
    .where(eq(classMessages.id, row.id));
  await publishClassRealtime(row.studentId, "chat");
  return {};
}

export async function deleteMessageAction(id: string): Promise<{ error?: string }> {
  const session = await requireUser();
  const row = await ownMessage(String(id ?? ""), session.userId, session.role);
  if (!row) return { error: "Сообщение не найдено" };

  await db
    .update(classMessages)
    .set({ deletedAt: new Date() })
    .where(eq(classMessages.id, row.id));
  await publishClassRealtime(row.studentId, "chat");
  return {};
}

export async function archiveMessageAction(
  id: string,
  archived: boolean,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Архив ведёт учитель" };

  const [row] = await db
    .select({ id: classMessages.id, studentId: classMessages.studentId })
    .from(classMessages)
    .where(eq(classMessages.id, String(id ?? "")))
    .limit(1);
  if (!row) return { error: "Сообщение не найдено" };

  await db
    .update(classMessages)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(classMessages.id, row.id));
  await publishClassRealtime(row.studentId, "chat");
  return {};
}

export type QuickVerb = {
  base: string;
  past: string;
  participle: string;
  translation: string | null;
  translationLang?: "RU" | "UK";
  /** Глагол взят из списков учителя, а не из общего справочника. */
  own: boolean;
};

/**
 * Табличка неправильных глаголов для быстрой подсказки.
 *
 * Основа — полный справочник: на уроке нужное слово должно находиться
 * всегда, а не только если учитель успел завести его в материалах.
 * Поверх ложатся собственные списки: там, где формы совпали, побеждает
 * свой вариант — в нём может быть уточнённый перевод.
 */
export async function quickVerbsAction(): Promise<QuickVerb[]> {
  const session = await requireUser();
  const [teacher] = session.role === "TEACHER" ? await db.select({ studentId: users.classWithId }).from(users).where(eq(users.id, session.userId)).limit(1) : [];
  const studentId = session.role === "STUDENT" ? session.userId : teacher?.studentId;

  // Personal language variants must never read somebody else's private lists.
  // The complete public reference remains available even without any grants.
  const visibleNodes: MaterialNode[] = [];
  const flatten = (nodes: MaterialNode[]) => { for (const node of nodes) { visibleNodes.push(node); flatten(node.children); } };
  if (studentId) {
    const trees = await Promise.all([getStudentLibrary(studentId, false), getOwnedTree("MISTAKE", studentId, false)]);
    trees.forEach(flatten);
  }
  const rows = await db.select({ base: irregularVerbs.base, past: irregularVerbs.past, participle: irregularVerbs.participle, translation: irregularVerbs.translation, translationLang: materialNodes.translationLang, nodeId: irregularVerbs.nodeId })
    .from(irregularVerbs).innerJoin(materialNodes, eq(materialNodes.id, irregularVerbs.nodeId))
    .where(studentId ? inArray(irregularVerbs.nodeId, visibleNodes.map(node => node.id)) : or(and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)), and(eq(materialNodes.scope, "PERSONAL"), eq(materialNodes.ownerId, session.userId))));
  const languageOf = new Map(visibleNodes.map(node => [node.id, node.translationLang]));

  const byKey = new Map<string, QuickVerb>();
  for (const v of IRREGULAR_VERBS_BASE) {
    byKey.set(verbKey(v), { ...v, translationLang: "RU", own: false });
  }
  for (const v of rows) {
    const key = verbKey(v);
    byKey.set(key, {
      base: v.base,
      past: v.past,
      participle: v.participle,
      translation: v.translation ?? byKey.get(key)?.translation ?? null,
      translationLang: languageOf.get(v.nodeId) ?? v.translationLang,
      own: true,
    });
  }

  const verbs = [...byKey.values()].sort(
    (a, b) =>
      a.base.localeCompare(b.base, "en") ||
      a.past.localeCompare(b.past, "en"),
  );
  return studentId ? personalizeLearningContent(studentId, verbs) : verbs;
}

/* ------------------------------------------------------------------ */
/* Где кто в классе                                                    */
/* ------------------------------------------------------------------ */

export type ClassSync = {
  /** Какой выданный урок сейчас открыт в классе. */
  lessonAssignmentId: string | null;
  /** Явная команда только для доски или возврата к уроку. */
  view: {
    target: "BOARD" | "LESSON" | "GAME" | "TWISTER";
    at: string;
    boardObjectId: number | null;
    boardCommand: "SHOW" | "FOCUS" | "FLASH" | null;
    gameId: string | null;
    revisionId: string | null;
    lessonSection: string | null;
    lessonElementId: string | null;
  } | null;
  /** Учителю: открыта ли доска у ученика прямо сейчас. */
  partnerOnBoard: boolean;
  /** Состояние общего плеера текущей пары в классе. */
  video: ClassVideoState | null;
  /** Shared blocking timer. It is visible to the student only after teacher focus. */
  timer: ClassTimerState | null;
  /** One-shot teacher note shown to the student. */
  noteFocus: {
    id: string;
    kind: "NOTE" | "SPELLING";
    body: string;
    translation: string | null;
    partOfSpeech: string | null;
    icon: string | null;
    examples: { en: string; tr: string }[];
    lessonDay: string;
    at: string;
  } | null;
  /** Последние добавления нужны для заметного уведомления обоим участникам. */
  vocabularyEvents: {
    id: string;
    english: string;
    translation: string;
    createdAt: string;
  }[];
  /** The student's visible rating for the game currently in the centre. */
  gameReview: ClassGameReview | null;
  /** Latest visible rating, used for the colourful in-class notification. */
  gameReviewNotice: ClassGameReview | null;
  /** Every short-lived reaction sent since the student's previous poll. */
  reactions: ClassReaction[];
};

/**
 * Узнать, какой урок сейчас открыт в классе. Панели у каждого свои:
 * сервер больше не хранит и не пересылает переключения нижнего меню.
 */
export async function classSyncAction(onBoard = false): Promise<ClassSync> {
  const session = await requireUser();

  const [me] = await db
    .select({
      role: users.role,
      classWithId: users.classWithId,
      classFocus: users.classFocus,
      classWhere: users.classWhere,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!me) {
    return {
      lessonAssignmentId: null,
      view: null,
      partnerOnBoard: false,
      video: null,
      timer: null,
      noteFocus: null,
      vocabularyEvents: [],
      gameReview: null,
      gameReviewNotice: null,
      reactions: [],
    };
  }

  // У учителя собеседник записан в поле, у ученика — тот, кто выбрал его.
  const partnerQuery =
    me.role === "TEACHER"
      ? me.classWithId
        ? db
            .select({ id: users.id, classWhere: users.classWhere, classFocus: users.classFocus })
            .from(users)
            .where(eq(users.id, me.classWithId))
            .limit(1)
        : []
      : db
          .select({ id: users.id, classWhere: users.classWhere, classFocus: users.classFocus })
          .from(users)
          .where(and(eq(users.classWithId, session.userId), eq(users.role, "TEACHER")))
          .limit(1);

  const studentId = me.role === "TEACHER" ? me.classWithId : session.userId;
  const vocabularyQuery = studentId
    ? db
        .select({
          id: classVocabularyWords.id,
          english: classVocabularyWords.english,
          translation: classVocabularyWords.translation,
          createdAt: classVocabularyWords.createdAt,
        })
        .from(classVocabularyWords)
        .where(eq(classVocabularyWords.studentId, studentId))
        .orderBy(desc(classVocabularyWords.createdAt))
        .limit(8)
    : [];

  const reviewQuery = me.role === "STUDENT" && studentId
    ? ensureClassActivityPreferencesTable().then(() =>
        db
          .select({
            reviews: classActivityPreferences.reviews,
            notice: classActivityPreferences.reviewNotice,
          })
          .from(classActivityPreferences)
          .where(eq(classActivityPreferences.studentId, studentId))
          .limit(1),
      )
    : [];
  const classWhere = onBoard ? "board" : "class";
  const cutoff = new Date(Date.now() - 15_000);
  const updatePresence = me.classWhere !== classWhere || !me.lastSeenAt || me.lastSeenAt < cutoff
    ? db.update(users).set({ classWhere, lastSeenAt: new Date() })
        .where(and(eq(users.id, session.userId), inArray(users.classWhere, ["class", "board"]), sql`(${users.classWhere} is distinct from ${classWhere} or ${users.lastSeenAt} is null or ${users.lastSeenAt} < ${cutoff})`))
    : Promise.resolve();
  const [partnerRows, vocabularyEvents, reviewRows] = await Promise.all([partnerQuery, vocabularyQuery, reviewQuery, updatePresence]);
  const [partner] = partnerRows;
  const [storedGameReview] = reviewRows;

  const storedView: ClassSync["view"] =
    me.role === "STUDENT" &&
    !!partner &&
    (me.classFocus?.view === "BOARD" ||
      me.classFocus?.view === "LESSON" ||
      me.classFocus?.view === "GAME" ||
      me.classFocus?.view === "TWISTER") &&
    me.classFocus.at
      ? {
          target: me.classFocus.view,
          at: me.classFocus.at,
          boardObjectId: me.classFocus.boardObjectId ?? null,
          gameId:
            me.classFocus.view === "GAME"
              ? (me.classFocus.gameId ?? null)
              : null,
          revisionId:
            me.classFocus.view === "GAME"
              ? (me.classFocus.revisionId ?? null)
              : null,
          lessonSection:
            me.classFocus.view === "LESSON" &&
            typeof me.classFocus.lessonSection === "string" &&
            me.classFocus.lessonSection.length <= 100
              ? me.classFocus.lessonSection
              : null,
          lessonElementId:
            me.classFocus.view === "LESSON" &&
            typeof me.classFocus.lessonElementId === "string" &&
            me.classFocus.lessonElementId.length <= 128
              ? me.classFocus.lessonElementId
              : null,
          boardCommand:
            me.classFocus.view !== "BOARD"
              ? null
              : me.classFocus.boardCommand === "SHOW" ||
                  me.classFocus.boardCommand === "FOCUS" ||
                  me.classFocus.boardCommand === "FLASH"
                ? me.classFocus.boardCommand
                : me.classFocus.boardObjectId
                  ? "FOCUS"
                  : "SHOW",
        }
      : null;
  const storedViewAt = storedView ? Date.parse(storedView.at) : Number.NaN;
  const view =
    storedView?.target === "LESSON" &&
    (!Number.isFinite(storedViewAt) || Date.now() - storedViewAt > 60_000)
      ? null
      : storedView;

  const timer = liveClassTimerState(
    me.role === "TEACHER" ? partner?.classFocus?.timerState : me.classFocus?.timerState,
  );
  const focusedActivityKey =
    me.role === "STUDENT" && me.classFocus?.view === "GAME"
      ? me.classFocus.revisionId
        ? classActivityKey("revision", me.classFocus.revisionId)
        : me.classFocus.gameId
          ? classActivityKey("game", me.classFocus.gameId)
          : null
      : null;
  const currentGameReview = focusedActivityKey
    ? normalizeClassGameReview(storedGameReview?.reviews?.[focusedActivityKey])
    : null;
  const latestGameReview = normalizeClassGameReview(storedGameReview?.notice);
  const visibleGameReview = {
    review: currentGameReview?.visible ? currentGameReview : null,
    notice: latestGameReview?.visible ? latestGameReview : null,
  };

  let noteFocus: ClassSync["noteFocus"] = null;
  const requestedNote = me.role === "STUDENT" ? me.classFocus?.noteFocus : null;
  if (requestedNote?.id && requestedNote.at && partner?.id) {
    const requestedAt = Date.parse(requestedNote.at);
    if (Number.isFinite(requestedAt) && Date.now() - requestedAt <= 60_000) {
      const [note] = await db
        .select({
          id: classLessonNotes.id,
          kind: classLessonNotes.kind,
          body: classLessonNotes.body,
          translation: classLessonNotes.translation,
          partOfSpeech: classLessonNotes.partOfSpeech,
          icon: classLessonNotes.icon,
          examples: classLessonNotes.examples,
          lessonDay: classLessonNotes.lessonDay,
        })
        .from(classLessonNotes)
        .where(
          and(
            eq(classLessonNotes.id, requestedNote.id),
            eq(classLessonNotes.studentId, session.userId),
            eq(classLessonNotes.teacherId, partner.id),
          ),
        )
        .limit(1);
      if (note) {
        noteFocus = {
          id: note.id,
          kind: note.kind === "SPELLING" ? "SPELLING" : "NOTE",
          body: note.body,
          translation: note.translation,
          partOfSpeech: note.partOfSpeech,
          icon: note.icon,
          examples: note.examples ?? [],
          lessonDay: note.lessonDay.toISOString(),
          at: requestedNote.at,
        };
      }
    }
    await db
      .update(users)
      .set({
        classFocus: sql`coalesce(${users.classFocus}, '{}'::jsonb) - 'noteFocus'`,
      })
      .where(
        and(
          eq(users.id, session.userId),
          eq(users.role, "STUDENT"),
          sql`${users.classFocus}->'noteFocus'->>'at' = ${requestedNote.at}`,
        ),
      );
  }

  /*
   * Lesson focus is a one-shot command. Return it once, then remove only
   * navigation fields while keeping the active lesson and shared video state.
   * The timestamp guard prevents an older poll from deleting a newer command.
  */
  if (storedView?.target === "LESSON" && me.classFocus) {
    await db
      .update(users)
      .set({
        classFocus: sql`((((((coalesce(${users.classFocus}, '{}'::jsonb) #- '{videoState,focusAt}') - 'view') - 'at') - 'boardObjectId') - 'boardCommand') - 'lessonSection') - 'lessonElementId'`,
      })
      .where(
        and(
          eq(users.id, session.userId),
          eq(users.role, "STUDENT"),
          sql`${users.classFocus}->>'at' = ${storedView.at}`,
        ),
      );
  }

  const rawReactions = me.role === "STUDENT" ? me.classFocus?.reactions : null;
  const reactions = normalizeClassReactions(rawReactions);
  if (Array.isArray(rawReactions) && rawReactions.length > 0) {
    /*
     * Consume exactly the queue we read. If a teacher appends another click
     * while this poll is running, the equality guard keeps the new queue for
     * the next poll. The client de-duplicates the older events by id.
     */
    await db
      .update(users)
      .set({
        classFocus: sql`coalesce(${users.classFocus}, '{}'::jsonb) - 'reactions'`,
      })
      .where(
        and(
          eq(users.id, session.userId),
          eq(users.role, "STUDENT"),
          sql`${users.classFocus}->'reactions' = ${JSON.stringify(rawReactions)}::jsonb`,
        ),
      );
  }

  return {
    lessonAssignmentId:
      me.role === "TEACHER"
        ? (partner?.classFocus?.lessonAssignmentId ?? null)
        : (me.classFocus?.lessonAssignmentId ?? null),
    view,
    partnerOnBoard: me.role === "TEACHER" && partner?.classWhere === "board",
    video: normalizeClassVideoState(
      me.role === "TEACHER"
        ? partner?.classFocus?.videoState
        : me.classFocus?.videoState,
    ),
    timer,
    noteFocus: noteFocus?.kind === "SPELLING" && studentId ? await personalizeLearningContent(studentId, noteFocus) : noteFocus,
    gameReview: me.role === "STUDENT" ? visibleGameReview.review : null,
    gameReviewNotice: me.role === "STUDENT" ? visibleGameReview.notice : null,
    reactions,
    vocabularyEvents: (studentId ? await personalizeLearningContent(studentId, vocabularyEvents) : vocabularyEvents).map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

/**
 * Перевести ученика на игру.
 *
 * Игра у ученика и так появляется сама, когда её запускают, но поверх
 * неё может стоять доска — она во весь экран. Эта команда закрывает
 * доску и возвращает ученика к игре: то же явное действие, что и
 * «показать доску», только в обратную сторону.
 */
export async function showGameToStudentAction(gameId?: string): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Это может только учитель" };

  const [me] = await db
    .select({ classWithId: users.classWithId })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!me?.classWithId) return { error: "Класс не начат" };

  const [student] = await db
    .select({ classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, me.classWithId), eq(users.role, "STUDENT")))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };

  const requestedGameId = String(gameId ?? "");
  if (requestedGameId) {
    const [assigned] = await db
      .select({ id: activityGames.id })
      .from(activityGames)
      .where(
        and(
          eq(activityGames.id, requestedGameId),
          eq(activityGames.studentId, me.classWithId),
          eq(activityGames.kind, "WORD_DECK"),
        ),
      )
      .limit(1);
    if (!assigned) return { error: "Эта игра не добавлена выбранному ученику" };
  }
  let focusedGameId = requestedGameId;
  if (!focusedGameId) {
    const [running] = await db
      .select({ id: activityGames.id })
      .from(activityGames)
      .where(
        and(
          eq(activityGames.studentId, me.classWithId),
          eq(activityGames.kind, "GUESS_PICTURE"),
          eq(activityGames.status, "RUNNING"),
        ),
      )
      .orderBy(desc(activityGames.updatedAt))
      .limit(1);
    const [queued] = running
      ? []
      : await db
          .select({ id: activityGames.id })
          .from(activityGames)
          .where(
            and(
              eq(activityGames.studentId, me.classWithId),
              eq(activityGames.kind, "GUESS_PICTURE"),
              eq(activityGames.status, "LOBBY"),
            ),
          )
          .orderBy(asc(activityGames.createdAt))
          .limit(1);
    focusedGameId = running?.id ?? queued?.id ?? "";
  }

  await db
    .update(users)
    .set({
      classFocus: preserveClassSummonsSql(users.classFocus, {
        at: new Date().toISOString(),
        view: "GAME",
        ...(focusedGameId ? { gameId: focusedGameId } : {}),
        // Урок помним: закончится игра — ученику будет куда вернуться.
        ...(student.classFocus?.lessonAssignmentId
          ? { lessonAssignmentId: student.classFocus.lessonAssignmentId }
          : {}),
      }),
    })
    .where(eq(users.id, me.classWithId));

  await publishClassRealtime(me.classWithId, "class-sync");

  return {};
}
