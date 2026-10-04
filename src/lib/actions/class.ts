"use server";

/**
 * Класс: присутствие, вход в урок и переписка.
 *
 * Постоянного соединения в проекте нет, поэтому живость держится
 * опросом: браузер раз в полминуты отмечается, и по свежести отметки
 * считается «онлайн». Это проще сокетов и достаточно для двоих
 * человек в уроке.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  activityGames,
  classMessages,
  classLessonNotes,
  classVocabularyWords,
  lessons,
  lessonPackages,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { daysLeftInWeek } from "@/lib/class-order";
import { IRREGULAR_VERBS_BASE, verbKey } from "@/lib/irregular-verbs-base";
import {
  normalizeClassVideoState,
  type ClassVideoState,
} from "@/lib/class-video";
import { scheduleNow } from "@/lib/schedule-time";
import { liveClassTimerState, type ClassTimerState } from "@/lib/class-timer";
import { presenceFromLastSeen, type Presence } from "@/lib/presence";

export type { Presence } from "@/lib/presence";

/** Занятие ученика: начало и длительность. */
export type ClassLesson = { at: string; minutes: number };

export type ClassPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  level: string | null;
  presence: Presence;
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

const isOnline = (seen: Date | null) => presenceFromLastSeen(seen) === "online";

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
    presence: Presence;
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
          presence: isOnline(partnerRow.lastSeenAt) ? "online" : "offline",
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
    presence: isOnline(r.lastSeenAt) ? "online" : "offline",
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
        classFocus: sql`(coalesce(${users.classFocus}, '{}'::jsonb) - 'timerState') - 'noteFocus'`,
      })
      .where(eq(users.id, teacher.previousStudentId));
  }

  await db.update(users).set({ classWithId: id }).where(eq(users.id, session.userId));
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
export async function summonStudentToClassAction(): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Класс ведёт учитель" };

  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "TEACHER")))
    .limit(1);
  if (!teacher?.studentId) return { error: "Сначала выбери ученика" };

  const [student] = await db
    .select({ lastSeenAt: users.lastSeenAt, classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, teacher.studentId), eq(users.role, "STUDENT")))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };
  if (!isOnline(student.lastSeenAt)) return { error: "Ученик сейчас не на платформе" };

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({
      classFocus: {
        ...student.classFocus,
        at: student.classFocus?.at ?? now,
        enterClassAt: now,
      },
    })
    .where(and(eq(users.id, teacher.studentId), eq(users.role, "STUDENT")));

  return {};
}

/**
 * Короткий глобальный такт ученика: отмечает присутствие и забирает
 * одноразовую команду перехода. Фокус урока при этом не очищается.
 */
export async function studentPlatformCommandAction(): Promise<{ enterClass: boolean }> {
  const session = await requireUser();
  if (session.role !== "STUDENT") return { enterClass: false };

  const [me] = await db
    .select({ lastSeenAt: users.lastSeenAt, classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "STUDENT")))
    .limit(1);
  if (!me) return { enterClass: false };

  const requestedAt = me.classFocus?.enterClassAt;
  const now = new Date();
  const shouldRefreshPresence =
    !me.lastSeenAt || now.getTime() - me.lastSeenAt.getTime() >= 20_000;

  if (requestedAt) {
    // Удаляем только служебное поле прямо в jsonb: параллельная команда
    // фокуса не потеряет секцию, игру или объект доски.
    await db
      .update(users)
      .set({
        lastSeenAt: now,
        classFocus: sql`coalesce(${users.classFocus}, '{}'::jsonb) - 'enterClassAt'`,
      })
      .where(and(eq(users.id, session.userId), eq(users.role, "STUDENT")));
  } else if (shouldRefreshPresence) {
    await db
      .update(users)
      .set({ lastSeenAt: now })
      .where(and(eq(users.id, session.userId), eq(users.role, "STUDENT")));
  }

  if (!requestedAt) return { enterClass: false };
  const requested = new Date(requestedAt).getTime();
  if (!Number.isFinite(requested) || now.getTime() - requested > 30_000) {
    return { enterClass: false };
  }

  const [teacher] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "TEACHER"),
        eq(users.classWithId, session.userId),
      ),
    )
    .limit(1);
  return { enterClass: Boolean(teacher) };
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
        classFocus: sql`(coalesce(${users.classFocus}, '{}'::jsonb) - 'timerState') - 'noteFocus'`,
      })
      .where(eq(users.id, teacher.studentId));
  }
  await db.update(users).set({ classWithId: null }).where(eq(users.id, session.userId));
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
  return {};
}

/** Правка, удаление и архивация — только своего сообщения либо учителем. */
async function ownMessage(id: string, userId: string, role: string) {
  const [row] = await db
    .select({ id: classMessages.id, authorId: classMessages.authorId })
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
  return {};
}

export async function archiveMessageAction(
  id: string,
  archived: boolean,
): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Архив ведёт учитель" };

  const [row] = await db
    .select({ id: classMessages.id })
    .from(classMessages)
    .where(eq(classMessages.id, String(id ?? "")))
    .limit(1);
  if (!row) return { error: "Сообщение не найдено" };

  await db
    .update(classMessages)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(classMessages.id, row.id));
  return {};
}

export type QuickVerb = {
  base: string;
  past: string;
  participle: string;
  translation: string | null;
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
  await requireUser();

  const rows = await db.execute<{
    base: string;
    past: string;
    participle: string;
    translation: string | null;
  }>(sql`
    select distinct on (lower(base), lower(past), lower(participle))
      base, past, participle, translation
    from irregular_verbs
    order by lower(base), lower(past), lower(participle)
  `);

  const byKey = new Map<string, QuickVerb>();
  for (const v of IRREGULAR_VERBS_BASE) {
    byKey.set(verbKey(v), { ...v, own: false });
  }
  for (const v of rows.rows) {
    const key = verbKey(v);
    byKey.set(key, {
      base: v.base,
      past: v.past,
      participle: v.participle,
      translation: v.translation ?? byKey.get(key)?.translation ?? null,
      own: true,
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.base.localeCompare(b.base, "en") ||
      a.past.localeCompare(b.past, "en"),
  );
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
};

/**
 * Узнать, какой урок сейчас открыт в классе. Панели у каждого свои:
 * сервер больше не хранит и не пересылает переключения нижнего меню.
 */
export async function classSyncAction(onBoard = false): Promise<ClassSync> {
  const session = await requireUser();

  await db
    .update(users)
    .set({ classWhere: onBoard ? "board" : null, lastSeenAt: new Date() })
    .where(eq(users.id, session.userId));

  const [me] = await db
    .select({
      role: users.role,
      classWithId: users.classWithId,
      classFocus: users.classFocus,
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
    };
  }

  // У учителя собеседник записан в поле, у ученика — тот, кто выбрал его.
  const [partner] =
    me.role === "TEACHER"
      ? me.classWithId
        ? await db
            .select({ id: users.id, classWhere: users.classWhere, classFocus: users.classFocus })
            .from(users)
            .where(eq(users.id, me.classWithId))
            .limit(1)
        : []
      : await db
          .select({ id: users.id, classWhere: users.classWhere, classFocus: users.classFocus })
          .from(users)
          .where(and(eq(users.classWithId, session.userId), eq(users.role, "TEACHER")))
          .limit(1);

  const studentId = me.role === "TEACHER" ? me.classWithId : session.userId;
  const vocabularyEvents = studentId
    ? await db
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
    const consumed = { ...me.classFocus };
    delete consumed.view;
    delete consumed.at;
    delete consumed.boardObjectId;
    delete consumed.boardCommand;
    delete consumed.lessonSection;
    delete consumed.lessonElementId;
    if (consumed.videoState?.focusAt) {
      const videoState = { ...consumed.videoState };
      delete videoState.focusAt;
      consumed.videoState = videoState;
    }
    await db
      .update(users)
      .set({ classFocus: consumed })
      .where(
        and(
          eq(users.id, session.userId),
          eq(users.role, "STUDENT"),
          sql`${users.classFocus}->>'at' = ${storedView.at}`,
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
    noteFocus,
    vocabularyEvents: vocabularyEvents.map((event) => ({
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

  await db
    .update(users)
    .set({
      classFocus: {
        at: new Date().toISOString(),
        view: "GAME",
        ...(requestedGameId ? { gameId: requestedGameId } : {}),
        // Урок помним: закончится игра — ученику будет куда вернуться.
        ...(student.classFocus?.lessonAssignmentId
          ? { lessonAssignmentId: student.classFocus.lessonAssignmentId }
          : {}),
      },
    })
    .where(eq(users.id, me.classWithId));

  return {};
}
