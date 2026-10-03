import "dotenv/config";
import { randomUUID } from "node:crypto";
import { asc, eq, ilike } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonAssignments, lessonUnits, lessonWords, users } from "../src/lib/db/schema";
import {
  grammarCheckSections,
  grammarCheckVocabulary,
} from "../src/lib/bundled-lessons/grammar-check";
import { regularSectionKey } from "../src/lib/regular-lesson";

const title = "Grammar Check";

async function main() {
  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  const [existing] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(ilike(lessonUnits.title, title))
    .limit(1);

  const values = {
    kind: "REGULAR",
    title,
    description: "A2 grammar review · tenses, good vs well, infinitives, translation and native voice practice",
    vocabNodeId: null,
    lexis: null,
    videoUrl: null,
    videoTitle: null,
    transcript: [],
    questions: { afterVideo: [], afterReading: [] },
    homework: [],
    activityIds: [],
    sections: grammarCheckSections,
    updatedAt: new Date(),
  };

  const unitId = existing?.id
    ? (await db
        .update(lessonUnits)
        .set(values)
        .where(eq(lessonUnits.id, existing.id))
        .returning({ id: lessonUnits.id }))[0]?.id
    : (await db
        .insert(lessonUnits)
        .values({ authorId: author.id, ...values })
        .returning({ id: lessonUnits.id }))[0]?.id;
  if (!unitId) throw new Error("Could not save Grammar Check lesson");

  await db.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
  await db.insert(lessonWords).values(
    grammarCheckVocabulary.map((entry, index) => ({
      id: randomUUID(),
      unitId,
      ...entry,
      imageUrl: null,
      sortOrder: index + 1,
    })),
  );

  const assignments = await db
    .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
    .from(lessonAssignments)
    .where(eq(lessonAssignments.unitId, unitId));
  for (const assignment of assignments) {
    const open = new Set(assignment.openSections ?? []);
    open.add(regularSectionKey("01-vocabulary"));
    await db
      .update(lessonAssignments)
      .set({ openSections: [...open], updatedAt: new Date() })
      .where(eq(lessonAssignments.id, assignment.id));
  }

  console.log(JSON.stringify({
    id: unitId,
    title,
    kind: "REGULAR",
    author: author.name,
    words: grammarCheckVocabulary.length,
    sections: grammarCheckSections.length,
    checkedSentences: 8 + 8 + 8 + 6 + 8 + 8,
    voiceExercises: grammarCheckSections.filter((section) => section.voiceExercise).length,
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
