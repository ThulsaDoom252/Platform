import type { HomeworkExercise, HomeworkItem, InteractiveHomeworkPlan } from './lesson-homework';

export type VocabularyHomeworkWord = { word: string; description?: string | null; translation?: string | null; examples?: { en: string }[] };
export const VOCABULARY_MAIN_LIMIT = 8;
const kinds = ['fill', 'definition', 'describe'] as const;
type Kind = typeof kinds[number];
const labels: Record<Kind, string> = { fill: 'Fill in the gaps', definition: 'Guess by meaning', describe: 'Explain the meaning' };
const instructions: Record<Kind, string> = { fill: 'Complete each sentence with a word or phrase from the list.', definition: 'Read the meaning and write the matching word or phrase.', describe: 'Explain each word or phrase in your own English.' };
const vocabularyLabel = /(?:vocab(?:ulary)?|слов(?:ар|ник))/iu;
const key = (word: string) => word.trim().toLowerCase().replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
function hash(value: string) { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return (result >>> 0).toString(16); }
function aliases(word: string) {
  const plain = word.replace(/\((?:UK|US)\)/gi, '').split('→')[0].trim();
  const forms = [word, plain, plain.replace(/\s+(?:smth|smbd|sth|sb|something|somebody|someone)(?:\s+or\s+(?:something|somebody|someone))?$/i, ''), ...plain.split(/\s*\/\s*/), plain.replace(/\s*\([^)]*\)/g, ''), ...[...plain.matchAll(/\(([^)]+)\)/g)].map(match => match[1])];
  return [...new Set(forms.flatMap(form => [key(form), key(form.replace(/^(?:a|an|the|to)\s+/i, ''))]).filter(Boolean))];
}

/** Grammar/lexis fill exercises are deliberately outside this vocabulary rule. */
export function isVocabularyHomeworkExercise(exercise: HomeworkExercise, plan: InteractiveHomeworkPlan) {
  if (!kinds.includes(exercise.kind as Kind)) return false;
  const text = `${exercise.id} ${exercise.title}`;
  if (vocabularyLabel.test(text)) return true;
  if (exercise.id.startsWith('regular-')) return false;
  if (exercise.items.some(item => item.vocabularyWord)) return true;
  const hasVocabulary = plan.exercises.some(item => vocabularyLabel.test(`${item.id} ${item.title}`));
  return hasVocabulary && (exercise.kind === 'definition' || (exercise.kind === 'describe' && exercise.items.some(item => item.word)));
}

/** One target occurs once, with three required groups (up to 8) and optional overflow. */
export function organizeVocabularyHomework(plan: InteractiveHomeworkPlan, lexicon: VocabularyHomeworkWord[] = [], options: { includeAllWords?: boolean } = {}): InteractiveHomeworkPlan {
  const exercises = plan.exercises.filter(exercise => isVocabularyHomeworkExercise(exercise, plan));
  if (!exercises.length) return plan;
  type VocabularyRecord = { word: string; meaning?: string | null; translation?: string | null; examples?: { en: string }[]; items: Partial<Record<Kind, HomeworkItem>> };
  const records = new Map<string, VocabularyRecord>();
  const information = new Map<string, VocabularyRecord>();
  if (!lexicon.length) lexicon = exercises.flatMap(exercise => exercise.kind === 'definition' || exercise.kind === 'describe'
    ? exercise.items.flatMap(item => { const word = item.vocabularyWord || item.word || item.answer; return word ? [{ word, description: exercise.kind === 'definition' ? item.prompt : undefined }] : []; }) : []);
  const lookup = new Map<string, string>();
  // Exact headwords take precedence over aliases: 'spark' and 'to spark' are different entries.
  for (const entry of lexicon) {
    const record = { word: entry.word, meaning: entry.description, translation: entry.translation, examples: entry.examples, items: {} };
    information.set(key(entry.word), record);
    if (options.includeAllWords) records.set(key(entry.word), record);
  }
  for (const entry of lexicon) for (const alias of aliases(entry.word)) if (!lookup.has(alias)) lookup.set(alias, key(entry.word));
  for (const entry of lexicon) lookup.set(key(entry.word), key(entry.word));
  // Meaning tasks retain full headwords and accepted cloze forms ('to accuse somebody of something' / 'to accuse').
  // Learn those forms before reading fill tasks, without overriding distinct dictionary entries.
  for (const exercise of exercises.filter(e => e.kind !== 'fill')) for (const item of exercise.items) {
    const canonical = lookup.get(key(item.vocabularyWord || item.word || item.answer || ''));
    if (canonical) for (const alias of item.accepted ?? []) if (!lookup.has(key(alias))) lookup.set(key(alias), canonical);
  }
  for (const exercise of exercises) for (const item of exercise.items) {
    const target = item.vocabularyWord || item.word || item.answer || (exercise.kind === 'describe' ? item.prompt : '');
    if (!target) continue;
    const canonical = lookup.get(key(target)) || (item.accepted ?? []).map(alias => lookup.get(key(alias))).find(Boolean) || key(target);
    const record = records.get(canonical) ?? information.get(canonical) ?? { word: target, items: {} };
    if (!record.items[exercise.kind as Kind]) record.items[exercise.kind as Kind] = item;
    if (exercise.kind === 'definition') record.meaning ||= item.prompt;
    records.set(canonical, record);
    lookup.set(key(target), canonical);
  }
  if (!records.size) return plan;
  const main = exercises.filter(exercise => !exercise.optional);
  const existingTargets = exercises.flatMap(exercise => exercise.items.map(item => item.vocabularyWord ? key(item.vocabularyWord) : ''));
  if (main.length === Math.min(3, records.size) && new Set(main.map(exercise => exercise.kind)).size === main.length
    && exercises.every(exercise => exercise.items.length <= VOCABULARY_MAIN_LIMIT)
    && existingTargets.every(Boolean) && new Set(existingTargets).size === existingTargets.length
    && (!options.includeAllWords || [...records.keys()].every(word => existingTargets.includes(word)))) {
    // Preserve manual shuffles and edits once the plan already obeys the rule.
    return plan;
  }
  const ordered = [...records.entries()].sort(([left], [right]) => hash(`${plan.title}:${left}`).localeCompare(hash(`${plan.title}:${right}`)));
  const used = new Set<string>();
  const totalMain = Math.min(ordered.length, kinds.length * VOCABULARY_MAIN_LIMIT);
  const targets = kinds.map((_, index) => Math.floor(totalMain / 3) + (index < totalMain % 3 ? 1 : 0));
  const groups: Record<Kind, { main: HomeworkItem[]; bonus: HomeworkItem[] }> = { fill: { main: [], bonus: [] }, definition: { main: [], bonus: [] }, describe: { main: [], bonus: [] } };
  const itemFor = (canonical: string, entry: VocabularyRecord, kind: Kind): HomeworkItem => {
    const previous = entry.items[kind];
    if (previous) return { ...previous, vocabularyWord: entry.word };
    const id = `vh-${kind}-${hash(`${plan.title}:${canonical}`)}`;
    if (kind === 'describe') return { id, word: entry.word, prompt: entry.word, vocabularyWord: entry.word };
    const headword = entry.word.replace(/^(?:a|an|the|to)\s+/i, '').replace(/\s*\([^)]*\)/g, '').split('→')[0].trim();
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`\\b${escape(headword)}\\b`, 'i');
    const meaning = entry.meaning?.replace(match, '').replace(/\s+/g, ' ').trim().replace(/\bAn (?=[b-df-hj-np-tv-z])/gi, 'A ')
      || (entry.translation ? `An English word or phrase meaning “${entry.translation}”.` : `Which word fits this context: ${entry.items.fill?.prompt ?? 'Explain the meaning from the lesson.'}`);
    if (kind === 'definition') return { id, prompt: meaning, answer: entry.word, vocabularyWord: entry.word };
    const example = entry.examples?.map(item => item.en).find(text => match.test(text));
    return { id, prompt: example ? example.replace(match, '___') : `The word or phrase meaning “${entry.translation || meaning}” is ___.`, answer: example?.match(match)?.[0] || entry.word, accepted: [entry.word], vocabularyWord: entry.word };
  };
  kinds.forEach((kind, index) => {
    const candidates = ordered.filter(([canonical]) => !used.has(canonical));
    candidates.sort(([, left], [, right]) => Number(Boolean(right.items[kind])) - Number(Boolean(left.items[kind])));
    for (const [canonical, entry] of candidates.slice(0, targets[index])) { used.add(canonical); groups[kind].main.push(itemFor(canonical, entry, kind)); }
  });
  ordered.filter(([canonical]) => !used.has(canonical)).forEach(([canonical, entry], index) => {
    const kind = kinds[index % kinds.length];
    groups[kind].bonus.push(itemFor(canonical, entry, kind));
  });
  const organized: HomeworkExercise[] = [];
  kinds.forEach((kind, index) => {
    const main = exercises.find(exercise => exercise.kind === kind && !exercise.optional);
    const bonus = exercises.filter(exercise => exercise.kind === kind && exercise.optional);
    const create = (id: string, items: HomeworkItem[], optional: boolean, part = 0): HomeworkExercise => {
      const bank = items.map(item => item.answer || item.vocabularyWord || item.word || '').filter(Boolean);
      bank.sort((left, right) => hash(`${id}:bank:${left}`).localeCompare(hash(`${id}:bank:${right}`)));
      if (bank.length > 1 && bank.every((word, at) => word === items[at].answer)) bank.push(bank.shift()!);
      return { id, title: optional ? `Bonus — ${labels[kind]}${part > 0 ? ` (${part + 1})` : ''}` : `Vocabulary ${index + 1} — ${labels[kind]}`, instruction: instructions[kind], kind, optional, items, ...(kind !== 'describe' ? { wordBank: [...new Set(bank)] } : {}) };
    };
    if (groups[kind].main.length) organized.push(create(main?.id || `vocab-${kind}-${hash(plan.title)}`, groups[kind].main, false));
    for (let at = 0; at < groups[kind].bonus.length; at += VOCABULARY_MAIN_LIMIT) {
      const part = at / VOCABULARY_MAIN_LIMIT;
      organized.push(create(bonus[part]?.id || `vocab-${kind}-bonus-${part + 1}-${hash(plan.title)}`, groups[kind].bonus.slice(at, at + VOCABULARY_MAIN_LIMIT), true, part));
    }
  });
  return { ...plan, exercises: [...organized, ...plan.exercises.filter(exercise => !exercises.includes(exercise))] };
}
