/** Add only the requested homework to the existing A2 Popular questions template. Dry-run by default. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { buildA2PopularQuestionsLesson, POPULAR_QUESTIONS_LESSON_TITLE } from "../src/lib/bundled-lessons/a2-popular-questions";
import { buildPopularQuestionsHomework } from "../src/lib/bundled-lessons/a2-popular-questions-homework";
import { regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const UNIT_ID = "88ecfa45-1979-4330-86ab-3151d50c7bb0";
const FOLDER_ID = "e06206f5-3b7c-4890-8db0-06562d82cd5b";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SourceLesson = ReturnType<typeof buildA2PopularQuestionsLesson>;
type StoredUnit = Record<string, unknown> & { homework: unknown };
function comparableSections(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map(section => section && typeof section === "object" ? {
    ...section,
    ...(typeof section.studentHtml === "string" ? { studentHtml: section.studentHtml.replace(/\r\n/g, "\n") } : {}),
    ...(typeof section.teacherHtml === "string" ? { teacherHtml: section.teacherHtml.replace(/\r\n/g, "\n") } : {}),
  } : section);
}
export type PopularQuestionsHomeworkPreservationSnapshot = {
  folders: unknown[];
  units: unknown[];
  words: unknown[];
  assignments: unknown[];
  classState: unknown[];
  standaloneHomework: unknown[];
  notifications: unknown[];
};

export function popularQuestionsHomeworkUpdateApply(args: string[]): boolean {
  assert(args.every(argument => argument === "--apply"), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  return args.includes("--apply");
}

/** The exact reviewed plan is idempotent. Never overwrite a teacher's own homework. */
export function popularQuestionsHomeworkAlreadyInstalled(previous: unknown, expected: unknown): boolean {
  if (isDeepStrictEqual(previous, expected)) return true;
  assert(Array.isArray(previous) && previous.length === 0, "Existing homework differs; preserving teacher edits");
  return false;
}

export function assertPopularQuestionsHomeworkJsonPortable(value: unknown): void {
  assert(isDeepStrictEqual(JSON.parse(JSON.stringify(value)), value), "Homework must be JSON portable before database writes");
}

/** Report only counts, never private snapshot content or student answers. */
export function popularQuestionsHomeworkSnapshotAvailability(rows: { content_override: unknown }[]) {
  const overrides = rows.map(row => row.content_override).filter(value => value !== null);
  const plans = overrides.map(value => value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).interactiveHomework : undefined);
  const absent = plans.filter(value => value === null || value === undefined).length;
  const exerciseCounts = plans.filter(value => value && typeof value === "object" && !Array.isArray(value))
    .map(value => (value as Record<string, unknown>).exercises)
    .filter(Array.isArray).map(exercises => exercises.length);
  return {
    personalContentOverridesPreserved: overrides.length,
    snapshotsWithoutHomework: absent,
    snapshotsWithEmptyHomework: exerciseCounts.filter(count => count === 0).length,
    snapshotsWithExistingHomework: exerciseCounts.filter(count => count > 0).length,
    snapshotsWithUnrecognizedHomework: plans.length - absent - exerciseCounts.length,
  };
}

export function assertPopularQuestionsHomeworkPreservation(
  before: PopularQuestionsHomeworkPreservationSnapshot,
  after: PopularQuestionsHomeworkPreservationSnapshot,
): void {
  for (const key of Object.keys(before) as (keyof PopularQuestionsHomeworkPreservationSnapshot)[]) {
    assert(isDeepStrictEqual(before[key], after[key]), `${key} changed unexpectedly; rolling back`);
  }
}

/** Original prompts and keys must still match the source; optional attachments are preserved, not replaced. */
export function assertPopularQuestionsCanonicalUnit(unit: StoredUnit, lesson: SourceLesson, unitId: string, folderId: string): void {
  assert(UUID.test(unitId) && UUID.test(folderId), "Exact lesson and folder identities are required");
  const canonical = {
    id: unitId, author_id: AUTHOR_ID, kind: "REGULAR", title: POPULAR_QUESTIONS_LESSON_TITLE,
    description: lesson.description, folder_id: folderId,
  };
  // Git may check fixtures out with CRLF on Windows while the database retains LF.
  // Compare that formatting only; preservation digests still protect the exact stored HTML bytes.
  assert(Object.entries(canonical).every(([key, value]) => isDeepStrictEqual(unit[key], value)) &&
    isDeepStrictEqual(comparableSections(unit.sections), comparableSections(lesson.sections)),
    "Existing Popular questions content differs from the reviewed source; preserving teacher edits");
}

async function snapshot(client: PoolClient, unitId: string): Promise<PopularQuestionsHomeworkPreservationSnapshot> {
  return {
    folders: (await client.query("SELECT id,md5(to_jsonb(f)::text) AS digest FROM public.lesson_folders f WHERE author_id=$1 ORDER BY id", [AUTHOR_ID])).rows,
    // Even timestamps and optional attachments are protected. Only the target template's homework may differ.
    units: (await client.query(`SELECT id,md5((CASE WHEN id=$1 THEN to_jsonb(l)-'homework' ELSE to_jsonb(l) END)::text) AS digest
      FROM public.lesson_units l WHERE author_id=$2 ORDER BY id`, [unitId, AUTHOR_ID])).rows,
    words: (await client.query(`SELECT w.id,md5(to_jsonb(w)::text) AS digest FROM public.lesson_words w
      INNER JOIN public.lesson_units l ON l.id=w.unit_id WHERE l.author_id=$1 ORDER BY w.id`, [AUTHOR_ID])).rows,
    assignments: (await client.query("SELECT id,md5(to_jsonb(a)::text) AS digest FROM public.lesson_assignments a ORDER BY id")).rows,
    classState: (await client.query("SELECT id,class_with_id,class_where,class_focus FROM public.users ORDER BY id")).rows,
    standaloneHomework: (await client.query("SELECT id,md5(to_jsonb(h)::text) AS digest FROM public.homework h ORDER BY id")).rows,
    notifications: (await client.query("SELECT id,md5(to_jsonb(n)::text) AS digest FROM public.notifications n ORDER BY id")).rows,
  };
}

async function main() {
  const apply = popularQuestionsHomeworkUpdateApply(process.argv.slice(2));
  const lesson = buildA2PopularQuestionsLesson(
    readFileSync(new URL("./fixtures/a2-popular-questions-student.html", import.meta.url), "utf8"),
    readFileSync(new URL("./fixtures/a2-popular-questions-teacher.html", import.meta.url), "utf8"),
  );
  const plan = buildPopularQuestionsHomework();
  const expectedHomework = [plan];
  assertPopularQuestionsHomeworkJsonPortable(expectedHomework);
  assert(plan.exercises.length === 7 && plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) === 20,
    "Expected the reviewed seven exercises and twenty items");
  assert(lesson.words.length === 9 && lesson.sections.length === 12 &&
    lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0) === 81,
  "Canonical lesson completeness changed");
  const vocabulary = lesson.words.map(word => ({
    word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
    translation: word.translation, description: word.description, note: word.note, examples: word.examples,
    section_color: word.sectionColor, image_url: word.imageUrl,
  }));
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000, application_name: "a2-popular-questions-homework-update" });
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:A2:${lesson.title}:homework`]);
    }
    const { rows: owner } = await client.query("SELECT id,name,role,access_blocked FROM public.users WHERE id=$1", [AUTHOR_ID]);
    assert(owner.length === 1 && owner[0].name === "Vlad" && owner[0].role === "TEACHER" && !owner[0].access_blocked,
      "Exact teacher unavailable");
    const { rows: folders } = await client.query("SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='A2'", [AUTHOR_ID]);
    assert(folders.length === 1 && folders[0].id === FOLDER_ID, "Exact A2 folder missing or ambiguous");
    const folderId = folders[0].id as string;
    const { rows: matches } = await client.query(`SELECT id FROM public.lesson_units WHERE author_id=$1
      AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('a2popularquestions','popularquestions')`, [AUTHOR_ID]);
    assert(matches.length === 1 && matches[0].id === UNIT_ID, "Exact Popular questions template missing or ambiguous");
    const unitId = matches[0].id as string;
    const { rows: units } = await client.query(`SELECT * FROM public.lesson_units WHERE id=$1 AND author_id=$2${apply ? " FOR UPDATE" : ""}`, [unitId, AUTHOR_ID]);
    assert(units.length === 1, "Exact Popular questions template unavailable");
    const unit = units[0] as StoredUnit;
    assertPopularQuestionsCanonicalUnit(unit, lesson, unitId, folderId);
    const wordColumns = "word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url";
    const { rows: words } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [unitId]);
    assert(isDeepStrictEqual(words, vocabulary), "Existing vocabulary differs; preserving teacher edits");
    const alreadyInstalled = popularQuestionsHomeworkAlreadyInstalled(unit.homework, expectedHomework);
    const { rows: targetAssignments } = await client.query("SELECT content_override,answers FROM public.lesson_assignments WHERE unit_id=$1 ORDER BY id", [unitId]);
    const before = await snapshot(client, unitId);
    if (apply && !alreadyInstalled) {
      // Compare-and-swap the exact prior JSONB. Do not touch updated_at or any student state.
      const changed = await client.query(`UPDATE public.lesson_units SET homework=$1::jsonb
        WHERE id=$2 AND author_id=$3 AND homework=$4::jsonb RETURNING id`,
      [JSON.stringify(expectedHomework), unitId, AUTHOR_ID, JSON.stringify(unit.homework)]);
      assert(changed.rowCount === 1 && changed.rows[0].id === unitId, "Homework changed concurrently; rolling back");
    }
    const { rows: saved } = await client.query("SELECT * FROM public.lesson_units WHERE id=$1 AND author_id=$2", [unitId, AUTHOR_ID]);
    assert(saved.length === 1, "Saved template verification failed");
    assertPopularQuestionsCanonicalUnit(saved[0] as StoredUnit, lesson, unitId, folderId);
    assert(isDeepStrictEqual(saved[0].homework, apply || alreadyInstalled ? expectedHomework : unit.homework),
      "Saved homework differs; rolling back");
    assertPopularQuestionsHomeworkPreservation(before, await snapshot(client, unitId));
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", status: alreadyInstalled ? "already-installed" : apply ? "updated" : "would-update",
      lessonId: unitId, title: lesson.title, folder: "A2", folderId,
      homeworkExercises: plan.exercises.length, homeworkItems: 20, wordsPreserved: 9, lessonSectionsPreserved: 12,
      automaticLessonAnswersPreserved: 81, existingLessonsPreserved: before.units.length,
      existingAssignmentsPreserved: before.assignments.length, targetAssignmentsPreserved: targetAssignments.length,
      ...popularQuestionsHomeworkSnapshotAvailability(targetAssignments),
      personalHomeworkOverridesPreserved: targetAssignments.filter(row => Object.hasOwn(row.answers ?? {}, "hw:plan-override")).length,
      currentClassesPreserved: true, studentAssignmentsCreated: 0, studentWorkChanged: false,
      notificationsSent: false, realtimeEventsPublished: 0, changedFields: apply && !alreadyInstalled ? ["lesson_units.homework"] : [],
      lessonHref: `/teacher/lessons/${unitId}`,
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
    // Never log connection details, SQL parameters, student answers or private state.
    console.error({ stage: "update-a2-popular-questions-homework", type: error.name, code: error.code,
      ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
