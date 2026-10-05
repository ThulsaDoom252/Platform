import "dotenv/config";

import { readFile } from "node:fs/promises";
import { asc, and, eq, ilike, isNull, max } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonUnits, users } from "../src/lib/db/schema";

function transcriptLines(source: string) {
  let slide = "Текст";

  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      const heading = /^СЛАЙД\s+(\d+)$/iu.exec(text);
      if (heading) {
        slide = `СЛАЙД ${heading[1]}`;
        return { speaker: "Слайд", text: heading[1] };
      }
      return { speaker: slide, text };
    });
}

async function main() {
  const sourcePath = process.argv[2];
  const title = String(process.argv[3] ?? "test").trim();
  if (!sourcePath) throw new Error("Pass the transcript text file path");
  if (!title) throw new Error("Lesson title cannot be empty");

  const source = await readFile(sourcePath, "utf8");
  const transcript = transcriptLines(source);
  if (transcript.length === 0) throw new Error("Transcript file is empty");

  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  const [existing] = await db
    .select({ id: lessonUnits.id, sortOrder: lessonUnits.sortOrder })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, author.id), ilike(lessonUnits.title, title)))
    .limit(1);

  const [lastRootLesson] = await db
    .select({ value: max(lessonUnits.sortOrder) })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, author.id), isNull(lessonUnits.folderId)));

  const values = {
    kind: "ACTIVITY" as const,
    title,
    description: null,
    folderId: null,
    sortOrder: existing?.sortOrder ?? Number(lastRootLesson?.value ?? 0) + 10,
    vocabNodeId: null,
    lexis: null,
    videoUrl: null,
    videoTitle: null,
    transcript,
    questions: { afterVideo: [], afterReading: [] },
    homework: [],
    activityIds: [],
    sections: [],
    updatedAt: new Date(),
  };

  const [lesson] = existing
    ? await db
        .update(lessonUnits)
        .set(values)
        .where(eq(lessonUnits.id, existing.id))
        .returning({ id: lessonUnits.id })
    : await db
        .insert(lessonUnits)
        .values({ authorId: author.id, ...values })
        .returning({ id: lessonUnits.id });

  if (!lesson) throw new Error("Could not save the lesson");

  console.log(JSON.stringify({
    id: lesson.id,
    title,
    kind: values.kind,
    author: author.name,
    transcriptLines: transcript.length,
    created: !existing,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
