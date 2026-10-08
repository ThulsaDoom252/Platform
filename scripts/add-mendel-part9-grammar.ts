/** Exact production lesson only. Dry-run by default; --apply backs up before writing. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool } from "pg";
import {
  homeworkAssignedAt,
  homeworkAssignedExerciseIds,
  homeworkAssignedExercisesKey,
  homeworkPlanOverrideKey,
  homeworkRemovedAt,
  normalizeInteractiveHomework,
  type HomeworkStoredState,
  type InteractiveHomeworkPlan,
  type LessonHomeworkEntry,
} from "../src/lib/lesson-homework";
import {
  addPart9Grammar,
  addPart9GrammarToState,
  PART9_GRAMMAR_IDS,
} from "../src/lib/bundled-lessons/tucker-mendel-part-9-grammar";

const UNIT_ID = "b8946a05-55b4-42c5-a3f5-fff315b950dd";
const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const apply = process.argv.includes("--apply");
const environment = config({ path: ".env.production.local", quiet: true }).parsed;
const connectionString = environment?.NEON_DATABASE_URL || environment?.DATABASE_URL;
assert(connectionString, "Production database configuration is missing");
const connection = new URL(connectionString);
assert(connection.hostname !== "base", "Production database configuration is a placeholder");
connection.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 10_000, max: 1 });

type Unit = { id: string; title: string; author_id: string; homework: LessonHomeworkEntry[]; updated_at: Date };
type Assignment = {
  id: string;
  unit_id: string;
  answers: HomeworkStoredState;
  content_override: Record<string, unknown> | null;
  updated_at: Date;
};

function checkPlan(raw: unknown): InteractiveHomeworkPlan {
  const plan = normalizeInteractiveHomework(raw, { allowEmpty: true, organizeVocabulary: false });
  assert(plan, "Part 9 has an invalid homework plan");
  return raw as InteractiveHomeworkPlan;
}

function validatePlan(plan: InteractiveHomeworkPlan) {
  for (const id of PART9_GRAMMAR_IDS) {
    const exercises = plan.exercises.filter((exercise) => exercise.id === id);
    assert.equal(exercises.length, 1, "Grammar exercise is missing or duplicated");
    assert.equal(exercises[0].items.length, 8, "Grammar exercise must contain eight sentences");
  }
  const ids = plan.exercises.flatMap((exercise) => exercise.items.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length, "Homework item IDs are duplicated");
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    const { rows: units } = await client.query<Unit>(
      `SELECT id,title,author_id,homework,updated_at FROM lesson_units
       WHERE id=$1 AND author_id=$2 ${apply ? "FOR UPDATE" : ""}`,
      [UNIT_ID, AUTHOR_ID],
    );
    assert.equal(units.length, 1, "The exact teacher's Part 9 lesson was not found");
    const unit = units[0];
    assert(/tucker.*mendel.*part\s*9/i.test(unit.title), "Unexpected lesson title");
    let plans = 0;
    const homework = unit.homework.map((entry) => {
      if (!("kind" in entry) || entry.kind !== "INTERACTIVE_HOMEWORK_V1") return entry;
      plans += 1;
      const revised = addPart9Grammar(checkPlan(entry));
      validatePlan(revised);
      for (const exercise of entry.exercises) {
        assert.deepEqual(revised.exercises.find((candidate) => candidate.id === exercise.id), exercise);
      }
      return revised;
    });
    assert.equal(plans, 1, "Expected exactly one Part 9 homework template");
    const template = homework.find((entry) => "kind" in entry) as InteractiveHomeworkPlan;
    const { rows: assignments } = await client.query<Assignment>(
      `SELECT id,unit_id,answers,content_override,updated_at FROM lesson_assignments
       WHERE unit_id=$1 ${apply ? "FOR UPDATE" : ""}`,
      [UNIT_ID],
    );
    const copies = assignments.map((assignment) => {
      const answers = addPart9GrammarToState(assignment.answers ?? {});
      const contentOverride = assignment.content_override ? { ...assignment.content_override } : null;
      if (contentOverride?.interactiveHomework) {
        contentOverride.interactiveHomework = addPart9Grammar(checkPlan(contentOverride.interactiveHomework));
        validatePlan(contentOverride.interactiveHomework as InteractiveHomeworkPlan);
      }
      const overrideKey = homeworkPlanOverrideKey();
      const activePlan = answers[overrideKey]
        ? checkPlan(JSON.parse(answers[overrideKey]))
        : contentOverride?.interactiveHomework
          ? checkPlan(contentOverride.interactiveHomework)
          : template;
      validatePlan(activePlan);
      if (homeworkAssignedAt(answers) && !homeworkRemovedAt(answers)) {
        const selected = homeworkAssignedExerciseIds(activePlan, answers);
        assert(PART9_GRAMMAR_IDS.every((id) => selected.includes(id)), "Assigned homework is missing grammar");
      }
      for (const [key, value] of Object.entries(assignment.answers ?? {})) {
        if (key !== overrideKey && key !== homeworkAssignedExercisesKey()) assert.equal(answers[key], value);
      }
      return {
        assignment, answers, contentOverride,
        changed: !isDeepStrictEqual(answers, assignment.answers) || !isDeepStrictEqual(contentOverride, assignment.content_override),
      };
    });
    const templateChanged = !isDeepStrictEqual(homework, unit.homework);
    const changedCopies = copies.filter((copy) => copy.changed);
    if (apply && (templateChanged || changedCopies.length)) {
      const folder = resolve("backups");
      mkdirSync(folder, { recursive: true });
      const backup = resolve(folder, `mendel-part9-grammar-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeFileSync(backup, JSON.stringify({
        createdAt: new Date().toISOString(),
        unit: templateChanged ? unit : null,
        assignments: changedCopies.map((copy) => copy.assignment),
      }, null, 2), { flag: "wx", mode: 0o600 });
      console.log(`Backup saved: ${backup}`);
      if (templateChanged) {
        await client.query("UPDATE lesson_units SET homework=$1::jsonb,updated_at=now() WHERE id=$2 AND author_id=$3", [JSON.stringify(homework), UNIT_ID, AUTHOR_ID]);
      }
      for (const copy of changedCopies) {
        await client.query("UPDATE lesson_assignments SET answers=$1::jsonb,content_override=$2::jsonb,updated_at=now() WHERE id=$3 AND unit_id=$4", [
          JSON.stringify(copy.answers), copy.contentOverride === null ? null : JSON.stringify(copy.contentOverride), copy.assignment.id, UNIT_ID,
        ]);
      }
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({
      mode: apply ? "applied" : "dry-run",
      lessonId: UNIT_ID,
      title: unit.title,
      changedTemplates: Number(templateChanged),
      changedAssignedCopies: changedCopies.length,
      grammar: template.exercises.filter((exercise) => PART9_GRAMMAR_IDS.includes(exercise.id))
        .map((exercise) => ({ id: exercise.id, kind: exercise.kind, sentences: exercise.items.length, language: exercise.translationLanguage })),
      existingAnswersPreserved: true,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error: { name?: string; code?: string }) => {
  console.error({ stage: "mendel-part9-grammar", type: error.name, code: error.code });
  process.exitCode = 1;
}).finally(() => pool.end());
