import "dotenv/config";

import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { and, eq, ilike, max, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonFolders, lessonUnits, lessonWords, users } from "../src/lib/db/schema";
import {
  BREAKING_BAD_FOLDER,
  WALT_MEETS_GUS_DESCRIPTION,
  WALT_MEETS_GUS_QUESTIONS,
  WALT_MEETS_GUS_TITLE,
  WALT_MEETS_GUS_TRANSCRIPT,
  WALT_MEETS_GUS_VIDEO_TITLE,
  WALT_MEETS_GUS_VIDEO_URL,
  validateWaltMeetsGusSource,
  waltMeetsGusVocabulary,
} from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus";

/** Insert-only installer. No existing lesson, material or student assignment is changed. */
async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : null;
  if (!sourcePath || sourcePath.startsWith("--")) {
    throw new Error("Supply --source <original transcript file>. Use --apply to install; otherwise this is a dry run.");
  }
  validateWaltMeetsGusSource(await readFile(sourcePath, "utf8"));
  const apply = args.includes("--apply");
  const teacherIndex = args.indexOf("--teacher");
  const teacherId = teacherIndex >= 0 ? args[teacherIndex + 1] : null;
  const teachers = await db.select({ id: users.id, name: users.name }).from(users)
    .where(teacherId ? and(eq(users.role, "TEACHER"), eq(users.id, teacherId)) : eq(users.role, "TEACHER"));
  if (teachers.length !== 1) throw new Error("Select exactly one teacher using --teacher <id>.");
  const teacher = teachers[0];
  const vocabulary = waltMeetsGusVocabulary();
  const expectedQuestions = { afterVideo: WALT_MEETS_GUS_QUESTIONS, afterReading: [] };

  const result = await db.transaction(async (tx) => {
    // Serialize repeated runs for this teacher/folder without overwriting anything.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${teacher.id}:${BREAKING_BAD_FOLDER}`}))`);
    const folders = await tx.select().from(lessonFolders)
      .where(and(eq(lessonFolders.authorId, teacher.id), ilike(lessonFolders.name, BREAKING_BAD_FOLDER)));
    if (folders.length > 1) throw new Error("More than one Breaking Bad folder exists; nothing changed.");
    const existing = await tx.select().from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, teacher.id), ilike(lessonUnits.title, WALT_MEETS_GUS_TITLE)));
    if (existing.length > 1) throw new Error("More than one matching lesson exists; nothing changed.");
    if (existing.length === 1) {
      const unit = existing[0];
      const words = await tx.select().from(lessonWords).where(eq(lessonWords.unitId, unit.id));
      const sameWords = words.length === vocabulary.length && vocabulary.every((expected, index) => {
        const saved = words.find((word) => word.sortOrder === index + 1);
        return saved && Object.entries(expected).every(([key, value]) =>
          isDeepStrictEqual(saved[key as keyof typeof saved], value));
      });
      if (unit.kind !== "ACTIVITY" || unit.folderId !== folders[0]?.id ||
        !isDeepStrictEqual(unit.transcript, WALT_MEETS_GUS_TRANSCRIPT) ||
        !isDeepStrictEqual(unit.questions, expectedQuestions) || !sameWords) {
        throw new Error("A different Walt meets Gus lesson already exists. Existing content left unchanged.");
      }
      return { status: "already-installed", id: unit.id, folderId: unit.folderId, video: unit.videoUrl };
    }
    if (!apply) return { status: "dry-run", id: null, folderId: folders[0]?.id ?? null, video: WALT_MEETS_GUS_VIDEO_URL };

    let folder = folders[0];
    if (!folder) {
      const [lastFolder] = await tx.select({ value: max(lessonFolders.sortOrder) }).from(lessonFolders)
        .where(eq(lessonFolders.authorId, teacher.id));
      [folder] = await tx.insert(lessonFolders).values({
        authorId: teacher.id, name: BREAKING_BAD_FOLDER, sortOrder: Number(lastFolder?.value ?? 0) + 10,
      }).returning();
    }
    const [lastLesson] = await tx.select({ value: max(lessonUnits.sortOrder) }).from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, teacher.id), eq(lessonUnits.folderId, folder.id)));
    const [unit] = await tx.insert(lessonUnits).values({
      authorId: teacher.id,
      kind: "ACTIVITY",
      title: WALT_MEETS_GUS_TITLE,
      description: WALT_MEETS_GUS_DESCRIPTION,
      folderId: folder.id,
      sortOrder: Number(lastLesson?.value ?? 0) + 10,
      vocabNodeId: null,
      lexis: [],
      videoUrl: WALT_MEETS_GUS_VIDEO_URL,
      videoTitle: WALT_MEETS_GUS_VIDEO_TITLE,
      transcript: WALT_MEETS_GUS_TRANSCRIPT,
      questions: expectedQuestions,
      homework: [],
      activityIds: [],
      sections: [],
    }).returning({ id: lessonUnits.id });
    await tx.insert(lessonWords).values(vocabulary.map((entry, index) => ({
      unitId: unit.id, ...entry, sortOrder: index + 1,
    })));
    return { status: "installed", id: unit.id, folderId: folder.id, video: WALT_MEETS_GUS_VIDEO_URL };
  });
  console.log(JSON.stringify({
    ...result,
    author: teacher.name,
    folder: BREAKING_BAD_FOLDER,
    title: WALT_MEETS_GUS_TITLE,
    words: vocabulary.length,
    transcriptLines: WALT_MEETS_GUS_TRANSCRIPT.length,
    questions: WALT_MEETS_GUS_QUESTIONS.length,
    studentAssignmentsChanged: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Lesson installation failed");
  process.exitCode = 1;
});
