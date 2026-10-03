/** Portable definition and state helpers for an interactive lesson homework. */

export type HomeworkExerciseKind =
  | "fill"
  | "definition"
  | "describe"
  | "drag"
  | "translate"
  | "question-text"
  | "question-audio";

export type HomeworkItem = {
  id: string;
  prompt: string;
  /** Canonical answer for automatically checked tasks. */
  answer?: string;
  accepted?: string[];
  /** Word shown for an open description task. */
  word?: string;
  /** Short instruction such as “use slang” or “put though at the end”. */
  hint?: string;
};

export type HomeworkExercise = {
  id: string;
  title: string;
  instruction: string;
  kind: HomeworkExerciseKind;
  /** Direction for translation tasks; old homework defaults to translating into English. */
  translationDirection?: "to-english" | "from-english";
  optional?: boolean;
  wordBank?: string[];
  items: HomeworkItem[];
};

export type InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1";
  title: string;
  intro?: string;
  exercises: HomeworkExercise[];
};

export type HomeworkPlanEditIssue =
  | "empty-exercise"
  | "invalid-fill"
  | "missing-translation"
  | null;

export type LegacyHomeworkTask = { title: string; text: string };
export type LessonHomeworkEntry = LegacyHomeworkTask | InteractiveHomeworkPlan;
export type HomeworkStoredState = Record<string, string>;
export type HomeworkAutoStatus = "correct" | "locked" | null;

const EXERCISE_FOCUS = "homework:exercise:";
const ITEM_FOCUS = "homework:item:";
const HIGHLIGHT = "hw:highlight:";
const TEXT_HIGHLIGHT = "hw:text-highlight:";
const REACTION = "hw:reaction:";

export type HomeworkHighlightColor = "yellow" | "green" | "red";
export type HomeworkReaction =
  | "thumbs-up"
  | "happy"
  | "angry"
  | "check"
  | "warning"
  | "cross";
export type HomeworkReactionTarget = "exercise" | "item";
export type HomeworkTextHighlightSource =
  | "word"
  | "prompt"
  | "prompt-before"
  | "prompt-after"
  | "answer";

export type HomeworkTextToken = {
  text: string;
  highlightable: boolean;
};

const HOMEWORK_REACTIONS = new Set<HomeworkReaction>([
  "thumbs-up",
  "happy",
  "angry",
  "check",
  "warning",
  "cross",
]);

const homeworkReactionKey = (
  target: HomeworkReactionTarget,
  id: string,
) => `${REACTION}${target}:${id}`;

export function homeworkReaction(
  state: HomeworkStoredState,
  target: HomeworkReactionTarget,
  id: string,
): HomeworkReaction | null {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/.test(id)) return null;
  const value = state[homeworkReactionKey(target, id)] as HomeworkReaction | undefined;
  return value && HOMEWORK_REACTIONS.has(value) ? value : null;
}

export function setHomeworkReaction(
  state: HomeworkStoredState,
  target: HomeworkReactionTarget,
  id: string,
  reaction: HomeworkReaction | null,
): HomeworkStoredState {
  const next = { ...state };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/.test(id)) return next;
  const key = homeworkReactionKey(target, id);
  if (!reaction) delete next[key];
  else if (HOMEWORK_REACTIONS.has(reaction)) next[key] = reaction;
  return next;
}

export const homeworkExerciseFocusId = (exerciseId: string) =>
  `${EXERCISE_FOCUS}${exerciseId}`;

export const homeworkItemFocusId = (itemId: string) =>
  `${ITEM_FOCUS}${itemId}`;

const validHighlightTarget = (value: unknown) => {
  const target = String(value ?? "");
  return target.length <= 256 && (
    target.startsWith(EXERCISE_FOCUS) || target.startsWith(ITEM_FOCUS)
  );
};

const homeworkHighlightKey = (focusId: string) => `${HIGHLIGHT}${focusId}`;

export function homeworkHighlight(
  state: HomeworkStoredState,
  focusId: string,
): HomeworkHighlightColor | null {
  if (!validHighlightTarget(focusId)) return null;
  const value = state[homeworkHighlightKey(focusId)];
  return value === "yellow" || value === "green" || value === "red" ? value : null;
}

export function toggleHomeworkHighlight(
  state: HomeworkStoredState,
  focusId: string,
  color: HomeworkHighlightColor,
): HomeworkStoredState {
  const next = { ...state };
  if (
    !validHighlightTarget(focusId) ||
    (color !== "yellow" && color !== "green" && color !== "red")
  ) return next;
  const key = homeworkHighlightKey(focusId);
  if (next[key] === color) delete next[key];
  else next[key] = color;
  return next;
}

/** Resolve a teacher focus target only when it belongs to this homework. */
export function homeworkFocusTarget(
  plan: InteractiveHomeworkPlan,
  value: unknown,
): { exerciseId: string; itemId: string | null } | null {
  const target = String(value ?? "");
  if (target.startsWith(EXERCISE_FOCUS)) {
    const exerciseId = target.slice(EXERCISE_FOCUS.length);
    return plan.exercises.some((exercise) => exercise.id === exerciseId)
      ? { exerciseId, itemId: null }
      : null;
  }
  if (target.startsWith(ITEM_FOCUS)) {
    const itemId = target.slice(ITEM_FOCUS.length);
    const found = findHomeworkItem(plan, itemId);
    return found ? { exerciseId: found.exercise.id, itemId } : null;
  }
  return null;
}

const VALUE = "hw:value:";
const STATUS = "hw:status:";
const ATTEMPTS = "hw:attempts:";
const NOTE = "hw:note:";
const NOTE_VISIBLE = "hw:note-visible:";
const EXERCISE_HIDDEN = "hw:exercise-hidden:";
const SUBMITTED_AT = "hw:submitted-at";
const REVIEWED_AT = "hw:reviewed-at";
const ASSIGNED_AT = "hw:assigned-at";
const ASSIGNED_EXERCISES = "hw:assigned-exercises";
const PLAN_OVERRIDE = "hw:plan-override";
const HOMEWORK_VOICE_TARGET_PREFIX = "homework:";

export const homeworkValueKey = (id: string) => `${VALUE}${id}`;
export const homeworkStatusKey = (id: string) => `${STATUS}${id}`;
export const homeworkAttemptsKey = (id: string) => `${ATTEMPTS}${id}`;
export const homeworkNoteKey = (id: string) => `${NOTE}${id}`;
export const homeworkNoteVisibleKey = (id: string) => `${NOTE_VISIBLE}${id}`;
export const homeworkExerciseHiddenKey = (id: string) => `${EXERCISE_HIDDEN}${id}`;
export const homeworkSubmittedAtKey = () => SUBMITTED_AT;
export const homeworkReviewedAtKey = () => REVIEWED_AT;
export const homeworkAssignedAtKey = () => ASSIGNED_AT;
export const homeworkAssignedExercisesKey = () => ASSIGNED_EXERCISES;
export const homeworkPlanOverrideKey = () => PLAN_OVERRIDE;
export const homeworkVoiceRecordingTarget = (itemId: string) =>
  `${HOMEWORK_VOICE_TARGET_PREFIX}${itemId}`;

export function homeworkVoiceRecordingItemId(value: unknown): string | null {
  const target = String(value ?? "");
  if (!target.startsWith(HOMEWORK_VOICE_TARGET_PREFIX)) return null;
  return cleanId(target.slice(HOMEWORK_VOICE_TARGET_PREFIX.length));
}

export function homeworkExerciseHidden(state: HomeworkStoredState, exerciseId: string) {
  return state[homeworkExerciseHiddenKey(exerciseId)] === "1";
}

export function homeworkSubmittedAt(state: HomeworkStoredState) {
  return state[SUBMITTED_AT] || null;
}

export function homeworkReviewedAt(state: HomeworkStoredState) {
  return state[REVIEWED_AT] || null;
}

export function homeworkAssignedAt(state: HomeworkStoredState) {
  return state[ASSIGNED_AT] || null;
}

/** Индивидуальная копия домашки, сохранённая внутри закрепления ученика. */
export function homeworkPlanOverride(state: HomeworkStoredState) {
  try {
    return normalizeInteractiveHomework(JSON.parse(state[PLAN_OVERRIDE] ?? "null"));
  } catch {
    return null;
  }
}

export function homeworkPlanForAssignment(
  template: InteractiveHomeworkPlan | null,
  state: HomeworkStoredState,
) {
  return homeworkPlanOverride(state) ?? template;
}

/** Старые блоки могут быть неполными; при персональной правке проверяем только изменённые. */
export function homeworkPlanEditIssue(
  previous: InteractiveHomeworkPlan,
  next: InteractiveHomeworkPlan,
): HomeworkPlanEditIssue {
  const oldExercises = new Map(previous.exercises.map((exercise) => [exercise.id, exercise]));
  const changed = next.exercises.filter((exercise) => {
    const old = oldExercises.get(exercise.id);
    return !old || JSON.stringify(old) !== JSON.stringify(exercise);
  });

  if (changed.some((exercise) =>
    exercise.items.length === 0 &&
    exercise.kind !== "question-text" &&
    exercise.kind !== "question-audio",
  )) return "empty-exercise";

  if (changed.some((exercise) =>
    exercise.kind === "fill" &&
    exercise.items.some((item) => !item.answer || !item.prompt.includes("___")),
  )) return "invalid-fill";

  if (changed.some((exercise) =>
    exercise.kind === "translate" && exercise.items.some((item) => !item.answer),
  )) return "missing-translation";

  return null;
}

/** В редакторе ответ отмечается прямо в предложении: I **have got to** go. */
export function homeworkFillEditorLine(item: HomeworkItem) {
  if (!item.answer) return item.prompt;
  return item.prompt.includes("___")
    ? item.prompt.replace("___", `**${item.answer}**`)
    : `${item.prompt} **${item.answer}**`.trim();
}

export function homeworkFillItemFromEditorLine(id: string, value: string): HomeworkItem | null {
  const line = String(value ?? "").trim();
  const matches = [...line.matchAll(/\*\*([^*\n]+)\*\*/g)];
  if (matches.length !== 1) return null;
  const answer = matches[0][1]?.trim();
  if (!answer) return null;
  const prompt = line.replace(matches[0][0], "___").trim();
  if (!prompt) return null;
  return { id, prompt, answer };
}

/** Упражнения, которые учитель явно выдал как домашнюю работу. */
export function homeworkAssignedExerciseIds(
  plan: InteractiveHomeworkPlan,
  state: HomeworkStoredState,
): string[] {
  if (!homeworkAssignedAt(state)) return [];
  try {
    const value = JSON.parse(state[ASSIGNED_EXERCISES] ?? "[]");
    if (!Array.isArray(value)) return [];
    const selected = new Set(value.map(String));
    return plan.exercises
      .map((exercise) => exercise.id)
      .filter((id) => selected.has(id));
  } catch {
    return [];
  }
}

/** Та же домашка, но только с упражнениями, выбранными при назначении. */
export function assignedInteractiveHomework(
  plan: InteractiveHomeworkPlan,
  state: HomeworkStoredState,
): InteractiveHomeworkPlan | null {
  const selected = new Set(homeworkAssignedExerciseIds(plan, state));
  if (selected.size === 0) return null;
  return {
    ...plan,
    exercises: plan.exercises.filter((exercise) => selected.has(exercise.id)),
  };
}

/** Служебные отметки назначения сами по себе не означают, что ученик начал. */
export function homeworkStarted(state: HomeworkStoredState) {
  return Object.keys(state).some((key) =>
    key.startsWith(VALUE) || key.startsWith(STATUS) || key.startsWith(ATTEMPTS),
  );
}

const cleanId = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(value)
    ? value
    : null;

const TEXT_HIGHLIGHT_SOURCES = new Set<HomeworkTextHighlightSource>([
  "word",
  "prompt",
  "prompt-before",
  "prompt-after",
  "answer",
]);

export function homeworkTextTokens(value: string): HomeworkTextToken[] {
  const parts = String(value ?? "").match(
    /\p{L}[\p{L}\p{M}\p{N}'’ʼ-]*|\p{N}+(?:[.,]\p{N}+)?|\s+|[^\s]/gu,
  ) ?? [];
  return parts.map((text) => ({
    text,
    highlightable: /[\p{L}\p{N}]/u.test(text),
  }));
}

export function homeworkTextSourceValue(
  item: HomeworkItem,
  state: HomeworkStoredState,
  source: HomeworkTextHighlightSource,
) {
  if (source === "word") return item.word ?? "";
  if (source === "answer") return state[homeworkValueKey(item.id)] ?? "";
  if (source === "prompt") return item.prompt;
  const blankAt = item.prompt.indexOf("___");
  if (source === "prompt-before") {
    return blankAt >= 0 ? item.prompt.slice(0, blankAt) : item.prompt;
  }
  return blankAt >= 0 ? item.prompt.slice(blankAt + 3) : "";
}

const homeworkTextHighlightKey = (
  itemId: string,
  source: HomeworkTextHighlightSource,
  tokenIndex: number,
) => `${TEXT_HIGHLIGHT}${itemId}:${source}:${tokenIndex}`;

export function homeworkTextHighlight(
  state: HomeworkStoredState,
  itemId: string,
  source: HomeworkTextHighlightSource,
  tokenIndex: number,
): HomeworkHighlightColor | null {
  if (!cleanId(itemId) || !TEXT_HIGHLIGHT_SOURCES.has(source) || !Number.isInteger(tokenIndex)) {
    return null;
  }
  const value = state[homeworkTextHighlightKey(itemId, source, tokenIndex)];
  return value === "yellow" || value === "green" || value === "red" ? value : null;
}

export function toggleHomeworkTextHighlight(
  state: HomeworkStoredState,
  item: HomeworkItem,
  source: HomeworkTextHighlightSource,
  tokenIndex: number,
  color: HomeworkHighlightColor,
): HomeworkStoredState {
  const next = { ...state };
  if (
    !TEXT_HIGHLIGHT_SOURCES.has(source) ||
    !Number.isInteger(tokenIndex) ||
    tokenIndex < 0 ||
    tokenIndex > 4_000 ||
    (color !== "yellow" && color !== "green" && color !== "red")
  ) return next;
  const token = homeworkTextTokens(homeworkTextSourceValue(item, state, source))[tokenIndex];
  if (!token?.highlightable) return next;
  const key = homeworkTextHighlightKey(item.id, source, tokenIndex);
  if (next[key] === color) delete next[key];
  else next[key] = color;
  return next;
}

export function clearHomeworkTextHighlights(
  state: HomeworkStoredState,
  itemId: string,
  source?: HomeworkTextHighlightSource,
) {
  const next = { ...state };
  const prefix = `${TEXT_HIGHLIGHT}${itemId}:${source ? `${source}:` : ""}`;
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  return next;
}

const cleanItem = (value: unknown): HomeworkItem | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = cleanId(raw.id);
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim().slice(0, 1_500) : "";
  if (!id || !prompt) return null;
  const answer = typeof raw.answer === "string" ? raw.answer.trim().slice(0, 300) : undefined;
  return {
    id,
    prompt,
    ...(answer ? { answer } : {}),
    ...(Array.isArray(raw.accepted)
      ? {
          accepted: raw.accepted
            .map(String)
            .map((item) => item.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 20),
        }
      : {}),
    ...(typeof raw.word === "string" && raw.word.trim()
      ? { word: raw.word.trim().slice(0, 300) }
      : {}),
    ...(typeof raw.hint === "string" && raw.hint.trim()
      ? { hint: raw.hint.trim().slice(0, 300) }
      : {}),
  };
};

const KINDS = new Set<HomeworkExerciseKind>([
  "fill",
  "definition",
  "describe",
  "drag",
  "translate",
  "question-text",
  "question-audio",
]);

export function regularHomeworkShowsWordBank(
  title: string,
  instruction: string,
  prompts: string[],
) {
  const exerciseText = `${title} ${instruction}`;
  if (/open (?:the )?brackets|translate (?:each|the|these|into|from)|good\s+vs\s+well/i.test(exerciseText)) {
    return false;
  }
  return !prompts.some((prompt) =>
    /(?:→|->)/.test(prompt) || /\([^()]{1,80}\)\s*[.!?]?\s*$/.test(prompt),
  );
}

/** Treat stored json as untrusted: old and half-written plans must not break a lesson. */
export function normalizeInteractiveHomework(value: unknown): InteractiveHomeworkPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind !== "INTERACTIVE_HOMEWORK_V1" || !Array.isArray(raw.exercises)) return null;

  const exercises = raw.exercises.flatMap((entry): HomeworkExercise[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = cleanId(item.id);
    const kind = String(item.kind ?? "") as HomeworkExerciseKind;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 240) : "";
    const instruction = typeof item.instruction === "string"
      ? (id?.startsWith("regular-")
        ? item.instruction.replace(/\s*Then press Check\.?\s*$/i, "")
        : item.instruction).trim().slice(0, 2_000)
      : "";
    if (!id || !KINDS.has(kind) || !title) return [];
    const rawItems = Array.isArray(item.items) ? item.items : [];
    const showWordBank = !id.startsWith("regular-") || regularHomeworkShowsWordBank(
      title,
      instruction,
      rawItems.map((candidate) =>
        candidate && typeof candidate === "object" && typeof (candidate as Record<string, unknown>).prompt === "string"
          ? String((candidate as Record<string, unknown>).prompt)
          : "",
      ),
    );
    return [{
      id,
      title,
      instruction,
      kind,
      translationDirection:
        kind === "translate" && item.translationDirection === "from-english"
          ? "from-english"
          : kind === "translate" && item.translationDirection === "to-english"
            ? "to-english"
            : undefined,
      optional: item.optional === true,
      // Exercises imported from a regular lesson contain canonical answers for
      // automatic checking. They are not a word bank and must never be exposed
      // to the student as hints.
      wordBank: showWordBank && Array.isArray(item.wordBank)
        ? [...new Set(item.wordBank.map(String).map((word) => word.trim()).filter(Boolean))]
            .slice(0, 300)
        : undefined,
      items: rawItems
        .map(cleanItem)
        .filter((candidate): candidate is HomeworkItem => Boolean(candidate)),
    }];
  });
  if (exercises.length === 0) return null;

  return {
    kind: "INTERACTIVE_HOMEWORK_V1",
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim().slice(0, 240)
        : "Homework",
    ...(typeof raw.intro === "string" && raw.intro.trim()
      ? { intro: raw.intro.trim().slice(0, 2_000) }
      : {}),
    exercises,
  };
}

export function interactiveHomeworkFromEntries(value: unknown): InteractiveHomeworkPlan | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    const plan = normalizeInteractiveHomework(entry);
    if (plan) return plan;
  }
  return null;
}

export function legacyHomeworkFromEntries(value: unknown): LegacyHomeworkTask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): LegacyHomeworkTask[] => {
    if (!entry || typeof entry !== "object" || "kind" in entry) return [];
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    return title || text ? [{ title, text }] : [];
  });
}

export function findHomeworkItem(
  plan: InteractiveHomeworkPlan,
  itemId: string,
): { exercise: HomeworkExercise; item: HomeworkItem } | null {
  for (const exercise of plan.exercises) {
    const item = exercise.items.find((candidate) => candidate.id === itemId);
    if (item) return { exercise, item };
  }
  return null;
}

export function isHomeworkAutoKind(kind: HomeworkExerciseKind): boolean {
  return kind === "fill" || kind === "definition" || kind === "drag";
}

export function homeworkAttempts(state: HomeworkStoredState, itemId: string): string[] {
  try {
    const parsed = JSON.parse(state[homeworkAttemptsKey(itemId)] ?? "[]");
    return Array.isArray(parsed)
      ? parsed.map(String).map((item) => item.slice(0, 300)).slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

export function homeworkStatus(
  state: HomeworkStoredState,
  itemId: string,
): HomeworkAutoStatus {
  const value = state[homeworkStatusKey(itemId)];
  return value === "correct" || value === "locked" ? value : null;
}

export function normalizeHomeworkAnswer(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}'+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function homeworkAnswerMatches(item: HomeworkItem, supplied: string): boolean {
  if (!item.answer) return false;
  const value = normalizeHomeworkAnswer(supplied);
  return [item.answer, ...(item.accepted ?? [])]
    .map(normalizeHomeworkAnswer)
    .includes(value);
}

export function homeworkProgress(plan: InteractiveHomeworkPlan, state: HomeworkStoredState) {
  const required = plan.exercises
    .filter((exercise) => !exercise.optional && !homeworkExerciseHidden(state, exercise.id))
    .flatMap((exercise) => exercise.items);
  const done = required.filter((item) => {
    const found = findHomeworkItem(plan, item.id);
    if (!found) return false;
    return isHomeworkAutoKind(found.exercise.kind)
      ? Boolean(homeworkStatus(state, item.id))
      : Boolean((state[homeworkValueKey(item.id)] ?? "").trim());
  }).length;
  return { done, total: required.length };
}

/** Progress by exercise blocks, split into required work and bonuses. */
export function homeworkExerciseProgress(
  plan: InteractiveHomeworkPlan,
  state: HomeworkStoredState,
) {
  const completed = (exercise: HomeworkExercise) =>
    exercise.items.length > 0 && exercise.items.every((item) =>
      isHomeworkAutoKind(exercise.kind)
        ? Boolean(homeworkStatus(state, item.id))
        : Boolean((state[homeworkValueKey(item.id)] ?? "").trim()),
    );
  const count = (optional: boolean) => {
    const exercises = plan.exercises.filter((exercise) =>
      Boolean(exercise.optional) === optional &&
      exercise.items.length > 0 &&
      !homeworkExerciseHidden(state, exercise.id),
    );
    return {
      done: exercises.filter(completed).length,
      total: exercises.length,
    };
  };
  return { required: count(false), bonuses: count(true) };
}
