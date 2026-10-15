/** Create the requested native B1 lesson only. Dry-run by default; never assign student work. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { buildB1MoreDailyRoutinesLesson } from "../src/lib/bundled-lessons/b1-more-daily-routines";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SourceLesson = ReturnType<typeof buildB1MoreDailyRoutinesLesson>;
type StoredUnit = Record<string, unknown>;
type DigestRow = { id: string; digest: string };
export type DailyRoutinesPreservationSnapshot = {
  folders: DigestRow[];
  units: DigestRow[];
  words: DigestRow[];
  assignments: DigestRow[];
  classState: DigestRow[];
  standaloneHomework: DigestRow[];
  notifications: DigestRow[];
};
export type DailyRoutinesInsertionPlan = {
  newFolderId: string | null;
  newLessonId: string | null;
  newWordIds: string[];
};

export function dailyRoutinesImportApply(args: string[]): boolean {
  assert(args.every(argument => argument === "--apply"), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  return args.includes("--apply");
}

/** Compare LF/CRLF only, without normalizing or rewriting any stored content. */
function comparableContent(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(comparableContent);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparableContent(item)]));
  }
  return value;
}

export function assertDailyRoutinesJsonPortable(value: unknown): void {
  assert(isDeepStrictEqual(value, JSON.parse(JSON.stringify(value))), "Lesson content must be JSON portable without silent value loss");
}

/** An existing reviewed lesson is reused exactly; teacher edits are never overwritten. */
export function assertDailyRoutinesCanonicalUnit(unit: StoredUnit, lesson: SourceLesson, unitId: string, folderId: string): void {
  assert(UUID.test(unitId) && UUID.test(folderId), "Exact lesson and folder identities are required");
  const canonical = {
    id: unitId, author_id: AUTHOR_ID, kind: "REGULAR", title: lesson.title,
    description: lesson.description, folder_id: folderId,
    sections: lesson.sections, homework: lesson.homework,
  };
  assert(Object.entries(canonical).every(([key, value]) =>
    isDeepStrictEqual(comparableContent(unit[key]), comparableContent(value))),
  "Existing More daily routines template differs; preserving teacher edits");
}

function assertDigestRowsPreserved(before: DigestRow[], after: DigestRow[], insertedIds: string[], label: string): void {
  const oldIds = new Set(before.map(row => row.id));
  assert(oldIds.size === before.length && new Set(after.map(row => row.id)).size === after.length,
    `${label} contains duplicate identities; rolling back`);
  assert(insertedIds.every(id => UUID.test(id) && !oldIds.has(id)) && new Set(insertedIds).size === insertedIds.length,
    `${label} insertion identities are invalid; rolling back`);
  assert.deepEqual(after.filter(row => oldIds.has(row.id)), before, `${label} changed unexpectedly; rolling back`);
  const additions = after.filter(row => !oldIds.has(row.id)).map(row => row.id).sort();
  assert.deepEqual(additions, [...insertedIds].sort(), `${label} has unexpected additions or missing insertions; rolling back`);
}

/** Only the explicitly planned new folder, lesson and its nineteen words may be added. */
export function assertDailyRoutinesPreservation(
  before: DailyRoutinesPreservationSnapshot, after: DailyRoutinesPreservationSnapshot,
  plan: DailyRoutinesInsertionPlan = { newFolderId: null, newLessonId: null, newWordIds: [] },
): void {
  assert(plan.newLessonId ? plan.newWordIds.length === 19 : plan.newWordIds.length === 0,
    "Only one complete nineteen-word lesson may be inserted; rolling back");
  assert(!plan.newFolderId || plan.newLessonId, "A folder may only be inserted with the requested lesson; rolling back");
  assertDigestRowsPreserved(before.folders, after.folders, plan.newFolderId ? [plan.newFolderId] : [], "folders");
  assertDigestRowsPreserved(before.units, after.units, plan.newLessonId ? [plan.newLessonId] : [], "units");
  assertDigestRowsPreserved(before.words, after.words, plan.newWordIds, "words");
  for (const key of ["assignments", "classState", "standaloneHomework", "notifications"] as const) {
    assert.deepEqual(after[key], before[key], `${key} changed unexpectedly; rolling back`);
  }
}

async function snapshot(client: PoolClient): Promise<DailyRoutinesPreservationSnapshot> {
  return {
    folders: (await client.query("SELECT id,md5(to_jsonb(f)::text) AS digest FROM public.lesson_folders f ORDER BY id")).rows,
    units: (await client.query("SELECT id,md5(to_jsonb(l)::text) AS digest FROM public.lesson_units l ORDER BY id")).rows,
    words: (await client.query("SELECT id,md5(to_jsonb(w)::text) AS digest FROM public.lesson_words w ORDER BY id")).rows,
    assignments: (await client.query("SELECT id,md5(to_jsonb(a)::text) AS digest FROM public.lesson_assignments a ORDER BY id")).rows,
    classState: (await client.query(`SELECT id,md5(jsonb_build_object('class_with_id',class_with_id,'class_where',class_where,'class_focus',class_focus)::text) AS digest
      FROM public.users ORDER BY id`)).rows,
    standaloneHomework: (await client.query("SELECT id,md5(to_jsonb(h)::text) AS digest FROM public.homework h ORDER BY id")).rows,
    notifications: (await client.query("SELECT id,md5(to_jsonb(n)::text) AS digest FROM public.notifications n ORDER BY id")).rows,
  };
}

async function main() {
  const apply = dailyRoutinesImportApply(process.argv.slice(2));
  const lesson = buildB1MoreDailyRoutinesLesson();
  assert.equal(lesson.title, "B1 · More daily routines");
  assert.equal(lesson.words.length, 19, "All nineteen source vocabulary entries are required");
  assert.equal(new Set(lesson.words.map(word => word.word)).size, 19, "Vocabulary must contain distinct infinitive entries");
  assert.equal(lesson.homework.length, 1, "The reviewed homework plan is required");
  assertDailyRoutinesJsonPortable(lesson);
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert(publicSections.every(section => !section.teacherHtml && !section.teacherOnly), "Teacher keys must remain private");
  const automaticLessonAnswers = lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0);
  assert.equal(automaticLessonAnswers, 61, "Expected nineteen vocabulary, eighteen grammar and twenty-four true/false answers");
  const wordContent = lesson.words.map(word => ({
    word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
    translation: word.translation, description: word.description, note: word.note, examples: word.examples,
    section_color: word.sectionColor, image_url: word.imageUrl,
  }));
  assertDailyRoutinesJsonPortable(wordContent);
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000, application_name: "b1-more-daily-routines-import" });
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:lesson-folder:B1`]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:B1:${lesson.title}`]);
    }
    const { rows: owner } = await client.query(`SELECT id,name,role,access_blocked FROM public.users WHERE id=$1${apply ? " FOR UPDATE" : ""}`, [AUTHOR_ID]);
    assert(owner.length === 1 && owner[0].name === "Vlad" && owner[0].role === "TEACHER" && !owner[0].access_blocked,
      "Exact teacher unavailable");
    const { rows: folders } = await client.query(`SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='B1'${apply ? " FOR UPDATE" : ""}`, [AUTHOR_ID]);
    assert(folders.length <= 1 && (!folders[0] || folders[0].name === "B1"), "Existing B1 folder ambiguous or noncanonical; preserving teacher organization");
    const existingFolder = folders[0];
    const folderId: string | null = existingFolder?.id ?? (apply ? randomUUID() : null);
    const { rows: matches } = await client.query(`SELECT * FROM public.lesson_units WHERE author_id=$1
      AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('b1moredailyroutines','moredailyroutines')${apply ? " FOR UPDATE" : ""}`, [AUTHOR_ID]);
    assert(matches.length <= 1, "Duplicate More daily routines lessons; refusing to guess");
    const previous = matches[0] as StoredUnit | undefined;
    const lessonId = previous ? previous.id as string : apply ? randomUUID() : null;
    const wordColumns = "word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url";
    if (previous) {
      assert(folderId && lessonId, "Existing requested lesson has no exact B1 folder; preserving teacher organization");
      assertDailyRoutinesCanonicalUnit(previous, lesson, lessonId, folderId);
      const { rows: words } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert(isDeepStrictEqual(comparableContent(words), comparableContent(wordContent)), "Existing vocabulary differs; preserving teacher edits");
    }
    const before = await snapshot(client);
    const plan: DailyRoutinesInsertionPlan = { newFolderId: null, newLessonId: null, newWordIds: [] };
    if (apply && !previous) {
      assert(folderId && lessonId, "Missing reviewed insertion identities");
      if (!existingFolder) {
        const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_folders WHERE author_id=$1", [AUTHOR_ID]);
        await client.query("INSERT INTO public.lesson_folders (id,author_id,name,sort_order) VALUES ($1,$2,'B1',$3)", [folderId, AUTHOR_ID, order[0].next]);
        plan.newFolderId = folderId;
      }
      const { rows: order } = await client.query("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, folderId]);
      await client.query(`INSERT INTO public.lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
        VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [lessonId, AUTHOR_ID, lesson.title, lesson.description, folderId, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
      plan.newLessonId = lessonId;
      for (const [index, word] of wordContent.entries()) {
        const wordId = randomUUID();
        await client.query(`INSERT INTO public.lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [wordId, lessonId, word.category, word.icon, word.word, word.ipa_us, word.ipa_uk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.section_color, word.image_url, index + 1]);
        plan.newWordIds.push(wordId);
      }
    }
    if (lessonId) {
      assert(folderId, "Exact B1 folder missing");
      const { rows: savedFolders } = await client.query("SELECT id,author_id,name FROM public.lesson_folders WHERE id=$1", [folderId]);
      assert(savedFolders.length === 1 && savedFolders[0].author_id === AUTHOR_ID && savedFolders[0].name === "B1",
        "Saved B1 folder verification failed; rolling back");
      const { rows: saved } = await client.query("SELECT * FROM public.lesson_units WHERE id=$1 AND author_id=$2", [lessonId, AUTHOR_ID]);
      assert.equal(saved.length, 1, "Saved lesson missing; rolling back");
      assertDailyRoutinesCanonicalUnit(saved[0], lesson, lessonId, folderId);
      const { rows: words } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert(isDeepStrictEqual(comparableContent(words), comparableContent(wordContent)), "Saved vocabulary differs; rolling back");
    }
    assertDailyRoutinesPreservation(before, await snapshot(client), plan);
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", status: previous ? "already-installed" : apply ? "created" : "would-create",
      title: lesson.title, lessonId, folder: "B1", folderId, folderAlreadyExisted: Boolean(existingFolder),
      wouldCreateFolder: !existingFolder, folderCreated: Boolean(plan.newFolderId),
      words: lesson.words.length, teacherSections: lesson.sections.length, studentSections: publicSections.length,
      automaticLessonAnswers, homeworkExercises: lesson.homework[0].exercises.length,
      homeworkItems: lesson.homework[0].exercises.reduce((sum, exercise) => sum + exercise.items.length, 0),
      initialOpenSections: defaultRegularOpenSections(lesson.sections),
      existingFoldersPreserved: before.folders.length, existingLessonsPreserved: before.units.length,
      existingVocabularyPreserved: before.words.length, existingAssignmentsPreserved: before.assignments.length,
      standaloneHomeworkPreserved: before.standaloneHomework.length, currentClassesPreserved: true,
      studentAssignmentsCreated: 0, studentWorkChanged: false, existingContentOverwritten: false,
      notificationsSent: false, realtimeEventsPublished: 0,
      lessonHref: lessonId ? `/teacher/lessons/${lessonId}` : null,
    }, null, 2));
  } catch (error) {
    if (transactionOpen && client) await client.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: { name?: string; code?: string; message?: string }) => {
    // Never log database details, credentials, SQL parameters or private student data.
    console.error({ stage: "create-b1-more-daily-routines", type: error.name, code: error.code,
      ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
