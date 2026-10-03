import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonUnits, lessonWords } from "../src/lib/db/schema";

const LESSON_TITLE = "Tucker and mendel";

const translations = new Map<string, string>([
  ["to imprison", "ув'язнювати"],
  ["autocracy", "автократія; самодержавство"],
  ["a disabled person", "людина з інвалідністю"],
  [
    "a person with an intellectual disability",
    "людина з порушеннями інтелектуального розвитку",
  ],
  ["to support", "підтримувати"],
  ["to come up", "з'являтися; виникати"],
  ["to come from", "походити з; бути родом з"],
  ["to come close", "наблизитися; майже досягти"],
  ["to conduct", "проводити; здійснювати"],
  ["to influence", "впливати"],
  ["multiple", "численні; декілька"],
  ["to include", "включати; містити"],
  ["capacity", "здатність; потужність; місткість"],
]);

async function main() {
  const [unit] = await db
    .select({ id: lessonUnits.id, title: lessonUnits.title })
    .from(lessonUnits)
    .where(eq(lessonUnits.title, LESSON_TITLE))
    .limit(1);
  if (!unit) throw new Error(`Lesson not found: ${LESSON_TITLE}`);

  const changed: { word: string; translation: string }[] = [];
  await db.transaction(async (tx) => {
    for (const [word, translation] of translations) {
      const rows = await tx
        .update(lessonWords)
        .set({ translation })
        .where(and(eq(lessonWords.unitId, unit.id), eq(lessonWords.word, word)))
        .returning({ word: lessonWords.word, translation: lessonWords.translation });
      changed.push(...rows.map((row) => ({
        word: row.word,
        translation: row.translation ?? "",
      })));
    }
  });

  if (changed.length !== translations.size) {
    throw new Error(`Expected ${translations.size} updates, received ${changed.length}`);
  }

  console.log(JSON.stringify({ lesson: unit, changed }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
