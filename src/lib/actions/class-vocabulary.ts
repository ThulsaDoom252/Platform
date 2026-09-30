"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { classVocabularyWords, users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import {
  classVocabularyDirection,
  cleanClassVocabularyText,
  normalizeClassVocabularyLang,
  type ClassVocabularyLang,
} from "@/lib/class-vocabulary";
import { translateShortText } from "@/lib/material-translation";

export type ClassVocabularyWord = {
  id: string;
  english: string;
  translation: string;
  translationLang: ClassVocabularyLang;
  createdAt: string;
  updatedAt: string;
};

export type ClassVocabularyDraft = {
  english: string;
  translation: string;
  translationLang: ClassVocabularyLang;
  direction: "FROM_ENGLISH" | "TO_ENGLISH";
};

async function currentStudent(): Promise<{
  userId: string;
  studentId: string;
} | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "STUDENT") {
    return { userId: session.userId, studentId: session.userId };
  }

  const [teacher] = await db
    .select({ studentId: users.classWithId })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.role, "TEACHER")))
    .limit(1);
  if (!teacher?.studentId) return null;

  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, teacher.studentId), eq(users.role, "STUDENT")))
    .limit(1);
  return student ? { userId: session.userId, studentId: student.id } : null;
}

const wordOf = (row: typeof classVocabularyWords.$inferSelect): ClassVocabularyWord => ({
  id: row.id,
  english: row.english,
  translation: row.translation,
  translationLang: row.translationLang,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export async function listClassVocabularyAction(): Promise<ClassVocabularyWord[]> {
  const current = await currentStudent();
  if (!current) return [];
  const rows = await db
    .select()
    .from(classVocabularyWords)
    .where(eq(classVocabularyWords.studentId, current.studentId))
    .orderBy(desc(classVocabularyWords.createdAt));
  return rows.map(wordOf);
}

export async function translateClassVocabularyAction(
  value: string,
  rawLang: ClassVocabularyLang,
): Promise<{ draft?: ClassVocabularyDraft; error?: string }> {
  if (!(await currentStudent())) return { error: "Сначала выбери ученика" };
  const text = cleanClassVocabularyText(value);
  const direction = classVocabularyDirection(text);
  if (!text || !direction) return { error: "Введите слово или фразу" };
  const translationLang = normalizeClassVocabularyLang(rawLang);

  try {
    if (direction === "FROM_ENGLISH") {
      const translation = await translateShortText(text, translationLang, "EN");
      return {
        draft: { english: text, translation, translationLang, direction },
      };
    }
    const english = await translateShortText(text, "EN", translationLang);
    return {
      draft: { english, translation: text, translationLang, direction },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Не удалось получить перевод",
    };
  }
}

export async function addClassVocabularyAction(input: {
  english: string;
  translation: string;
  translationLang: ClassVocabularyLang;
}): Promise<{ word?: ClassVocabularyWord; error?: string }> {
  const current = await currentStudent();
  if (!current) return { error: "Сначала выбери ученика" };
  const english = cleanClassVocabularyText(input?.english);
  const translation = cleanClassVocabularyText(input?.translation);
  if (!english || !translation) return { error: "Заполните слово и перевод" };

  const [created] = await db
    .insert(classVocabularyWords)
    .values({
      studentId: current.studentId,
      addedById: current.userId,
      english,
      translation,
      translationLang: normalizeClassVocabularyLang(input?.translationLang),
    })
    .returning();
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return created ? { word: wordOf(created) } : { error: "Не удалось добавить слово" };
}

export async function updateClassVocabularyAction(
  id: string,
  input: { english: string; translation: string },
): Promise<{ word?: ClassVocabularyWord; error?: string }> {
  const current = await currentStudent();
  if (!current) return { error: "Сначала выбери ученика" };
  const english = cleanClassVocabularyText(input?.english);
  const translation = cleanClassVocabularyText(input?.translation);
  if (!english || !translation) return { error: "Заполните слово и перевод" };

  const [updated] = await db
    .update(classVocabularyWords)
    .set({ english, translation, updatedAt: new Date() })
    .where(
      and(
        eq(classVocabularyWords.id, String(id ?? "")),
        eq(classVocabularyWords.studentId, current.studentId),
      ),
    )
    .returning();
  if (!updated) return { error: "Запись не найдена" };
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
  return { word: wordOf(updated) };
}
