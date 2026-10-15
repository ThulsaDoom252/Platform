/** Create only the requested C1 template. Dry-run by default; no assignment or class writes. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool } from "pg";
import { buildC1VagueLanguageLesson } from "../src/lib/bundled-lessons/c1-vague-language";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const C1_FOLDER_ID = "cf009afe-08c3-4546-bc20-09093da8183d";
const FEELINGS_ID = "b445f24f-113f-4e62-8ad5-7c146f9776a5";

export function vagueLanguageImportApply(args: string[]) {
  assert(args.every(argument => argument === "--apply"), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  return args.includes("--apply");
}

async function main() {
  const apply = vagueLanguageImportApply(process.argv.slice(2));
  const lesson = buildC1VagueLanguageLesson(readFileSync(new URL("./fixtures/c1-feelings-student.html", import.meta.url), "utf8"));
  assert.equal(lesson.words.length, 36);
  assert.equal(lesson.sections.length, 13);
  assert.equal(publicRegularLessonSections(lesson.sections).length, 12);
  assert.equal(lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0), 64);
  assert.equal(lesson.homework[0].exercises.reduce((sum, exercise) => sum + exercise.items.length, 0), 17);
  assert.deepEqual(defaultRegularOpenSections(lesson.sections), ["regular:vague-vocabulary"]);
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "c1-vague-language-import" });
  const client = await pool.connect();
  let transactionOpen = false;
  const wordContent = lesson.words.map(word => ({
    word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
    translation: word.translation, description: word.description, note: word.note, examples: word.examples,
    section_color: word.sectionColor, image_url: word.imageUrl,
  }));
  try {
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:C1:${lesson.title}`]);
    }
    const { rows: owner } = await client.query("SELECT id,name,role,access_blocked FROM public.users WHERE id=$1", [AUTHOR_ID]);
    assert(owner.length === 1 && owner[0].name === "Vlad" && owner[0].role === "TEACHER" && !owner[0].access_blocked, "Exact teacher unavailable");
    const { rows: folders } = await client.query("SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='C1'", [AUTHOR_ID]);
    assert(folders.length === 1 && folders[0].id === C1_FOLDER_ID && folders[0].name === "C1", "Exact existing C1 folder missing or ambiguous");
    const { rows: source } = await client.query("SELECT id,title,kind,folder_id FROM public.lesson_units WHERE id=$1 AND author_id=$2", [FEELINGS_ID, AUTHOR_ID]);
    assert(source.length === 1 && source[0].title === "C1 · Feelings and emotions" && source[0].kind === "REGULAR" && source[0].folder_id === C1_FOLDER_ID, "Exact Feelings reference missing");
    const wordColumns = "word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url";
    const { rows: sourceWords } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [FEELINGS_ID]);
    assert(isDeepStrictEqual(sourceWords, wordContent.slice(20).map(word => ({ ...word, category: word.category.replace(/^Review · Feelings · /, "") }))), "Feelings reference vocabulary changed; preserve and review source before import");

    const snapshot = async () => ({
      units: (await client.query("SELECT id,md5(to_jsonb(l)::text) AS digest FROM public.lesson_units l WHERE author_id=$1 ORDER BY id", [AUTHOR_ID])).rows,
      words: (await client.query("SELECT w.id,md5(to_jsonb(w)::text) AS digest FROM public.lesson_words w INNER JOIN public.lesson_units l ON l.id=w.unit_id WHERE l.author_id=$1 ORDER BY w.id", [AUTHOR_ID])).rows,
      assignments: (await client.query("SELECT id,md5(to_jsonb(a)::text) AS digest FROM public.lesson_assignments a ORDER BY id")).rows,
      classState: (await client.query("SELECT id,class_with_id,class_focus FROM public.users ORDER BY id")).rows,
    });
    const before = await snapshot();
    const { rows: existing } = await client.query("SELECT id,title,kind,description,folder_id,sections,homework FROM public.lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('c1vaguelanguage','vaguelanguage')", [AUTHOR_ID]);
    assert(existing.length <= 1, "Duplicate Vague language lessons; refusing to guess");
    const previous = existing[0];
    const lessonId = previous?.id ?? (apply ? randomUUID() : null);
    if (previous) {
      assert(previous.title === lesson.title && previous.kind === "REGULAR" && previous.folder_id === C1_FOLDER_ID, "Existing template identity differs; preserving teacher edits");
      assert(previous.description === lesson.description && isDeepStrictEqual(previous.sections, lesson.sections) && isDeepStrictEqual(previous.homework, lesson.homework), "Existing template differs; preserving teacher edits");
      const { rows: savedWords } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert(isDeepStrictEqual(savedWords, wordContent), "Existing Vague language vocabulary differs; preserving teacher edits");
    } else if (apply) {
      const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, C1_FOLDER_ID]);
      await client.query(`INSERT INTO public.lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
        VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [lessonId, AUTHOR_ID, lesson.title, lesson.description, C1_FOLDER_ID, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
      for (const [index, word] of wordContent.entries()) {
        await client.query(`INSERT INTO public.lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [randomUUID(), lessonId, word.category, word.icon, word.word, word.ipa_us, word.ipa_uk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.section_color, word.image_url, index + 1]);
      }
    }
    if (lessonId) {
      const { rows: saved } = await client.query("SELECT title,kind,description,folder_id,sections,homework FROM public.lesson_units WHERE id=$1 AND author_id=$2", [lessonId, AUTHOR_ID]);
      assert.equal(saved.length, 1);
      assert.deepEqual(saved[0], { title: lesson.title, kind: "REGULAR", description: lesson.description, folder_id: C1_FOLDER_ID, sections: lesson.sections, homework: lesson.homework });
      const { rows: savedWords } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert(isDeepStrictEqual(savedWords, wordContent), "New vocabulary verification failed");
    }
    const after = await snapshot();
    const oldUnitIds = new Set(before.units.map(row => row.id));
    const oldWordIds = new Set(before.words.map(row => row.id));
    assert.deepEqual(after.units.filter(row => oldUnitIds.has(row.id)), before.units, "Existing lessons changed; rolling back");
    assert.deepEqual(after.words.filter(row => oldWordIds.has(row.id)), before.words, "Existing vocabulary changed; rolling back");
    assert.equal(after.units.length, before.units.length + (apply && !previous ? 1 : 0));
    assert.equal(after.words.length, before.words.length + (apply && !previous ? 36 : 0));
    assert.deepEqual(after.assignments, before.assignments, "Student assignments or work changed; rolling back");
    assert.deepEqual(after.classState, before.classState, "Current classes changed; rolling back");
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", title: lesson.title, lessonId, folder: "C1", folderId: C1_FOLDER_ID,
      existing: Boolean(previous), wouldCreateLesson: !previous, newExpressions: 20, feelingsReviewWords: 16,
      words: lesson.words.length, teacherSections: 13, studentSections: 12, automaticLessonAnswers: 64,
      homeworkExercises: lesson.homework[0].exercises.length, homeworkItems: 17,
      existingLessonsPreserved: before.units.length, existingVocabularyPreserved: before.words.length,
      existingAssignmentsPreserved: before.assignments.length, currentClassesPreserved: true,
      studentAssignmentsCreated: 0, notificationsSent: false, existingContentOverwritten: false,
      lessonHref: lessonId ? `/teacher/lessons/${lessonId}` : null,
    }, null, 2));
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: { name?: string; code?: string; message?: string }) => {
    console.error({ stage: "create-c1-vague-language", type: error.name, code: error.code,
      ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
