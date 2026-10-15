/**
 * Create the requested A2 template and make it Victoria's active class lesson.
 * Dry-run by default. Existing templates and student work are never overwritten.
 * Applying a class switch requires the active assignment reported by the dry-run:
 *   npx tsx scripts/create-a2-popular-questions.ts --apply --expected-active=<id|none>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import * as Ably from "ably";
import { Pool } from "pg";
import { buildA2PopularQuestionsLesson } from "../src/lib/bundled-lessons/a2-popular-questions";
import { defaultRegularOpenSections, publicRegularLessonSections, regularAnswerMap } from "../src/lib/regular-lesson";

const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const STUDENT_ID = "9f964311-588c-41ae-94fb-1eb0ee711dc8";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UserRow = {
  id: string;
  name: string;
  role: string;
  access_blocked: boolean;
  class_with_id: string | null;
  class_focus: Record<string, unknown> | null;
};
type AssignmentRow = {
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

/** Match the native class-refresh flow; transport failure never undoes a commit. */
async function refreshClass(key: string | undefined): Promise<number> {
  if (!key?.trim()) return 0;
  try {
    const realtime = new Ably.Rest({ key: key.trim(), logLevel: 0, logHandler: () => undefined, httpMaxRetryCount: 0, httpRequestTimeout: 10_000 });
    const channel = realtime.channels.get(`class:${STUDENT_ID}`);
    const results = await Promise.allSettled(["lesson", "class-sync"].map(event => channel.publish(event, { at: new Date().toISOString() })));
    return results.filter(result => result.status === "fulfilled").length;
  } catch {
    // Do not emit service errors or credentials. Class polling remains a fallback.
    return 0;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  assert(args.every(argument => argument === "--apply" || argument.startsWith("--expected-active=")), "Unknown argument");
  assert(args.filter(argument => argument === "--apply").length <= 1, "Duplicate --apply argument");
  const expectedArguments = args.filter(argument => argument.startsWith("--expected-active="));
  assert(expectedArguments.length <= 1, "Duplicate --expected-active argument");
  const expectedActive = expectedArguments[0]?.slice("--expected-active=".length);
  assert(expectedActive === undefined || expectedActive === "none" || UUID.test(expectedActive), "Expected active assignment must be a UUID or none");

  const lesson = buildA2PopularQuestionsLesson(
    readFileSync(new URL("./fixtures/a2-popular-questions-student.html", import.meta.url), "utf8"),
    readFileSync(new URL("./fixtures/a2-popular-questions-teacher.html", import.meta.url), "utf8"),
  );
  assert(lesson.title === "A2 · Popular questions", "Unexpected lesson title");
  assert(lesson.words.length === 9, "All nine vocabulary entries are required");
  assert(lesson.sections.length === 12, "All source sections and native support sections are required");
  assert(publicRegularLessonSections(lesson.sections).length === 11, "Teacher notes must remain private");
  assert(lesson.sections.reduce((sum, section) => sum + regularAnswerMap(section).size, 0) === 81, "All 81 keyed lesson controls are required");
  assert(lesson.homework.length === 1 && lesson.homework[0].exercises.length === 7, "Popular questions includes its reviewed short homework");
  const openSections = defaultRegularOpenSections(lesson.sections);
  assert(openSections.length > 0, "New assignments need an initial visible section");

  const env = config({ path: ".env.production.local", quiet: true }).parsed;
  assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
  const connection = new URL(env.NEON_DATABASE_URL);
  assert(connection.hostname !== "base", "Placeholder database; refusing to continue");
  connection.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: connection.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "a2-popular-questions-import" });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN READ ONLY");
    transactionOpen = true;
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${AUTHOR_ID}:A2:${lesson.title}`]);
    }
    // Lock the exact accounts before reading their class selection; never switch
    // Vlad away from another student as a side effect of a lesson import.
    const { rows: people } = await client.query<UserRow>(
      `SELECT id,name,role,access_blocked,class_with_id,class_focus FROM public.users WHERE id=ANY($1::uuid[]) ORDER BY id${apply ? " FOR UPDATE" : ""}`,
      [[AUTHOR_ID, STUDENT_ID]],
    );
    const teacher = people.find(person => person.id === AUTHOR_ID);
    const student = people.find(person => person.id === STUDENT_ID);
    assert(teacher?.role === "TEACHER" && teacher.name === "Vlad" && !teacher.access_blocked, "Exact Vlad teacher account missing or unavailable");
    assert(student?.role === "STUDENT" && student.name === "Victoria" && !student.access_blocked, "Exact Victoria student account missing or unavailable");
    assert(teacher.class_with_id === STUDENT_ID, "Vlad is not currently in Victoria's class; refusing to change another class");
    assert(!student.class_focus || (typeof student.class_focus === "object" && !Array.isArray(student.class_focus)), "Unexpected class focus data; refusing to replace it");
    const previousFocus = student.class_focus ?? {};
    const previousActive = previousFocus.lessonAssignmentId;
    assert(previousActive === undefined || (typeof previousActive === "string" && UUID.test(previousActive)), "Unexpected active lesson identity");
    const previousActiveId = typeof previousActive === "string" ? previousActive : null;

    const { rows: folders } = await client.query<{ id: string; name: string }>("SELECT id,name FROM public.lesson_folders WHERE author_id=$1 AND upper(trim(name))='A2'", [AUTHOR_ID]);
    assert(folders.length <= 1, "Duplicate A2 folders found; refusing to guess");
    const folderId = folders[0]?.id ?? (apply ? randomUUID() : null);
    const { rows: existingLessons } = await client.query<{
      id: string; kind: string; title: string; description: string | null; folder_id: string | null; sections: unknown; homework: unknown;
    }>("SELECT id,kind,title,description,folder_id,sections,homework FROM public.lesson_units WHERE author_id=$1 AND regexp_replace(lower(title),'[^a-z0-9]+','','g') IN ('a2popularquestions','popularquestions')", [AUTHOR_ID]);
    assert(existingLessons.length <= 1, "Duplicate Popular questions lessons found; refusing to overwrite");
    const existingLesson = existingLessons[0];
    const lessonId = existingLesson?.id ?? (apply ? randomUUID() : null);
    if (existingLesson) {
      assert(existingLesson.kind === "REGULAR" && existingLesson.title === lesson.title && existingLesson.folder_id === folderId, "Existing lesson identity differs; preserving teacher edits");
      assert(existingLesson.description === lesson.description && isDeepStrictEqual(existingLesson.sections, lesson.sections) && isDeepStrictEqual(existingLesson.homework, lesson.homework), "Existing lesson content differs; preserving teacher edits");
    }
    const wordContent = lesson.words.map(word => ({
      word: word.word, category: word.category, icon: word.icon, ipa_us: word.ipaUs, ipa_uk: word.ipaUk,
      translation: word.translation, description: word.description, note: word.note, examples: word.examples,
      section_color: word.sectionColor, image_url: word.imageUrl,
    }));
    if (existingLesson) {
      const { rows: words } = await client.query("SELECT word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id", [lessonId]);
      assert(isDeepStrictEqual(words, wordContent), "Existing vocabulary differs; preserving teacher edits");
    }

    const { rows: assignmentRows } = lessonId
      ? await client.query<AssignmentRow>(`SELECT * FROM public.lesson_assignments WHERE unit_id=$1 AND student_id=$2${apply ? " FOR UPDATE" : ""}`, [lessonId, STUDENT_ID])
      : { rows: [] as AssignmentRow[] };
    assert(assignmentRows.length <= 1, "Duplicate Victoria assignments found; refusing to guess");
    const existingAssignment = assignmentRows[0];
    const assignmentId = existingAssignment?.id ?? (apply ? randomUUID() : null);
    const switchActive = !existingAssignment || previousActiveId !== existingAssignment.id;
    if (apply && switchActive) {
      assert(expectedActive !== undefined, "Changing the active lesson requires --expected-active=<id|none> from the reviewed dry-run");
      assert(expectedActive === (previousActiveId ?? "none"), "Active class lesson changed since the reviewed dry-run; no writes performed");
    }
    const { rows: previousRows } = previousActiveId
      ? await client.query<AssignmentRow & { title: string }>(
          `SELECT a.*,l.title FROM public.lesson_assignments a JOIN public.lesson_units l ON l.id=a.unit_id WHERE a.id=$1 AND a.student_id=$2 AND l.author_id=$3${apply ? " FOR UPDATE OF a" : ""}`,
          [previousActiveId, STUDENT_ID, AUTHOR_ID],
        )
      : { rows: [] as (AssignmentRow & { title: string })[] };
    assert(!previousActiveId || previousRows.length === 1, "Current class lesson is not Victoria's lesson owned by Vlad; refusing to replace it");
    const previousAssignment = previousRows[0];

    if (apply) {
      assert(folderId && lessonId && assignmentId, "Missing planned record identity");
      if (!folders.length) {
        const { rows: order } = await client.query<{ next: number }>("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_folders WHERE author_id=$1", [AUTHOR_ID]);
        await client.query("INSERT INTO public.lesson_folders (id,author_id,name,sort_order) VALUES ($1,$2,'A2',$3)", [folderId, AUTHOR_ID, order[0].next]);
      }
      if (!existingLesson) {
        const { rows: order } = await client.query<{ next: number }>("SELECT COALESCE(MAX(sort_order),0)+10 AS next FROM public.lesson_units WHERE author_id=$1 AND folder_id=$2", [AUTHOR_ID, folderId]);
        await client.query(`INSERT INTO public.lesson_units (id,author_id,kind,title,description,folder_id,sort_order,sections,homework)
          VALUES ($1,$2,'REGULAR',$3,$4,$5,$6,$7::jsonb,$8::jsonb)`, [lessonId, AUTHOR_ID, lesson.title, lesson.description, folderId, order[0].next, JSON.stringify(lesson.sections), JSON.stringify(lesson.homework)]);
        for (const [index, word] of lesson.words.entries()) {
          await client.query(`INSERT INTO public.lesson_words (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [randomUUID(), lessonId, word.category, word.icon, word.word, word.ipaUs, word.ipaUk, word.translation, word.description, word.note, JSON.stringify(word.examples), word.sectionColor, word.imageUrl, index + 1]);
        }
      }
      if (!existingAssignment) {
        // Match pinLessonAction's per-student storage and initial visibility;
        // omit its optional notification because none was requested here.
        await client.query("INSERT INTO public.lesson_assignments (id,unit_id,student_id,open_sections) VALUES ($1,$2,$3,$4::jsonb)", [assignmentId, lessonId, STUDENT_ID, JSON.stringify(openSections)]);
      }
      if (switchActive) {
        // Native class loading reads this pointer. Keep the board, timer, video,
        // panel, focus and other unrelated class state exactly as it was.
        await client.query("UPDATE public.users SET class_focus=coalesce(class_focus,'{}'::jsonb)||jsonb_build_object('lessonAssignmentId',$1::text) WHERE id=$2 AND role='STUDENT'", [assignmentId, STUDENT_ID]);
      }
      const { rows: savedLessons } = await client.query("SELECT title,kind,folder_id,sections,homework FROM public.lesson_units WHERE id=$1 AND author_id=$2", [lessonId, AUTHOR_ID]);
      assert(savedLessons.length === 1 && savedLessons[0].title === lesson.title && savedLessons[0].kind === "REGULAR" && savedLessons[0].folder_id === folderId && isDeepStrictEqual(savedLessons[0].sections, lesson.sections) && isDeepStrictEqual(savedLessons[0].homework, lesson.homework), "Saved lesson verification failed");
      const { rows: savedWords } = await client.query("SELECT word,category,icon,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url FROM public.lesson_words WHERE unit_id=$1 ORDER BY sort_order,id", [lessonId]);
      assert(isDeepStrictEqual(savedWords, wordContent), "Saved vocabulary verification failed");
      const { rows: savedAssignments } = await client.query<AssignmentRow>("SELECT * FROM public.lesson_assignments WHERE id=$1 AND unit_id=$2 AND student_id=$3", [assignmentId, lessonId, STUDENT_ID]);
      assert(savedAssignments.length === 1, "Saved assignment verification failed");
      if (existingAssignment) assert(isDeepStrictEqual(savedAssignments[0], existingAssignment), "Existing assignment was changed; rolling back");
      else assert(isDeepStrictEqual(savedAssignments[0].open_sections, openSections) && Object.keys(savedAssignments[0].answers).length === 0 && Object.keys(savedAssignments[0].highlights).length === 0 && savedAssignments[0].content_override === null && savedAssignments[0].finished_at === null, "New assignment state verification failed");
      if (previousAssignment && previousAssignment.id !== assignmentId) {
        const { rows: preservedRows } = await client.query<AssignmentRow & { title: string }>("SELECT a.*,l.title FROM public.lesson_assignments a JOIN public.lesson_units l ON l.id=a.unit_id WHERE a.id=$1 AND a.student_id=$2", [previousAssignment.id, STUDENT_ID]);
        assert(preservedRows.length === 1 && isDeepStrictEqual(preservedRows[0], previousAssignment), "Previous lesson's saved work changed; rolling back");
      }
      const { rows: savedPeople } = await client.query<UserRow>("SELECT id,name,role,access_blocked,class_with_id,class_focus FROM public.users WHERE id=ANY($1::uuid[]) ORDER BY id", [[AUTHOR_ID, STUDENT_ID]]);
      assert(isDeepStrictEqual(savedPeople.find(person => person.id === AUTHOR_ID), teacher), "Teacher's active class changed; rolling back");
      const savedStudent = savedPeople.find(person => person.id === STUDENT_ID);
      assert(savedStudent && isDeepStrictEqual(savedStudent, { ...student, class_focus: switchActive ? { ...previousFocus, lessonAssignmentId: assignmentId } : student.class_focus }), "Unrelated student class state changed; rolling back");
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    const realtimeEventsPublished = apply && switchActive
      ? await refreshClass(env.ABLY_API_KEY ?? process.env.ABLY_API_KEY)
      : 0;
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run", teacher: teacher.name, student: student.name, studentId: STUDENT_ID,
      folder: "A2", folderId, folderCreated: apply && !folders.length, wouldCreateFolder: !folders.length,
      title: lesson.title, lessonId, lessonAlreadyExisted: Boolean(existingLesson), wouldCreateLesson: !existingLesson,
      assignmentId, assignmentAlreadyExisted: Boolean(existingAssignment), wouldCreateAssignment: !existingAssignment,
      words: lesson.words.length, studentSections: publicRegularLessonSections(lesson.sections).length,
      teacherSections: lesson.sections.length, automaticLessonAnswers: 81, homeworkExercises: lesson.homework[0].exercises.length,
      activeLessonChanged: apply && switchActive, wouldChangeActiveLesson: switchActive,
      previousActiveAssignmentId: previousActiveId, previousActiveTitle: previousAssignment?.title ?? null,
      previousAnswerFieldsPreserved: Object.keys(previousAssignment?.answers ?? {}).length,
      previousHighlightsPreserved: Object.keys(previousAssignment?.highlights ?? {}).length,
      previousOpenSectionsPreserved: previousAssignment?.open_sections.length ?? 0,
      existingLessonsOverwritten: false, existingStudentWorkOverwritten: false, unrelatedClassStatePreserved: true,
      teacherClassSelectionChanged: false, notificationsSent: false, realtimeEventsPublished,
      ...(!apply && switchActive ? { applyExpectedActiveArgument: `--expected-active=${previousActiveId ?? "none"}` } : {}),
    }, null, 2));
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: { name?: string; code?: string; message?: string }) => {
  // Do not print database messages or connection details, which can contain secrets.
  console.error({ stage: "create-a2-popular-questions", type: error.name, code: error.code, ...(error.name === "AssertionError" ? { message: error.message } : {}) });
  process.exitCode = 1;
});
