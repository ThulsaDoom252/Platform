import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInteractiveHomework, type HomeworkExercise, type InteractiveHomeworkPlan } from '../src/lib/lesson-homework';
import { organizeVocabularyHomework, isVocabularyHomeworkExercise } from '../src/lib/vocabulary-homework';
function fixture(count = 43): InteractiveHomeworkPlan {
  const words = Array.from({ length: count }, (_, index) => `word ${index + 1}`);
  const exercises: HomeworkExercise[] = (['fill', 'definition', 'describe'] as const).map(kind => ({
    id: `vocab-${kind}`, title: `Vocabulary ${kind}`, instruction: 'Practise', kind,
    items: words.map((word, index) => ({ id: `${kind}-${index}`, prompt: kind === 'fill' ? 'Use ___ here.' : kind === 'definition' ? `Meaning ${index}` : word, ...(kind === 'describe' ? { word } : { answer: word }) })),
  }));
  return { kind: 'INTERACTIVE_HOMEWORK_V1', title: 'Mendel Part 9 test', exercises };
}
test('43 words become 8 + 8 + 8 required targets and 19 optional targets, without repeats', () => {
  const original = fixture();
  const result = organizeVocabularyHomework(original);
  const main = result.exercises.filter(e => !e.optional);
  assert.deepEqual(main.map(e => [e.kind, e.items.length]), [['fill', 8], ['definition', 8], ['describe', 8]]);
  assert.equal(result.exercises.filter(e => e.optional).flatMap(e => e.items).length, 19);
  const targets = result.exercises.flatMap(e => e.items.map(i => i.vocabularyWord));
  assert.equal(new Set(targets).size, 43);
  assert(result.exercises.every(e => e.items.length <= 8));
  assert.equal(original.exercises[0].items.length, 43);
  assert.deepEqual(organizeVocabularyHomework(result), result);
});
test('existing item IDs and unrelated grammar, translations and questions survive', () => {
  const plan = fixture();
  const grammar: HomeworkExercise = { id: 'grammar', title: 'Grammar — Possessives', instruction: '', kind: 'fill', items: [{ id: 'g', prompt: 'This is ___ pen.', answer: 'my' }] };
  const translation: HomeworkExercise = { id: 'translation', title: 'Translation', instruction: '', kind: 'translate', items: [{ id: 't', prompt: 'Переведи' }] };
  plan.exercises.push(grammar, translation);
  const ids = new Set(plan.exercises.flatMap(e => e.items.map(i => i.id)));
  const result = organizeVocabularyHomework(plan);
  assert(result.exercises.flatMap(e => e.items).every(item => ids.has(item.id)));
  assert.equal(result.exercises.find(e => e.id === 'grammar'), grammar);
  assert.equal(result.exercises.find(e => e.id === 'translation'), translation);
  assert.equal(isVocabularyHomeworkExercise(grammar, plan), false);
});
test('short vocabularies are balanced across three kinds', () => {
  assert.deepEqual(organizeVocabularyHomework(fixture(10)).exercises.map(e => e.items.length), [4, 3, 3]);
});
test('large dictionaries have eight-word bonus chunks and isolated word banks', () => {
  const result = organizeVocabularyHomework(fixture(80));
  assert.equal(result.exercises.filter(e => !e.optional).flatMap(e => e.items).length, 24);
  assert.equal(result.exercises.filter(e => e.optional).flatMap(e => e.items).length, 56);
  assert(result.exercises.every(e => e.items.length <= 8));
  assert.equal(new Set(result.exercises.flatMap(e => e.items.map(i => i.vocabularyWord))).size, 80);
  for (const exercise of result.exercises.filter(e => e.kind !== 'describe')) {
    assert.deepEqual(new Set(exercise.wordBank), new Set(exercise.items.map(i => i.answer)));
    assert(exercise.items.every(i => !i.word));
  }
  assert.deepEqual(organizeVocabularyHomework(result), result);
});
test('normalization applies the global rule, keeps target metadata, and does not reorder a teacher shuffle', () => {
  const plan = normalizeInteractiveHomework(fixture())!;
  plan.exercises[0].items.reverse();
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeInteractiveHomework(plan))), JSON.parse(JSON.stringify(plan)));
  const fill = plan.exercises[0];
  assert.notDeepEqual(fill.wordBank, fill.items.map(i => i.answer));
});
test('dictionary metadata supplies a missing meaning exercise and covers every dictionary entry', () => {
  const plan = fixture(10);
  plan.exercises = plan.exercises.filter(e => e.kind !== 'definition');
  const words = Array.from({ length: 13 }, (_, index) => ({ word: `word ${index + 1}`, description: `An object with property ${index + 1}.`, translation: 'перевод' }));
  const result = organizeVocabularyHomework(plan, words, { includeAllWords: true });
  assert.deepEqual(result.exercises.filter(e => !e.optional).map(e => e.kind), ['fill', 'definition', 'describe']);
  assert.equal(result.exercises.flatMap(e => e.items).length, 13);
  assert(result.exercises.find(e => e.kind === 'definition')!.items.every(i => i.prompt.startsWith('An object')));
});
test('custom student word subsets remain subsets, and noun/verb headwords stay distinct', () => {
  const plan = fixture(0);
  plan.exercises[0].items = [{ id: 'noun', prompt: 'A ___ of light.', answer: 'spark' }, { id: 'verb', prompt: 'It may ___ a debate.', answer: 'to spark', accepted: ['spark'] }];
  const words = [{ word: 'spark', description: 'A tiny flash of fire.' }, { word: 'to spark', description: 'To cause something to begin.' }, { word: 'other', description: 'Other meaning.' }];
  const result = organizeVocabularyHomework(plan, words);
  assert.equal(result.exercises.flatMap(e => e.items).length, 2);
  assert.deepEqual(new Set(result.exercises.flatMap(e => e.items.map(i => i.vocabularyWord))), new Set(['spark', 'to spark']));
});
test('a shortened cloze answer is the same target as its full dictionary phrase', () => {
  const plan = fixture(0);
  plan.exercises[0].items = [{ id: 'fill-accuse', prompt: 'They tried ___ him of treason.', answer: 'to accuse' }];
  plan.exercises[1].items = [{ id: 'meaning-accuse', prompt: 'To say somebody did something wrong.', answer: 'to accuse somebody of something', accepted: ['to accuse', 'accuse'] }];
  plan.exercises[2].items = [{ id: 'explain-accuse', prompt: 'to accuse somebody of something', word: 'to accuse somebody of something' }];
  const result = organizeVocabularyHomework(plan, [{ word: 'to accuse somebody of something', description: 'To say somebody did something wrong.' }], { includeAllWords: true });
  assert.equal(result.exercises.flatMap(e => e.items).length, 1);
  assert.equal(result.exercises[0].items[0].vocabularyWord, 'to accuse somebody of something');
  assert.equal(result.exercises[0].items[0].id, 'fill-accuse');
});
test('dictionary shorthand smth does not create a second target for its cloze answer', () => {
  const plan = fixture(0);
  plan.exercises[0].items = [{ id: 'fill-excuses', prompt: 'It is easy ___ a friend.', answer: 'to make excuses for' }];
  plan.exercises[2].items = [{ id: 'explain-excuses', prompt: 'to make excuses for smth', word: 'to make excuses for smth' }];
  const result = organizeVocabularyHomework(plan, [{ word: 'to make excuses for smth', description: 'To justify somebody’s behaviour.' }], { includeAllWords: true });
  assert.equal(result.exercises.flatMap(e => e.items).length, 1);
  assert.equal(result.exercises[0].items[0].vocabularyWord, 'to make excuses for smth');
});
