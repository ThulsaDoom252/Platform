/** Dry-run by default. --apply backs up affected rows before an atomic rewrite. */
import { config } from 'dotenv';
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { normalizeInteractiveHomework, homeworkAssignedExercisesKey, homeworkPlanOverrideKey, type InteractiveHomeworkPlan } from '../src/lib/lesson-homework';
import { organizeVocabularyHomework, isVocabularyHomeworkExercise, type VocabularyHomeworkWord } from '../src/lib/vocabulary-homework';
config({ path: '.env.production.local', quiet: true });
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL });
const apply = process.argv.includes('--apply');
function organized(raw: unknown, words: VocabularyHomeworkWord[], includeAllWords = false) {
  const plan = normalizeInteractiveHomework(raw, { allowEmpty: true, organizeVocabulary: false });
  if (!plan) return null;
  const vocabulary = plan.exercises.filter(e => isVocabularyHomeworkExercise(e, plan));
  if (!vocabulary.length) return null;
  const original = raw as InteractiveHomeworkPlan;
  const vocabularyIds = new Set(vocabulary.map(e => e.id));
  const untouched = new Map(original.exercises.filter(e => !vocabularyIds.has(e.id)).map(e => [e.id, e]));
  const result = organizeVocabularyHomework(plan, words, { includeAllWords });
  const revised = { ...original, exercises: result.exercises.map(e => untouched.get(e.id) ?? e) };
  for (const [id, exercise] of untouched) assert(equalJson(revised.exercises.find(e => e.id === id), exercise), `Non-vocabulary exercise changed: ${id}`);
  return revised;
}
const equalJson = (left: unknown, right: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(left ?? null)), JSON.parse(JSON.stringify(right ?? null)));
function validate(plan: InteractiveHomeworkPlan) {
  const vocabulary = plan.exercises.filter(e => isVocabularyHomeworkExercise(e, plan));
  if (!vocabulary.length) return;
  const main = vocabulary.filter(e => !e.optional);
  if (vocabulary.flatMap(e => e.items).length >= 3) assert.deepEqual(main.map(e => e.kind), ['fill', 'definition', 'describe']);
  assert(vocabulary.every(e => e.items.length <= 8), 'A vocabulary group exceeds eight targets');
  const targets = vocabulary.flatMap(e => e.items.map(i => i.vocabularyWord));
  assert(targets.every(Boolean));
  assert.equal(new Set(targets.map(word => word!.toLowerCase())).size, targets.length, 'Vocabulary repeats across groups');
  const ids = vocabulary.flatMap(e => e.items.map(i => i.id));
  assert.equal(new Set(ids).size, ids.length, `Duplicate item ID in ${plan.title}: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(', ')}`);
  assert(equalJson(organized(plan, []), plan), 'Rebalancing is not idempotent');
}
async function main() {
  const client = await pool.connect();
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    const { rows: units } = await client.query(`select id,title,homework,vocab_node_id,updated_at
      from lesson_units where author_id=(select id from users where role='TEACHER' order by created_at limit 1)
      order by title ${apply ? 'FOR UPDATE' : ''}`);
    const { rows: wordRows } = await client.query('select unit_id, word, description, translation, examples from lesson_words where unit_id=any($1::uuid[]) order by sort_order', [units.map(u => u.id)]);
    const { rows: phrases } = await client.query("select node_id, phrase as word, description, translation, examples from material_phrases where node_id=any($1::uuid[]) and kind='PHRASE' order by sort_order", [units.map(u => u.vocab_node_id).filter(Boolean)]);
    const wordsFor = (unit: typeof units[number]): VocabularyHomeworkWord[] => {
      const words = wordRows.filter(w => w.unit_id === unit.id);
      return words.length ? words : phrases.filter(p => p.node_id === unit.vocab_node_id);
    };
    const revisedUnits = units.map(unit => {
      const homework = (unit.homework ?? []).map((entry: unknown) => organized(entry, wordsFor(unit), true) ?? entry);
      for (const entry of homework) if (entry.kind === 'INTERACTIVE_HOMEWORK_V1') validate(entry);
      return { unit, homework, changed: !equalJson(unit.homework, homework) };
    });
    const { rows: assignments } = await client.query(`select id,unit_id,answers,content_override,updated_at
      from lesson_assignments where unit_id=any($1::uuid[]) ${apply ? 'FOR UPDATE' : ''}`, [units.map(u => u.id)]);
    const revisedAssignments = assignments.map(assignment => {
      const revised = revisedUnits.find(u => u.unit.id === assignment.unit_id)!;
      const words = wordsFor(revised.unit);
      const answers = { ...assignment.answers };
      const contentOverride = assignment.content_override ? { ...assignment.content_override } : null;
      let oldPlan = normalizeInteractiveHomework(revised.unit.homework?.find((e: {kind?: string}) => e.kind === 'INTERACTIVE_HOMEWORK_V1'), { organizeVocabulary: false });
      let newPlan = revised.homework.find((e: {kind?: string}) => e.kind === 'INTERACTIVE_HOMEWORK_V1') as InteractiveHomeworkPlan | undefined;
      if (contentOverride?.interactiveHomework) {
        oldPlan = normalizeInteractiveHomework(contentOverride.interactiveHomework, { organizeVocabulary: false });
        newPlan = organized(contentOverride.interactiveHomework, words) ?? undefined;
        if (newPlan) contentOverride.interactiveHomework = newPlan;
      }
      if (answers[homeworkPlanOverrideKey()]) {
        const raw = JSON.parse(answers[homeworkPlanOverrideKey()]);
        oldPlan = normalizeInteractiveHomework(raw, { organizeVocabulary: false });
        newPlan = organized(raw, words) ?? undefined;
        if (newPlan && !equalJson(raw, newPlan)) answers[homeworkPlanOverrideKey()] = JSON.stringify(newPlan);
      }
      if (newPlan) validate(newPlan);
      const selectionKey = homeworkAssignedExercisesKey();
      if (oldPlan && newPlan && answers[selectionKey]) {
        const selected = new Set<string>(JSON.parse(answers[selectionKey]));
        const oldVocabulary = oldPlan.exercises.filter(e => isVocabularyHomeworkExercise(e, oldPlan!));
        if (oldVocabulary.some(e => selected.has(e.id))) {
          const newVocabulary = newPlan.exercises.filter(e => isVocabularyHomeworkExercise(e, newPlan!));
          const nonVocabulary = newPlan.exercises.filter(e => !isVocabularyHomeworkExercise(e, newPlan!) && selected.has(e.id));
          answers[selectionKey] = JSON.stringify(newPlan.exercises.filter(e => newVocabulary.includes(e) || nonVocabulary.includes(e)).map(e => e.id));
        }
      }
      // Answers, attempts, marks, notes, review timestamps and scores are never erased.
      for (const [key, value] of Object.entries(assignment.answers ?? {})) {
        if (key !== homeworkPlanOverrideKey() && key !== homeworkAssignedExercisesKey()) assert.equal(answers[key], value);
      }
      return { assignment, answers, contentOverride, changed: !equalJson(answers, assignment.answers) || !equalJson(contentOverride, assignment.content_override) };
    });
    const affected = revisedUnits.filter(u => u.changed);
    const changedAssignments = revisedAssignments.filter(a => a.changed);
    const part9 = revisedUnits.find(u => /mendel.*part\s*9/i.test(u.unit.title));
    assert(part9, 'Mendel Part 9 was not found');
    const plan9 = part9.homework.find((e: {kind?: string}) => e.kind === 'INTERACTIVE_HOMEWORK_V1') as InteractiveHomeworkPlan;
    const vocabulary9 = plan9.exercises.filter(e => isVocabularyHomeworkExercise(e, plan9));
    const part9Targets = vocabulary9.flatMap(e => e.items.map(i => i.vocabularyWord));
    if (part9Targets.length !== 43) console.log({ part9TargetCount: part9Targets.length, unrecognizedTargets: part9Targets.filter(word => !wordsFor(part9.unit).some(entry => entry.word === word)) });
    assert.equal(part9Targets.length, 43, 'Part 9 must retain all 43 words');
    assert.deepEqual(vocabulary9.filter(e => !e.optional).map(e => e.items.length), [8, 8, 8]);
    if (apply && (affected.length || changedAssignments.length)) {
      const folder = resolve('backups');
      mkdirSync(folder, { recursive: true });
      const file = resolve(folder, `vocabulary-homework-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), units: affected.map(u => u.unit), assignments: changedAssignments.map(a => a.assignment) }, null, 2), { flag: 'wx', mode: 0o600 });
      console.log(`Backup saved: ${file}`);
      for (const { unit, homework } of affected) await client.query('update lesson_units set homework=$1::jsonb, updated_at=now() where id=$2', [JSON.stringify(homework), unit.id]);
      for (const { assignment, answers, contentOverride } of changedAssignments) await client.query('update lesson_assignments set answers=$1::jsonb,content_override=$2::jsonb,updated_at=now() where id=$3', [JSON.stringify(answers), contentOverride === null ? null : JSON.stringify(contentOverride), assignment.id]);
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', changedTemplates: affected.length, changedAssignedCopies: changedAssignments.length, templates: affected.map(({unit,homework}) => ({title:unit.title, dictionaryWords:wordsFor(unit).length, additionalTargets:homework.flatMap((p: InteractiveHomeworkPlan) => p.kind === 'INTERACTIVE_HOMEWORK_V1' ? p.exercises.filter(e => isVocabularyHomeworkExercise(e,p)).flatMap(e => e.items.map(i => i.vocabularyWord)).filter(word => !wordsFor(unit).some(entry => entry.word === word)) : []), vocabulary: homework.flatMap((p: InteractiveHomeworkPlan) => p.kind === 'INTERACTIVE_HOMEWORK_V1' ? p.exercises.filter(e => isVocabularyHomeworkExercise(e,p)).map(e => ({kind:e.kind,bonus:!!e.optional,count:e.items.length})) : [])})), part9: { main: [8,8,8], bonus: vocabulary9.filter(e => e.optional).flatMap(e => e.items).length } }, null, 2));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error({type: error.name, message: error.message.split('\n')[0]}); process.exitCode = 1; });
