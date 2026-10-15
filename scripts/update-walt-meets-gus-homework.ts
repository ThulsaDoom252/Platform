/** Add only the reviewed homework to the existing Walt meets Gus template. Dry-run by default. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import {
  BREAKING_BAD_FOLDER,
  WALT_MEETS_GUS_DESCRIPTION,
  WALT_MEETS_GUS_QUESTIONS,
  WALT_MEETS_GUS_TITLE,
  WALT_MEETS_GUS_TRANSCRIPT,
  WALT_MEETS_GUS_VIDEO_TITLE,
  WALT_MEETS_GUS_VIDEO_URL,
  waltMeetsGusVocabulary,
} from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus";
import { buildWaltMeetsGusHomework } from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus-homework";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const UNIT_ID = "f0c4c1ec-347b-4529-a8d3-d54083105ca7";
const FOLDER_ID = "d093371f-523e-453e-995e-f3e4279961b0";

type StoredUnit = Record<string, unknown> & { homework: unknown };
export type WaltHomeworkPreservationSnapshot = {
  units: unknown[];
  words: unknown[];
  assignments: unknown[];
  classState: unknown[];
  standaloneHomework: unknown[];
  notifications: unknown[];
};

export function waltHomeworkUpdateApply(args: string[]): boolean {
  assert(args.every(argument => argument === "--apply"), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  return args.includes("--apply");
}

/** Existing teacher edits are never overwritten. The exact reviewed plan is idempotent. */
export function waltHomeworkAlreadyInstalled(previous: unknown, expected: unknown): boolean {
  if (isDeepStrictEqual(previous, expected)) return true;
  assert(Array.isArray(previous) && previous.length === 0, "Existing homework differs; preserving teacher edits");
  return false;
}

/** JSONB must not silently remove undefined fields from the in-memory plan. */
export function assertWaltHomeworkJsonPortable(value: unknown): void {
  assert(isDeepStrictEqual(JSON.parse(JSON.stringify(value)), value), "Homework must be JSON portable before database writes");
}

export function assertWaltHomeworkPreservation(
  before: WaltHomeworkPreservationSnapshot,
  after: WaltHomeworkPreservationSnapshot,
): void {
  for (const key of Object.keys(before) as (keyof WaltHomeworkPreservationSnapshot)[]) {
    assert(isDeepStrictEqual(before[key], after[key]), `${key} changed unexpectedly; rolling back`);
  }
}

export function assertWaltCanonicalUnit(unit: StoredUnit): void {
  const canonical = {
    id: UNIT_ID, author_id: AUTHOR_ID, kind: "ACTIVITY", title: WALT_MEETS_GUS_TITLE,
    description: WALT_MEETS_GUS_DESCRIPTION, folder_id: FOLDER_ID, vocab_node_id: null,
    lexis: [], video_url: WALT_MEETS_GUS_VIDEO_URL, video_title: WALT_MEETS_GUS_VIDEO_TITLE,
    transcript: WALT_MEETS_GUS_TRANSCRIPT,
    questions: { afterVideo: WALT_MEETS_GUS_QUESTIONS, afterReading: [] },
    activity_ids: [], sections: [],
  };
  assert(Object.entries(canonical).every(([key, value]) => isDeepStrictEqual(unit[key], value)),
    "Existing Walt meets Gus content differs from the reviewed source; preserving teacher edits");
}

async function snapshot(client: PoolClient): Promise<WaltHomeworkPreservationSnapshot> {
  return {
    // Only this template's homework may change. Every other field, including timestamps, is protected.
    units: (await client.query(`SELECT id,md5((CASE WHEN id=$1 THEN to_jsonb(l)-'homework' ELSE to_jsonb(l) END)::text) AS digest
      FROM public.lesson_units l WHERE author_id=$2 ORDER BY id`, [UNIT_ID, AUTHOR_ID])).rows,
    words: (await client.query(`SELECT w.id,md5(to_jsonb(w)::text) AS digest FROM public.lesson_words w
      INNER JOIN public.lesson_units l ON l.id=w.unit_id WHERE l.author_id=$1 ORDER BY w.id`, [AUTHOR_ID])).rows,
    assignments: (await client.query("SELECT id,md5(to_jsonb(a)::text) AS digest FROM public.lesson_assignments a ORDER BY id")).rows,
    classState: (await client.query("SELECT id,class_with_id,class_where,class_focus FROM public.users ORDER BY id")).rows,
    standaloneHomework: (await client.query("SELECT id,md5(to_jsonb(h)::text) AS digest FROM public.homework h ORDER BY id")).rows,
    notifications: (await client.query("SELECT id,md5(to_jsonb(n)::text) AS digest FROM public.notifications n ORDER BY id")).rows,
  };
}

async function main() {
  const apply = waltHomeworkUpdateApply(process.argv.slice(2));
  const plan = buildWaltMeetsGusHomework();
  const expectedHomework = [plan];
  assertWaltHomeworkJsonPortable(expectedHomework);
  assert(plan.exercises.length === 8 && plan.exercises.reduce((sum, exercise) => sum + exercise.items.length, 0) === 39,
    "Expected the reviewed eight exercises and thirty-nine items");
  const vocabulary = waltMeetsGusVocabulary().map((word, index) => ({
    word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
    translation: word.translation, description: word.description, note: word.note, examples: word.examples,
    section_color: word.sectionColor, image_url: word.imageUrl, sort_order: index + 1,
  }));
  assert(vocabulary.length === 19 && WALT_MEETS_GUS_TRANSCRIPT.length === 46, "Canonical lesson completeness changed");
  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000, application_name: "walt-meets-gus-homework-update" });
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:${UNIT_ID}:homework`]);
    }
    const { rows: owner } = await client.query("SELECT id,name,role,access_blocked FROM public.users WHERE id=$1", [AUTHOR_ID]);
    assert(owner.length === 1 && owner[0].name === "Vlad" && owner[0].role === "TEACHER" && !owner[0].access_blocked,
      "Exact teacher unavailable");
    const { rows: folders } = await client.query("SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND lower(trim(name))=lower($2)", [AUTHOR_ID, BREAKING_BAD_FOLDER]);
    assert(folders.length === 1 && folders[0].id === FOLDER_ID && folders[0].name === BREAKING_BAD_FOLDER,
      "Exact Breaking Bad folder missing or ambiguous");
    const { rows: matches } = await client.query("SELECT id FROM public.lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g')='waltmeetsgus'", [AUTHOR_ID]);
    assert(matches.length === 1 && matches[0].id === UNIT_ID, "Exact Walt meets Gus template missing or ambiguous");
    const { rows: units } = await client.query(`SELECT * FROM public.lesson_units WHERE id=$1 AND author_id=$2${apply ? " FOR UPDATE" : ""}`, [UNIT_ID, AUTHOR_ID]);
    assert(units.length === 1, "Exact Walt meets Gus template unavailable");
    const unit = units[0] as StoredUnit;
    assertWaltCanonicalUnit(unit);
    const wordColumns = "word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order";
    const { rows: words } = await client.query(`SELECT ${wordColumns} FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id`, [UNIT_ID]);
    assert(isDeepStrictEqual(words, vocabulary), "Existing vocabulary differs; preserving teacher edits");
    const alreadyInstalled = waltHomeworkAlreadyInstalled(unit.homework, expectedHomework);
    const { rows: targetAssignments } = await client.query(`SELECT id,content_override,answers FROM public.lesson_assignments WHERE unit_id=$1 ORDER BY id`, [UNIT_ID]);
    const before = await snapshot(client);
    if (apply && !alreadyInstalled) {
      // Compare-and-swap the exact prior JSONB value. Do not touch updated_at or any student state.
      const changed = await client.query(`UPDATE public.lesson_units SET homework=$1::jsonb
        WHERE id=$2 AND author_id=$3 AND homework=$4::jsonb RETURNING id`,
      [JSON.stringify(expectedHomework), UNIT_ID, AUTHOR_ID, JSON.stringify(unit.homework)]);
      assert(changed.rowCount === 1 && changed.rows[0].id === UNIT_ID, "Homework changed concurrently; rolling back");
    }
    const { rows: saved } = await client.query("SELECT * FROM public.lesson_units WHERE id=$1 AND author_id=$2", [UNIT_ID, AUTHOR_ID]);
    assert(saved.length === 1, "Saved template verification failed");
    assertWaltCanonicalUnit(saved[0] as StoredUnit);
    assert(isDeepStrictEqual(saved[0].homework, apply || alreadyInstalled ? expectedHomework : unit.homework),
      "Saved homework differs; rolling back");
    assertWaltHomeworkPreservation(before, await snapshot(client));
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", status: alreadyInstalled ? "already-installed" : apply ? "updated" : "would-update",
      lessonId: UNIT_ID, title: WALT_MEETS_GUS_TITLE, folder: BREAKING_BAD_FOLDER, folderId: FOLDER_ID,
      homeworkExercises: plan.exercises.length, homeworkItems: 39, wordsPreserved: 19, transcriptLinesPreserved: 46,
      existingLessonsPreserved: before.units.length, existingAssignmentsPreserved: before.assignments.length,
      targetAssignmentsPreserved: targetAssignments.length,
      personalContentOverridesPreserved: targetAssignments.filter(row => row.content_override !== null).length,
      personalHomeworkOverridesPreserved: targetAssignments.filter(row => Object.hasOwn(row.answers ?? {}, "hw:plan-override")).length,
      currentClassesPreserved: true, studentAssignmentsCreated: 0, studentWorkChanged: false,
      notificationsSent: false, realtimeEventsPublished: 0, changedFields: apply && !alreadyInstalled ? ["lesson_units.homework"] : [],
      lessonHref: `/teacher/lessons/${UNIT_ID}`,
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
    // Do not log database connection details, SQL parameters, student answers or private state.
    console.error({ stage: "update-walt-meets-gus-homework", type: error.name, code: error.code,
      ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
