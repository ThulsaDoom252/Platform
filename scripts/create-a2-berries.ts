/** Create only the requested lesson. Read-only dry run unless --apply. No student assignments or notifications. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool } from "pg";
import { berriesLessonFromHtml } from "../src/lib/bundled-lessons/a2-berries";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap, type RegularLessonSection } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const FOLDER_ID = "e06206f5-3b7c-4890-8db0-06562d82cd5b";
const apply = process.argv.includes("--apply");
const files = process.argv.slice(2).filter(argument => argument !== "--apply");

async function main() {
  const [student, teacher] = await Promise.all([
    readFile(files[0] ?? "C:/Users/ThulsaDoom/Desktop/Victoria_Lesson03_Fruit_STUDENT.html", "utf8"),
    readFile(files[1] ?? "C:/Users/ThulsaDoom/Desktop/Victoria_Lesson03_Fruit_TEACHER.html", "utf8"),
  ]);
  const lesson = berriesLessonFromHtml(student, teacher);
  const plan = lesson.homework[0];
  const vocabulary = plan.exercises.filter(exercise => exercise.id.startsWith("berries-vocab-"));
  assert.deepEqual(vocabulary.filter(exercise => !exercise.optional).map(exercise => exercise.items.length), [8, 7, 7]);
  assert.equal(new Set(vocabulary.flatMap(exercise => exercise.items.map(item => item.vocabularyWord))).size, 22);
  assert(lesson.words.every(word => word.translation && word.note && word.description && word.ipaUs && word.ipaUk && word.examples.length));
  assert.equal(publicRegularLessonSections(lesson.sections).length, 9);
  assert(publicRegularLessonSections(lesson.sections).every(section => !section.teacherHtml));
  assert.equal(defaultRegularOpenSections(lesson.sections).length, 1);
  const answerCounts = lesson.sections.map(section => {
    const controls = (section.studentHtml.match(/class=["'][^"']*\b(?:blank|tfbox)\b/gi) ?? []).length;
    const answers = regularAnswerMap(section).size;
    assert.equal(answers, controls, `Missing answer keys in ${section.title}`);
    return { title: section.title, answers };
  });
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Database placeholder; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 10_000, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:${lesson.title}`]);
    }
    const { rows: owner } = await client.query("SELECT id FROM users WHERE id=$1 AND role='TEACHER'", [AUTHOR_ID]);
    assert.equal(owner.length, 1, "Exact teacher account missing");
    const { rows: folder } = await client.query("SELECT id,name FROM lesson_folders WHERE id=$1 AND author_id=$2", [FOLDER_ID, AUTHOR_ID]);
    assert.equal(folder.length, 1, "Exact A2 folder missing");
    assert.equal(folder[0].name, "A2");
    const { rows: existing } = await client.query<{ id: string; kind: string; folder_id: string; sections: RegularLessonSection[]; homework: unknown }>(
      "SELECT id,kind,folder_id,sections,homework FROM lesson_units WHERE author_id=$1 AND title=$2", [AUTHOR_ID, lesson.title],
    );
    assert(existing.length <= 1, "Duplicate lessons found; refusing to overwrite");
    const id = existing[0]?.id ?? randomUUID();
    if (existing.length) {
      assert.equal(existing[0].kind, "REGULAR");
      assert.equal(existing[0].folder_id, FOLDER_ID);
      assert(isDeepStrictEqual(existing[0].sections, lesson.sections) && isDeepStrictEqual(existing[0].homework, lesson.homework), "Lesson already exists with different content; preserving teacher edits");
    } else if (apply) {
      const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, FOLDER_ID]);
      await client.query(`INSERT INTO lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
        VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [id, AUTHOR_ID, lesson.title, lesson.description, FOLDER_ID, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
      for (const [index, word] of lesson.words.entries()) {
        await client.query(`INSERT INTO lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [randomUUID(), id, word.category, word.icon, word.word, word.ipaUs, word.ipaUk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.sectionColor, word.imageUrl, index + 1]);
      }
    }
    if (apply || existing.length) {
      const { rows: saved } = await client.query("SELECT sections,homework FROM lesson_units WHERE id=$1 AND author_id=$2 AND folder_id=$3 AND kind='REGULAR'", [id, AUTHOR_ID, FOLDER_ID]);
      assert.equal(saved.length, 1);
      assert.deepEqual(saved[0].sections, lesson.sections);
      assert.deepEqual(saved[0].homework, lesson.homework);
      const { rows: savedWords } = await client.query("SELECT category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM lesson_words WHERE unit_id=$1 ORDER BY sort_order", [id]);
      assert.deepEqual(savedWords, lesson.words.map(word => ({ category: word.category, icon: word.icon, word: word.word, ipa_us: word.ipaUs, ipa_uk: word.ipaUk, translation: word.translation, description: word.description, note: word.note, examples: word.examples, section_color: word.sectionColor, image_url: word.imageUrl })));
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", existing: !!existing.length, lessonId: apply || existing.length ? id : null, title: lesson.title, folder: folder[0].name,
      sections: lesson.sections.length, words: lesson.words.length, vocabularyGroups: vocabulary.map(exercise => exercise.items.length), homeworkExercises: plan.exercises.length,
      answerCounts, warmupClosed: true, studentAssignmentsChanged: false }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); await pool.end(); }
}

main().catch((error: { name?: string; code?: string; message?: string }) => {
  console.error({ stage: "create-a2-berries", type: error.name, code: error.code, ...(error.name === "AssertionError" || !error.code ? { message: error.message } : {}) });
  process.exitCode = 1;
});
