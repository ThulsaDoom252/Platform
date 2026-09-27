"use server";

/**
 * Скороговорки: общий пул картинок и выдача их ученикам.
 *
 * Пул один на учителя — скороговорка не принадлежит ученику, её просто
 * дают то одному, то другому. Поэтому выдача живёт отдельной таблицей
 * и копится историей: по ней видно, что ту же карточку уже показывали,
 * сколько раз и когда в последний.
 */
import { revalidatePath } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tongueTwisters, tongueTwisterAssignments, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export type Twister = {
  id: string;
  title: string | null;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
};

export type TwisterState = { ok?: boolean; error?: string; added?: number };

/** Сколько раз эта скороговорка уже была у ученика и когда в последний. */
export type TwisterSeen = { times: number; lastAt: string | null };

export type TwisterHistoryRow = {
  id: string;
  twisterId: string;
  title: string | null;
  imageUrl: string;
  assignedAt: string;
  pinned: boolean;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

function toTwister(row: typeof tongueTwisters.$inferSelect): Twister {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Весь пул в ручном порядке. */
export async function listTwistersAction(): Promise<Twister[]> {
  await requireTeacher();
  const rows = await db
    .select()
    .from(tongueTwisters)
    .orderBy(asc(tongueTwisters.sortOrder), desc(tongueTwisters.createdAt));
  return rows.map(toTwister);
}

/**
 * Загрузка картинок. Сразу нескольких: скороговорки снимают пачкой,
 * и по одной их добавлять — мучение.
 */
export async function uploadTwistersAction(formData: FormData): Promise<TwisterState> {
  await requireTeacher();

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Не выбрано ни одной картинки" };

  const [{ value: last = 0 } = { value: 0 }] = await db
    .select({ value: sql<number>`coalesce(max(${tongueTwisters.sortOrder}), 0)::int` })
    .from(tongueTwisters);

  const dir = path.join(process.cwd(), "public", "uploads", "twisters");
  await fs.mkdir(dir, { recursive: true });

  let order = Number(last);
  let added = 0;

  for (const file of files) {
    const ext = MIME_EXT[file.type];
    if (!ext) return { error: "Поддерживаются PNG, JPEG, WebP и GIF" };
    if (file.size > MAX_IMAGE_BYTES) return { error: "Картинка больше 8 МБ" };

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

    order += 1;
    added += 1;
    await db.insert(tongueTwisters).values({
      // Имя файла в названии не помогает: у снимка оно вроде IMG_4821.
      title: null,
      imageUrl: `/uploads/twisters/${fileName}`,
      sortOrder: order,
    });
  }

  revalidatePath("/teacher/tongue-twisters");
  return { ok: true, added };
}

/** Название — необязательное, пустое стирает прежнее. */
export async function renameTwisterAction(
  id: string,
  title: string,
): Promise<TwisterState> {
  await requireTeacher();
  const twisterId = String(id ?? "");
  if (!twisterId) return { error: "Не выбрана скороговорка" };

  await db
    .update(tongueTwisters)
    .set({ title: String(title ?? "").trim().slice(0, 200) || null })
    .where(eq(tongueTwisters.id, twisterId));

  revalidatePath("/teacher/tongue-twisters");
  return { ok: true };
}

/** Новый порядок пула целиком: приходит список id в нужной последовательности. */
export async function reorderTwistersAction(ids: string[]): Promise<TwisterState> {
  await requireTeacher();
  const order = (ids ?? []).map(String).filter(Boolean);
  if (order.length === 0) return { error: "Пустой порядок" };

  await Promise.all(
    order.map((id, i) =>
      db.update(tongueTwisters).set({ sortOrder: i + 1 }).where(eq(tongueTwisters.id, id)),
    ),
  );

  revalidatePath("/teacher/tongue-twisters");
  return { ok: true };
}

/**
 * Удаление из пула. Файл остаётся на диске: та же картинка может быть
 * записана в истории у ученика, и терять её вместе со строкой нельзя.
 */
export async function deleteTwisterAction(id: string): Promise<TwisterState> {
  await requireTeacher();
  const twisterId = String(id ?? "");
  if (!twisterId) return { error: "Не выбрана скороговорка" };

  await db.delete(tongueTwisters).where(eq(tongueTwisters.id, twisterId));
  revalidatePath("/teacher/tongue-twisters");
  return { ok: true };
}

/**
 * Сколько раз скороговорка уже была у каждого ученика.
 *
 * Возвращается разом по всем ученикам: предупреждение нужно показать
 * до выбора, а не после, — иначе учитель узнаёт о повторе, уже нажав.
 */
export async function twisterSeenByStudentAction(
  twisterId: string,
): Promise<Record<string, TwisterSeen>> {
  await requireTeacher();
  const id = String(twisterId ?? "");
  if (!id) return {};

  const rows = await db
    .select({
      studentId: tongueTwisterAssignments.studentId,
      times: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${tongueTwisterAssignments.assignedAt})`,
    })
    .from(tongueTwisterAssignments)
    .where(eq(tongueTwisterAssignments.twisterId, id))
    .groupBy(tongueTwisterAssignments.studentId);

  return Object.fromEntries(
    rows.map((r) => [
      r.studentId,
      { times: Number(r.times), lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null },
    ]),
  );
}

/**
 * Закрепить скороговорку ученику.
 *
 * Закреплённая всегда одна: на уроке смотрят на одну карточку. Прошлые
 * строки не трогаем — они и есть история.
 */
export async function assignTwisterAction(
  twisterId: string,
  studentId: string,
): Promise<TwisterState> {
  await requireTeacher();
  const twister = String(twisterId ?? "");
  const student = String(studentId ?? "");
  if (!twister || !student) return { error: "Не выбрана скороговорка или ученик" };

  await db
    .update(tongueTwisterAssignments)
    .set({ pinned: false })
    .where(
      and(
        eq(tongueTwisterAssignments.studentId, student),
        eq(tongueTwisterAssignments.pinned, true),
      ),
    );

  await db
    .insert(tongueTwisterAssignments)
    .values({ twisterId: twister, studentId: student, pinned: true });

  revalidatePath("/teacher/tongue-twisters");
  revalidatePath("/teacher/class");
  return { ok: true };
}

/** Снять закрепление, не стирая историю. */
export async function unpinTwisterAction(studentId: string): Promise<TwisterState> {
  await requireTeacher();
  const student = String(studentId ?? "");
  if (!student) return { error: "Не выбран ученик" };

  await db
    .update(tongueTwisterAssignments)
    .set({ pinned: false })
    .where(
      and(
        eq(tongueTwisterAssignments.studentId, student),
        eq(tongueTwisterAssignments.pinned, true),
      ),
    );

  revalidatePath("/teacher/class");
  return { ok: true };
}

/** Та, что сейчас на уроке у этого ученика. */
export async function pinnedTwisterAction(studentId: string): Promise<Twister | null> {
  await requireTeacher();
  const student = String(studentId ?? "");
  if (!student) return null;

  const [row] = await db
    .select({ twister: tongueTwisters })
    .from(tongueTwisterAssignments)
    .innerJoin(tongueTwisters, eq(tongueTwisters.id, tongueTwisterAssignments.twisterId))
    .where(
      and(
        eq(tongueTwisterAssignments.studentId, student),
        eq(tongueTwisterAssignments.pinned, true),
      ),
    )
    .orderBy(desc(tongueTwisterAssignments.assignedAt))
    .limit(1);

  return row ? toTwister(row.twister) : null;
}

/** Что и когда этот ученик уже получал — от свежего к старому. */
export async function twisterHistoryAction(
  studentId: string,
  limit = 100,
): Promise<TwisterHistoryRow[]> {
  await requireTeacher();
  const student = String(studentId ?? "");
  if (!student) return [];

  const rows = await db
    .select({
      id: tongueTwisterAssignments.id,
      twisterId: tongueTwisterAssignments.twisterId,
      title: tongueTwisters.title,
      imageUrl: tongueTwisters.imageUrl,
      assignedAt: tongueTwisterAssignments.assignedAt,
      pinned: tongueTwisterAssignments.pinned,
    })
    .from(tongueTwisterAssignments)
    .innerJoin(tongueTwisters, eq(tongueTwisters.id, tongueTwisterAssignments.twisterId))
    .where(eq(tongueTwisterAssignments.studentId, student))
    .orderBy(desc(tongueTwisterAssignments.assignedAt))
    .limit(Math.min(300, Math.max(1, limit)));

  return rows.map((r) => ({
    id: r.id,
    twisterId: r.twisterId,
    title: r.title,
    imageUrl: r.imageUrl,
    assignedAt: r.assignedAt.toISOString(),
    pinned: r.pinned,
  }));
}

export type TwisterStudent = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

/** Ученики для выбора получателя. */
export async function twisterStudentsAction(): Promise<TwisterStudent[]> {
  await requireTeacher();
  const rows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .orderBy(asc(users.name));
  return rows;
}
