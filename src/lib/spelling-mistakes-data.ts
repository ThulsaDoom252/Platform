import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { classLessonNotes } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import type { SpellingExample, SpellingPartOfSpeech } from "@/lib/spelling-mistake";

export type PublishedSpellingMistake = {
  id: string;
  english: string;
  translation: string;
  translationLang: "RU" | "UK";
  partOfSpeech: SpellingPartOfSpeech;
  icon: string;
  examples: SpellingExample[];
  publishedAt: string;
  occurrences: number;
};

/** Published spelling notes are the only class notes a student can read outside a focus. */
export async function getPublishedSpellingMistakes(
  requestedStudentId?: string,
): Promise<PublishedSpellingMistake[]> {
  const session = await getSession();
  if (!session) return [];
  const studentId = session.role === "STUDENT" ? session.userId : requestedStudentId;
  if (!studentId) return [];

  const rows = await db
    .select()
    .from(classLessonNotes)
    .where(
      and(
        eq(classLessonNotes.studentId, studentId),
        eq(classLessonNotes.kind, "SPELLING"),
        isNotNull(classLessonNotes.publishedAt),
      ),
    )
    .orderBy(desc(classLessonNotes.publishedAt), desc(classLessonNotes.createdAt));

  const unique = new Map<string, PublishedSpellingMistake>();
  for (const row of rows) {
    const key = row.body.trim().toLocaleLowerCase("en");
    const existing = unique.get(key);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    const partOfSpeech: SpellingPartOfSpeech =
      row.partOfSpeech === "ADJECTIVE" ||
      row.partOfSpeech === "VERB" ||
      row.partOfSpeech === "PHRASE"
        ? row.partOfSpeech
        : "NOUN";
    unique.set(key, {
      id: row.id,
      english: row.body,
      translation: row.translation ?? "—",
      translationLang: row.translationLang,
      partOfSpeech,
      icon: row.icon ?? "✏️",
      examples: (row.examples ?? []) as SpellingExample[],
      publishedAt: row.publishedAt!.toISOString(),
      occurrences: 1,
    });
  }

  const order: Record<SpellingPartOfSpeech, number> = {
    NOUN: 0,
    ADJECTIVE: 1,
    VERB: 2,
    PHRASE: 3,
  };
  return [...unique.values()].sort(
    (a, b) =>
      order[a.partOfSpeech] - order[b.partOfSpeech] ||
      a.english.localeCompare(b.english, "en", { sensitivity: "base" }),
  );
}
