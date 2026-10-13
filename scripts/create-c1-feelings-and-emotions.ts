/** Add only the requested C1 template. Dry-run by default; never overwrite edits or assign students. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool } from "pg";
import { feelingsLessonFromHtml } from "../src/lib/bundled-lessons/c1-feelings-and-emotions";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const apply = process.argv.includes("--apply");
assert(process.argv.slice(2).every(argument => argument === "--apply"), "Unknown argument");

async function main() {
  const lesson = feelingsLessonFromHtml(
    readFileSync(new URL("./fixtures/c1-feelings-student.html", import.meta.url), "utf8"),
    readFileSync(new URL("./fixtures/c1-feelings-teacher.html", import.meta.url), "utf8"),
  );
  assert.equal(lesson.words.length, 16);
  assert.equal(lesson.sections.length, 17);
  assert.equal(publicRegularLessonSections(lesson.sections).length, 16);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:feelings-01"]);
  assert.equal(lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0), 126);
  assert.equal(lesson.homework[0].exercises.length, 19);
  assert.equal(lesson.homework[0].exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 189);
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
  const client = await pool.connect();
  let folderId: string | null = null, lessonId: string | null = null, existed = false, folderCreated = false;
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:C1:${lesson.title}`]);
    }
    const { rows: owner } = await client.query("SELECT id FROM public.users WHERE id=$1 AND role='TEACHER' AND NOT access_blocked", [AUTHOR_ID]);
    assert.equal(owner.length, 1, "Exact teacher account missing");
    const { rows: folders } = await client.query("SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='C1'", [AUTHOR_ID]);
    assert(folders.length <= 1, "Duplicate C1 folders found; refusing to guess");
    folderId = folders[0]?.id ?? (apply ? randomUUID() : null);
    const { rows: existing } = await client.query("SELECT id,kind,title,folder_id,sections,homework FROM public.lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g')='c1feelingsandemotions'", [AUTHOR_ID]);
    assert(existing.length <= 1, "Duplicate lessons found; refusing to overwrite");
    existed = existing.length > 0;
    lessonId = existing[0]?.id ?? (apply ? randomUUID() : null);
    if (existed) {
      assert.equal(existing[0].kind, "REGULAR");
      assert.equal(existing[0].title, lesson.title);
      assert.equal(existing[0].folder_id, folderId);
      assert(isDeepStrictEqual(existing[0].sections, lesson.sections) && isDeepStrictEqual(existing[0].homework, lesson.homework), "Existing lesson differs; preserving teacher edits");
    } else if (apply) {
      if (!folders.length) {
        const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_folders WHERE author_id=$1", [AUTHOR_ID]);
        await client.query("INSERT INTO public.lesson_folders (id,author_id,name,sort_order) VALUES ($1,$2,'C1',$3)", [folderId, AUTHOR_ID, order[0].next]);
        folderCreated = true;
      }
      const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, folderId]);
      await client.query(`INSERT INTO public.lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
        VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [lessonId, AUTHOR_ID, lesson.title, lesson.description, folderId, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
      for (const [index, word] of lesson.words.entries()) await client.query(`INSERT INTO public.lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [randomUUID(), lessonId, word.category, word.icon, word.word, word.ipaUs, word.ipaUk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.sectionColor, word.imageUrl, index + 1]);
    }
    if (lessonId) {
      const { rows: saved } = await client.query("SELECT sections,homework FROM public.lesson_units WHERE id=$1 AND author_id=$2 AND folder_id=$3 AND kind='REGULAR'", [lessonId, AUTHOR_ID, folderId]);
      assert.equal(saved.length, 1);
      assert.deepEqual(saved[0].sections, lesson.sections);
      assert.deepEqual(saved[0].homework, lesson.homework);
      const { rows: words } = await client.query("SELECT word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order", [lessonId]);
      assert.deepEqual(words, lesson.words.map(word => ({ word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk, translation: word.translation, description: word.description, note: word.note, examples: word.examples, section_color: word.sectionColor, image_url: word.imageUrl })));
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", existing: existed, folder: "C1", folderId, folderCreated, lessonId, title: lesson.title, words: lesson.words.length,
      studentSections: 16, originalStudentSections: 15, teacherSections: 17, automaticLessonAnswers: 126, homeworkExercises: 19, homeworkItems: 189, fullHomeworkReferences: 8,
      studentAssignmentsChanged: false, notificationsSent: false, existingLessonsOverwritten: false }, null, 2));
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch((error: { name?: string; code?: string; message?: string }) => {
  console.error({ stage: "create-c1-feelings", type: error.name, code: error.code, ...(error.name === "AssertionError" || !error.code ? { message: error.message } : {}) });
  process.exitCode = 1;
});
