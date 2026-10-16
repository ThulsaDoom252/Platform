/** Add only the requested native B1 template. Dry-run by default; never assign student work. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { buildB1TransportLesson } from "../src/lib/bundled-lessons/b1-transport";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
type Lesson = ReturnType<typeof buildB1TransportLesson>;
type Digest = { id: string; digest: string };
type Snapshot = Record<"folders" | "units" | "words" | "assignments" | "classes" | "homework" | "notifications", Digest[]>;

export function transportImportOptions(args: string[]) {
  assert(args.every(arg => arg === "--apply" || /^--env=.+/.test(arg)), "Unknown argument");
  assert(args.filter(arg => arg === "--apply").length <= 1 && args.filter(arg => arg.startsWith("--env=")).length <= 1, "Duplicate argument");
  return { apply: args.includes("--apply"), envFile: args.find(arg => arg.startsWith("--env="))?.slice(6) ?? ".env.production.local" };
}
const comparable = (value: unknown): unknown => {
  if (typeof value === "string") return value.replace(/\r\n/g, "\n");
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]));
  return value;
};
export function assertTransportCanonical(unit: Record<string, unknown>, lesson: Lesson, lessonId: string, folderId: string) {
  assert(/^[0-9a-f-]{36}$/i.test(lessonId) && /^[0-9a-f-]{36}$/i.test(folderId), "Exact identities required");
  const expected = { id: lessonId, author_id: AUTHOR_ID, folder_id: folderId, title: lesson.title, description: lesson.description, kind: "REGULAR", sections: lesson.sections, homework: lesson.homework };
  assert(Object.entries(expected).every(([key, value]) => isDeepStrictEqual(comparable(unit[key]), comparable(value))), "Existing Transport lesson differs; preserving teacher edits");
}
async function snapshot(client: PoolClient): Promise<Snapshot> {
  const rows = async (sql: string) => (await client.query<Digest>(sql)).rows;
  return {
    folders: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM lesson_folders t ORDER BY id"),
    units: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM lesson_units t ORDER BY id"),
    words: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM lesson_words t ORDER BY id"),
    assignments: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM lesson_assignments t ORDER BY id"),
    classes: await rows("SELECT id,md5(jsonb_build_object('class_with_id',class_with_id,'class_where',class_where,'class_focus',class_focus)::text) AS digest FROM users ORDER BY id"),
    homework: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM homework t ORDER BY id"),
    notifications: await rows("SELECT id,md5(to_jsonb(t)::text) AS digest FROM notifications t ORDER BY id"),
  };
}
export function assertTransportPreserved(before: Snapshot, after: Snapshot, added: { folder: string | null; unit: string | null; words: string[] }) {
  assert.equal(added.words.length, added.unit ? 26 : 0, "Only a complete 26-word template may be added");
  assert(!added.folder || added.unit, "A folder cannot be created without the lesson");
  for (const key of Object.keys(before) as (keyof Snapshot)[]) {
    const ids = key === "folders" ? added.folder ? [added.folder] : [] : key === "units" ? added.unit ? [added.unit] : [] : key === "words" ? added.words : [];
    assert.equal(new Set(ids).size, ids.length, "Duplicate insertion identity");
    assert(ids.every(id => !before[key].some(row => row.id === id)), "Insertion overlaps existing data");
    assert.deepEqual(after[key].filter(row => !ids.includes(row.id)), before[key], `${key} changed unexpectedly; rolling back`);
    assert.deepEqual(after[key].filter(row => ids.includes(row.id)).map(row => row.id).sort(), [...ids].sort(), `${key} missing planned insertion`);
  }
}

async function main() {
  const { apply, envFile } = transportImportOptions(process.argv.slice(2));
  const lesson = buildB1TransportLesson();
  assert.deepEqual(lesson, JSON.parse(JSON.stringify(lesson)), "Lesson must be JSON portable");
  assert.equal(lesson.words.length, 26);
  assert.equal(lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0), 92);
  const env = config({ path: envFile, quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "b1-transport-import" });
  const client = await pool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL REPEATABLE READ${apply ? "" : " READ ONLY"}`);
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:lesson-folder:B1`]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:${lesson.title}`]);
    }
    const { rows: owner } = await client.query("SELECT name,role,access_blocked FROM users WHERE id=$1", [AUTHOR_ID]);
    assert(owner.length === 1 && owner[0].name === "Vlad" && owner[0].role === "TEACHER" && !owner[0].access_blocked, "Exact teacher unavailable");
    const { rows: folders } = await client.query("SELECT id,name FROM lesson_folders WHERE author_id=$1 AND upper(trim(name))='B1'", [AUTHOR_ID]);
    assert(folders.length <= 1 && (!folders[0] || folders[0].name === "B1"), "B1 folder ambiguous; preserving organization");
    const { rows: matches } = await client.query("SELECT * FROM lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('b1transportandthewayoftravelling','transportandthewayoftravelling','b1transportandthewayoftraveling')", [AUTHOR_ID]);
    assert(matches.length <= 1, "Duplicate Transport lessons; refusing to guess");
    const previous = matches[0];
    const folderId: string | null = folders[0]?.id ?? (apply ? randomUUID() : null);
    const lessonId: string | null = previous?.id ?? (apply ? randomUUID() : null);
    const wordContent = lesson.words.map(w => ({ word: w.word, category: w.category, icon: w.icon, ipa_us: w.ipaUs, ipa_uk: w.ipaUk, translation: w.translation, description: w.description, note: w.note, examples: w.examples, section_color: w.sectionColor, image_url: w.imageUrl }));
    const wordColumns = "word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url";
    if (previous) {
      assert(folderId && lessonId, "Existing lesson has no canonical B1 folder");
      assertTransportCanonical(previous, lesson, lessonId, folderId);
      const saved = await client.query(`SELECT ${wordColumns} FROM lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert.deepEqual(comparable(saved.rows), comparable(wordContent), "Existing vocabulary differs; preserving edits");
    }
    const before = await snapshot(client);
    const added = { folder: null as string | null, unit: null as string | null, words: [] as string[] };
    if (apply && !previous) {
      assert(folderId && lessonId);
      if (!folders[0]) {
        await client.query("INSERT INTO lesson_folders (id,author_id,name,sort_order) SELECT $1,$2,'B1',COALESCE(MAX(sort_order),0)+10 FROM lesson_folders WHERE author_id=$2", [folderId, AUTHOR_ID]);
        added.folder = folderId;
      }
      await client.query(`INSERT INTO lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
        SELECT $1,$2,'REGULAR',$3,$4,$5,COALESCE(MAX(sort_order),0)+10,$6::jsonb,$7::jsonb FROM lesson_units WHERE author_id=$2 AND folder_id=$5`,
      [lessonId, AUTHOR_ID, lesson.title, lesson.description, folderId, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
      added.unit = lessonId;
      for (const [index, w] of wordContent.entries()) {
        const id = randomUUID();
        await client.query(`INSERT INTO lesson_words (id,unit_id,${wordColumns},sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
        [id, lessonId, w.word, w.category, w.icon, w.ipa_us, w.ipa_uk, w.translation, w.description, w.note, JSON.stringify(w.examples), w.section_color, w.image_url, index + 1]);
        added.words.push(id);
      }
    }
    if (lessonId) {
      assert(folderId);
      const { rows: saved } = await client.query("SELECT * FROM lesson_units WHERE id=$1 AND author_id=$2", [lessonId, AUTHOR_ID]);
      assert.equal(saved.length, 1);
      assertTransportCanonical(saved[0], lesson, lessonId, folderId);
      const { rows: words } = await client.query(`SELECT ${wordColumns} FROM lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [lessonId]);
      assert.deepEqual(comparable(words), comparable(wordContent));
    }
    assertTransportPreserved(before, await snapshot(client), added);
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", status: previous ? "already-installed" : apply ? "created" : "would-create", lessonId, title: lesson.title, folder: "B1", folderId, folderCreated: Boolean(added.folder), words: 26,
      teacherSections: lesson.sections.length, studentSections: publicRegularLessonSections(lesson.sections).length, automaticLessonAnswers: 92,
      passageTrueFalse: 24, passageQuestions: 24, homeworkExercises: 7, homeworkItems: 19, initialOpenSections: defaultRegularOpenSections(lesson.sections),
      existingLessonsPreserved: before.units.length, existingAssignmentsPreserved: before.assignments.length,
      existingContentOverwritten: false, studentAssignmentsCreated: 0, studentWorkChanged: false, currentClassesPreserved: true, notificationsSent: false,
      lessonHref: lessonId ? `/teacher/lessons/${lessonId}` : null }, null, 2));
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: { name?: string; code?: string; message?: string }) => {
    console.error({ stage: "create-b1-transport", type: error.name, code: error.code, ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
