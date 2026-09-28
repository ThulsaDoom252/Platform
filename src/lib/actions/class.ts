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
import { and, asc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, classMessages, lessons, lessonPackages } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { IRREGULAR_VERBS_BASE, verbKey } from "@/lib/irregular-verbs-base";

/** Сколько отметка держится за «онлайн». */
const ONLINE_WINDOW_MS = 75_000;

export type Presence = "online" | "offline";

export type ClassPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  level: string | null;
  presence: Presence;
  /** Учитель уже ведёт класс с этим учеником. */
  inClass: boolean;
  unread: number;
  /** Ближайшее занятие — по нему строится порядок списка. */
  nextLessonAt: string | null;
  /** Остаток уроков: у общего пакета — общий, иначе личный. */
  balance: number;
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

const isOnline = (seen: Date | null) =>
  !!seen && Date.now() - seen.getTime() < ONLINE_WINDOW_MS;

/**
 * Отметиться живым и узнать обстановку.
 *
 * Один вызов вместо трёх: браузер и так дёргает его по таймеру, и
 * отдельные запросы на статус собеседника только множили бы трафик.
 */
export async function heartbeatAction(): Promise<{
  role: "TEACHER" | "STUDENT";
  partner: { id: string; name: string; presence: Presence } | null;
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
          .select({ id: users.id, name: users.name, lastSeenAt: users.lastSeenAt })
          .from(users)
          .where(eq(users.id, me.classWithId))
          .limit(1)
      : []
    : await db
        .select({ id: users.id, name: users.name, lastSeenAt: users.lastSeenAt })
        .from(users)
        .where(eq(users.classWithId, session.userId))
        .limit(1);

  const studentId = role === "TEACHER" ? (me?.classWithId ?? null) : session.userId;

  let unread = 0;
  if (studentId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(classMessages)
      .where(
        and(
          eq(classMessages.studentId, studentId),
          ne(classMessages.authorId, session.userId),
          isNull(classMessages.readAt),
          isNull(classMessages.deletedAt),
        ),
      );
    unread = row?.n ?? 0;
  }

  return {
    role,
    partner: partnerRow
      ? {
          id: partnerRow.id,
          name: partnerRow.name,
          presence: isOnline(partnerRow.lastSeenAt) ? "online" : "offline",
        }
      : null,
    unread,
  };
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
   * Ближайшее назначенное занятие каждого.
   *
   * Время берём обычной выборкой столбца, а не через min() в запросе:
   * сырое выражение возвращает строку без пояса, и она разъезжается с
   * тем, что показывает расписание, ровно на местное смещение. Ближайшее
   * занятие выбираем здесь — сортировка уже сделала всю работу.
   *
   * Одним запросом на всех: список обновляется на каждом такте опроса,
   * и ходить в базу за каждым учеником отдельно тут нельзя.
   */
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const upcoming = await db
    .select({ studentId: lessons.studentId, startTime: lessons.startTime })
    .from(lessons)
    .where(and(eq(lessons.status, "SCHEDULED"), gte(lessons.startTime, dayStart)))
    .orderBy(asc(lessons.startTime));

  const nextOf = new Map<string, string>();
  for (const row of upcoming) {
    if (!nextOf.has(row.studentId)) {
      nextOf.set(row.studentId, row.startTime.toISOString());
    }
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
    nextLessonAt: nextOf.get(r.id) ?? null,
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

  await db.update(users).set({ classWithId: id }).where(eq(users.id, session.userId));
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return {};
}

/** Выйти из класса — учитель возвращается к выбору ученика. */
export async function leaveClassAction(): Promise<{ error?: string }> {
  const session = await requireUser();
  if (session.role !== "TEACHER") return { error: "Класс ведёт учитель" };

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
