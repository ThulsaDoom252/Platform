/**
 * Create/reuse the Common things template and assign it to the exact Ksenia account.
 * Dry-run by default: npx tsx scripts/create-a1-common-things.ts
 * Apply the reviewed plan: npx tsx scripts/create-a1-common-things.ts --apply
 * Never changes a current class, existing lesson, student work, or notifications.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { buildA1CommonThingsLesson } from "../src/lib/bundled-lessons/a1-common-things";
import {
  defaultRegularOpenSections,
  publicRegularLessonSections,
  regularAnswerMap,
} from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const STUDENT_ID = "a3cb07c5-a78e-4f55-947f-9a6df1f3b14f";
const FOLDER_ID = "2585ffde-5861-462c-ab6a-d536c93e6df7";

type UserRow = {
  id: string;
  name: string;
  role: string;
  access_blocked: boolean;
  class_with_id: string | null;
  class_focus: Record<string, unknown> | null;
};
export type CommonThingsAssignmentRow = {
  id: string;
  unit_id: string;
  student_id: string;
  open_sections: string[];
  highlights: Record<string, string>;
  answers: Record<string, string>;
  content_override: unknown;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export function commonThingsImportApply(args: string[]): boolean {
  assert(args.every(argument => argument === "--apply"), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  return args.includes("--apply");
}

/** Verification used before commit; importing this module never accesses the database. */
export function assertCommonThingsAssignmentPreservation(
  previous: CommonThingsAssignmentRow[], saved: CommonThingsAssignmentRow[],
  assignmentId: string, lessonId: string, openSections: string[],
): void {
  const previousTarget = previous.filter(assignment => assignment.unit_id === lessonId);
  assert(previousTarget.length <= 1, "Duplicate Ksenia assignments found; refusing to guess");
  const existingAssignment = previousTarget[0];
  assert(!existingAssignment || existingAssignment.id === assignmentId, "Existing assignment identity changed; rolling back");
  const savedAssignment = saved.find(assignment => assignment.id === assignmentId && assignment.unit_id === lessonId && assignment.student_id === STUDENT_ID);
  assert(savedAssignment, "Saved Ksenia assignment verification failed");
  const existingIds = new Set(previous.map(assignment => assignment.id));
  assert(isDeepStrictEqual(saved.filter(assignment => existingIds.has(assignment.id)), previous), "Existing student work changed; rolling back");
  assert(saved.length === previous.length + (existingAssignment ? 0 : 1), "Unexpected student assignment changes; rolling back");
  if (!existingAssignment) {
    assert(isDeepStrictEqual(savedAssignment.open_sections, openSections) && Object.keys(savedAssignment.answers).length === 0 && Object.keys(savedAssignment.highlights).length === 0 && savedAssignment.content_override === null && savedAssignment.finished_at === null, "New assignment state verification failed");
  }
}

async function main() {
  const apply = commonThingsImportApply(process.argv.slice(2));

  const lesson = buildA1CommonThingsLesson(
    readFileSync(new URL("./fixtures/a1-common-things-student.html", import.meta.url), "utf8"),
    readFileSync(new URL("./fixtures/a1-common-things-teacher.html", import.meta.url), "utf8"),
  );
  assert(lesson.title === "A1 · Common things", "Unexpected lesson title");
  assert(lesson.words.length === 10, "All ten source vocabulary entries are required");
  assert(new Set(lesson.words.map(word => word.word)).size === 10 && lesson.words.reduce((total, word) => total + word.examples.length, 0) === 20, "All vocabulary entries and twenty source examples are required");
  assert(lesson.sections.length === 13, "All source sections, helpers and private homework keys are required");
  assert(lesson.homework.length === 0, "Do not invent homework from private answer keys without supplied prompts");
  const publicSections = publicRegularLessonSections(lesson.sections);
  assert(publicSections.length === 12, "All twelve student sections are required");
  assert(publicSections.every(section => !section.teacherHtml && !section.teacherOnly), "Teacher keys must remain private");
  const answerCounts = lesson.sections.map(section => {
    const controls = (section.studentHtml.match(/class=["'][^"']*\b(?:blank|tfbox)\b/gi) ?? []).length;
    const answers = regularAnswerMap(section).size;
    assert(answers === controls, `Missing lesson answer keys in ${section.title}`);
    return { title: section.title, answers };
  });
  const automaticLessonAnswers = answerCounts.reduce((total, section) => total + section.answers, 0);
  assert(automaticLessonAnswers === 137, "All 137 approved keyed lesson controls are required");
  const answerKinds = lesson.sections.flatMap(section => [...regularAnswerMap(section).values()].map(answer => answer.kind));
  assert(answerKinds.filter(kind => kind === "fill").length === 99 && answerKinds.filter(kind => kind === "true-false").length === 38, "Expected 99 fill controls and 38 true/false controls");
  const openSections = defaultRegularOpenSections(lesson.sections);
  assert(isDeepStrictEqual(openSections, ["regular:common-things-02"]), "Only the initial vocabulary section should be open");

  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({
    connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000, application_name: "a1-common-things-import",
  });
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:A1:${lesson.title}`]);
    }
    // Lock these two accounts during apply to verify that neither current class
    // is altered. This assignment does not require Vlad to be in Ksenia's class.
    const { rows: people } = await client.query<UserRow>(
      `SELECT id,name,role,access_blocked,class_with_id,class_focus FROM public.users WHERE id=ANY($1::uuid[]) ORDER BY id${apply ? " FOR UPDATE" : ""}`,
      [[AUTHOR_ID, STUDENT_ID]],
    );
    const teacher = people.find(person => person.id === AUTHOR_ID);
    const student = people.find(person => person.id === STUDENT_ID);
    assert(teacher?.role === "TEACHER" && teacher.name === "Vlad" && !teacher.access_blocked, "Exact Vlad teacher account missing or unavailable");
    assert(student?.role === "STUDENT" && student.name === "Ksenia" && !student.access_blocked, "Exact Ksenia student account missing or unavailable");

    const { rows: folders } = await client.query<{ id: string; name: string }>(
      "SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='A1'", [AUTHOR_ID],
    );
    assert(folders.length === 1 && folders[0].id === FOLDER_ID && folders[0].name === "A1", "Exact existing Vlad A1 folder missing or ambiguous");
    const { rows: existingLessons } = await client.query<{
      id: string; kind: string; title: string; description: string | null; folder_id: string | null; sections: unknown; homework: unknown;
    }>(
      "SELECT id,kind,title,description,folder_id,sections,homework FROM public.lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('a1commonthings','commonthings')",
      [AUTHOR_ID],
    );
    assert(existingLessons.length <= 1, "Duplicate Common things lessons found; refusing to guess");
    const existingLesson = existingLessons[0];
    const lessonId = existingLesson?.id ?? (apply ? randomUUID() : null);
    const wordContent = lesson.words.map(word => ({
      word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
      translation: word.translation, description: word.description, note: word.note, examples: word.examples,
      section_color: word.sectionColor, image_url: word.imageUrl,
    }));
    if (existingLesson) {
      assert(existingLesson.kind === "REGULAR" && existingLesson.title === lesson.title && existingLesson.folder_id === FOLDER_ID, "Existing lesson identity differs; preserving teacher edits");
      assert(existingLesson.description === lesson.description && isDeepStrictEqual(existingLesson.sections, lesson.sections) && isDeepStrictEqual(existingLesson.homework, lesson.homework), "Existing lesson content differs; preserving teacher edits");
      const { rows: words } = await client.query("SELECT word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id", [lessonId]);
      assert(isDeepStrictEqual(words, wordContent), "Existing vocabulary differs; preserving teacher edits");
    }

    // Existing assignments are immutable in this import, including completed
    // lessons, private content overrides, section access and submitted answers.
    const { rows: previousAssignments } = await client.query<CommonThingsAssignmentRow>(
      `SELECT * FROM public.lesson_assignments WHERE student_id=$1 ORDER BY id${apply ? " FOR UPDATE" : ""}`, [STUDENT_ID],
    );
    const assignmentRows = previousAssignments.filter(assignment => assignment.unit_id === lessonId);
    assert(assignmentRows.length <= 1, "Duplicate Ksenia assignments found; refusing to guess");
    const existingAssignment = assignmentRows[0];
    const assignmentId = existingAssignment?.id ?? (apply ? randomUUID() : null);

    if (apply) {
      assert(lessonId && assignmentId, "Missing planned record identity");
      if (!existingLesson) {
        const { rows: order } = await client.query<{ next: number }>(
          "SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, FOLDER_ID],
        );
        await client.query(`INSERT INTO public.lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
          VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [lessonId, AUTHOR_ID, lesson.title, lesson.description, FOLDER_ID, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
        for (const [index, word] of lesson.words.entries()) {
          await client.query(`INSERT INTO public.lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [randomUUID(), lessonId, word.category, word.icon, word.word, word.ipaUs, word.ipaUk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.sectionColor, word.imageUrl, index + 1]);
        }
      }
      if (!existingAssignment) {
        // Same per-student row and initial visibility as pinLessonAction, without
        // its notification side effect: none was requested for this import.
        await client.query("INSERT INTO public.lesson_assignments (id,unit_id,student_id,open_sections) VALUES ($1,$2,$3,$4::jsonb)", [assignmentId, lessonId, STUDENT_ID, JSON.stringify(openSections)]);
      }
      const { rows: savedLessons } = await client.query("SELECT title,kind,description,folder_id,sections,homework FROM public.lesson_units WHERE id=$1 AND author_id=$2", [lessonId, AUTHOR_ID]);
      assert(savedLessons.length === 1 && savedLessons[0].title === lesson.title && savedLessons[0].kind === "REGULAR" && savedLessons[0].description === lesson.description && savedLessons[0].folder_id === FOLDER_ID && isDeepStrictEqual(savedLessons[0].sections, lesson.sections) && isDeepStrictEqual(savedLessons[0].homework, lesson.homework), "Saved lesson verification failed");
      const { rows: savedWords } = await client.query("SELECT word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id", [lessonId]);
      assert(isDeepStrictEqual(savedWords, wordContent), "Saved vocabulary verification failed");
      const { rows: savedAssignments } = await client.query<CommonThingsAssignmentRow>("SELECT * FROM public.lesson_assignments WHERE student_id=$1 ORDER BY id", [STUDENT_ID]);
      assertCommonThingsAssignmentPreservation(previousAssignments, savedAssignments, assignmentId, lessonId, openSections);
      const { rows: savedPeople } = await client.query<UserRow>("SELECT id,name,role,access_blocked,class_with_id,class_focus FROM public.users WHERE id=ANY($1::uuid[]) ORDER BY id", [[AUTHOR_ID, STUDENT_ID]]);
      assert(isDeepStrictEqual(savedPeople, people), "Current class or account state changed; rolling back");
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", teacher: teacher.name, student: student.name, studentId: STUDENT_ID,
      folder: "A1", folderId: FOLDER_ID, folderCreated: false,
      title: lesson.title, lessonId, lessonAlreadyExisted: Boolean(existingLesson), wouldCreateLesson: !existingLesson,
      assignmentId, assignmentAlreadyExisted: Boolean(existingAssignment), wouldCreateAssignment: !existingAssignment,
      words: lesson.words.length, studentSections: publicSections.length, teacherSections: lesson.sections.length,
      automaticLessonAnswers, answerCounts, homeworkExercises: 0, initialOpenSections: openSections,
      previousAssignmentsPreserved: previousAssignments.length,
      previousAnswerFieldsPreserved: previousAssignments.reduce((total, assignment) => total + Object.keys(assignment.answers).length, 0),
      previousHighlightsPreserved: previousAssignments.reduce((total, assignment) => total + Object.keys(assignment.highlights).length, 0),
      existingLessonsOverwritten: false, existingStudentWorkOverwritten: false,
      activeLessonChanged: false, teacherClassSelectionChanged: false, unrelatedClassStatePreserved: true,
      notificationsSent: false, realtimeEventsPublished: 0,
      studentLessonHref: assignmentId ? `/student/lessons/${assignmentId}` : null,
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
    // Database/service messages and connection details can contain credentials.
    console.error({ stage: "create-a1-common-things", type: error.name, code: error.code, ...(error.name === "AssertionError" ? { message: error.message } : {}) });
    process.exitCode = 1;
  });
}
