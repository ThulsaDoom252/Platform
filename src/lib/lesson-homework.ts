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

export type LegacyHomeworkTask = { title: string; text: string };
export type LessonHomeworkEntry = LegacyHomeworkTask | InteractiveHomeworkPlan;
export type HomeworkStoredState = Record<string, string>;
export type HomeworkAutoStatus = "correct" | "locked" | null;

const VALUE = "hw:value:";
const STATUS = "hw:status:";
const ATTEMPTS = "hw:attempts:";
const NOTE = "hw:note:";
const NOTE_VISIBLE = "hw:note-visible:";
const EXERCISE_HIDDEN = "hw:exercise-hidden:";
const SUBMITTED_AT = "hw:submitted-at";

export const homeworkValueKey = (id: string) => `${VALUE}${id}`;
export const homeworkStatusKey = (id: string) => `${STATUS}${id}`;
export const homeworkAttemptsKey = (id: string) => `${ATTEMPTS}${id}`;
export const homeworkNoteKey = (id: string) => `${NOTE}${id}`;
export const homeworkNoteVisibleKey = (id: string) => `${NOTE_VISIBLE}${id}`;
export const homeworkExerciseHiddenKey = (id: string) => `${EXERCISE_HIDDEN}${id}`;
export const homeworkSubmittedAtKey = () => SUBMITTED_AT;

export function homeworkExerciseHidden(state: HomeworkStoredState, exerciseId: string) {
  return state[homeworkExerciseHiddenKey(exerciseId)] === "1";
}

export function homeworkSubmittedAt(state: HomeworkStoredState) {
  return state[SUBMITTED_AT] || null;
}

const cleanId = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(value)
    ? value
    : null;

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
      ? item.instruction.trim().slice(0, 2_000)
      : "";
    if (!id || !KINDS.has(kind) || !title) return [];
    return [{
      id,
      title,
      instruction,
      kind,
      optional: item.optional === true,
      wordBank: Array.isArray(item.wordBank)
        ? [...new Set(item.wordBank.map(String).map((word) => word.trim()).filter(Boolean))]
            .slice(0, 300)
        : undefined,
      items: (Array.isArray(item.items) ? item.items : [])
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
