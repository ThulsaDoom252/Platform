/** Portable definition and state helpers for an interactive lesson homework. */

import { detectTranslationLang, type TranslationLang } from "@/lib/translation-lang";

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
  /** Optional teacher-recorded question played before the student answers. */
  questionAudioUrl?: string;
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
  /** Language of the non-English side of a translation task. */
  translationLanguage?: TranslationLang;
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
export type HomeworkTeacherVoiceMessage = {
  id: string;
  url: string;
  durationSeconds: number;
  mimeType: string;
  publishedAt: string;
};

const EXERCISE_FOCUS = "homework:exercise:";
const ITEM_FOCUS = "homework:item:";
const HIGHLIGHT = "hw:highlight:";
const TEXT_HIGHLIGHT = "hw:text-highlight:";
const TEXT_RANGE_HIGHLIGHT = "hw:text-range-highlight:";
const REACTION = "hw:reaction:";
const EXERCISE_SCORE = "hw:exercise-score:";
const EXERCISE_COMMENT = "hw:exercise-comment:";

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

export type HomeworkTextHighlightRange = {
  start: number;
  end: number;
  color: HomeworkHighlightColor;
};

export type HomeworkGradeLabel =
  | "great"
  | "good"
  | "not-bad"
  | "could-be-better"
  | "bad";

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

/** A reaction doubles as visual feedback for the entire reviewed block. */
export function homeworkReactionColor(
  reaction: HomeworkReaction | null,
): HomeworkHighlightColor | null {
  if (reaction === "cross" || reaction === "angry") return "red";
  if (reaction === "warning") return "yellow";
  if (reaction === "check" || reaction === "thumbs-up" || reaction === "happy") {
    return "green";
  }
  return null;
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
const REVISION_REQUESTED_AT = "hw:revision-requested-at";
const ASSIGNED_AT = "hw:assigned-at";
const ASSIGNED_EXERCISES = "hw:assigned-exercises";
const PLAN_OVERRIDE = "hw:plan-override";
const REMOVED_AT = "hw:removed-at";
const TEACHER_VOICE_MESSAGES = "hw:teacher-voice-messages";
const HOMEWORK_VOICE_TARGET_PREFIX = "homework:";

export const homeworkValueKey = (id: string) => `${VALUE}${id}`;
export const homeworkStatusKey = (id: string) => `${STATUS}${id}`;
export const homeworkAttemptsKey = (id: string) => `${ATTEMPTS}${id}`;
export const homeworkNoteKey = (id: string) => `${NOTE}${id}`;
export const homeworkNoteVisibleKey = (id: string) => `${NOTE_VISIBLE}${id}`;
export const homeworkExerciseHiddenKey = (id: string) => `${EXERCISE_HIDDEN}${id}`;
export const homeworkExerciseScoreKey = (id: string) => `${EXERCISE_SCORE}${id}`;
export const homeworkExerciseCommentKey = (id: string) => `${EXERCISE_COMMENT}${id}`;
export const homeworkSubmittedAtKey = () => SUBMITTED_AT;
export const homeworkReviewedAtKey = () => REVIEWED_AT;
export const homeworkRevisionRequestedAtKey = () => REVISION_REQUESTED_AT;
export const homeworkAssignedAtKey = () => ASSIGNED_AT;
export const homeworkAssignedExercisesKey = () => ASSIGNED_EXERCISES;
export const homeworkPlanOverrideKey = () => PLAN_OVERRIDE;
export const homeworkRemovedAtKey = () => REMOVED_AT;
export const homeworkTeacherVoiceMessagesKey = () => TEACHER_VOICE_MESSAGES;
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

export function homeworkRevisionRequestedAt(state: HomeworkStoredState) {
  return state[REVISION_REQUESTED_AT] || null;
}

export function homeworkTeacherVoiceMessages(
  state: HomeworkStoredState,
): HomeworkTeacherVoiceMessage[] {
  try {
    const raw = JSON.parse(state[TEACHER_VOICE_MESSAGES] ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.slice(-20).flatMap((entry): HomeworkTeacherVoiceMessage[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const id = cleanId(item.id);
      const url = String(item.url ?? "").trim().slice(0, 2_000);
      const mimeType = String(item.mimeType ?? "audio/webm").trim().slice(0, 80);
      const publishedAt = String(item.publishedAt ?? "").trim().slice(0, 80);
      const durationSeconds = Math.max(1, Math.min(600, Math.round(Number(item.durationSeconds) || 0)));
      if (
        !id ||
        (!url.startsWith("/uploads/") && !/^https:\/\//i.test(url)) ||
        !/^audio\/(?:webm|ogg|mp4|mpeg|wav|x-m4a)(?:;|$)/i.test(mimeType)
      ) return [];
      return [{ id, url, durationSeconds, mimeType, publishedAt }];
    });
  } catch {
    return [];
  }
}

export function homeworkAssignedAt(state: HomeworkStoredState) {
  return state[ASSIGNED_AT] || null;
}

export function homeworkRemovedAt(state: HomeworkStoredState) {
  return state[REMOVED_AT] || null;
}

/** Clear only homework data while preserving answers from the lesson itself. */
export function withoutAssignedHomeworkState(
  state: HomeworkStoredState,
): HomeworkStoredState {
  const next = { ...state };
  for (const key of Object.keys(next)) {
    if (key.startsWith("hw:")) delete next[key];
  }
  return next;
}

/** Индивидуальная копия домашки, сохранённая внутри закрепления ученика. */
export function homeworkPlanOverride(state: HomeworkStoredState) {
  try {
    return normalizeInteractiveHomework(
      JSON.parse(state[PLAN_OVERRIDE] ?? "null"),
      { allowEmpty: true },
    );
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

/**
 * Language of the non-English sentences. Old plans did not store the flag, so
 * infer it from their actual text and use Ukrainian only when the text is
 * ambiguous.
 */
export function homeworkTranslationLanguage(
  exercise: HomeworkExercise,
  fallback: TranslationLang = "UK",
): TranslationLang {
  if (exercise.translationLanguage === "RU" || exercise.translationLanguage === "UK") {
    return exercise.translationLanguage;
  }
  const nonEnglish = exercise.items.map((item) =>
    exercise.translationDirection === "from-english" ? item.answer : item.prompt,
  );
  return detectTranslationLang(nonEnglish) ?? fallback;
}

/** Remove every saved trace of one exercise without touching another student's copy. */
export function withoutHomeworkExerciseState(
  state: HomeworkStoredState,
  exercise: HomeworkExercise,
): HomeworkStoredState {
  const next = { ...state };
  const exerciseFocusId = homeworkExerciseFocusId(exercise.id);
  delete next[homeworkExerciseHiddenKey(exercise.id)];
  delete next[homeworkHighlightKey(exerciseFocusId)];
  delete next[homeworkReactionKey("exercise", exercise.id)];
  delete next[homeworkExerciseScoreKey(exercise.id)];
  delete next[homeworkExerciseCommentKey(exercise.id)];

  for (const item of exercise.items) {
    const itemFocusId = homeworkItemFocusId(item.id);
    delete next[homeworkValueKey(item.id)];
    delete next[homeworkStatusKey(item.id)];
    delete next[homeworkAttemptsKey(item.id)];
    delete next[homeworkNoteKey(item.id)];
    delete next[homeworkNoteVisibleKey(item.id)];
    delete next[homeworkHighlightKey(itemFocusId)];
    delete next[homeworkReactionKey("item", item.id)];
    for (const key of Object.keys(next)) {
      if (key.startsWith(`${TEXT_HIGHLIGHT}${item.id}:`)) delete next[key];
      if (key.startsWith(`${TEXT_RANGE_HIGHLIGHT}${item.id}:`)) delete next[key];
    }
  }

  return next;
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

/**
 * Return an assigned homework to a pristine student state without changing
 * the teacher's personal copy, assigned exercises, notes or annotations.
 */
export function withoutHomeworkProgressState(
  state: HomeworkStoredState,
  plan: InteractiveHomeworkPlan,
): HomeworkStoredState {
  let next = { ...state };
  for (const exercise of plan.exercises) {
    for (const item of exercise.items) {
      delete next[homeworkValueKey(item.id)];
      delete next[homeworkStatusKey(item.id)];
      delete next[homeworkAttemptsKey(item.id)];
      next = clearHomeworkTextHighlights(next, item.id, "answer");
    }
  }
  delete next[homeworkSubmittedAtKey()];
  delete next[homeworkReviewedAtKey()];
  delete next[homeworkRevisionRequestedAtKey()];
  return next;
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

const homeworkTextRangeHighlightKey = (
  itemId: string,
  source: HomeworkTextHighlightSource,
  start: number,
  end: number,
) => `${TEXT_RANGE_HIGHLIGHT}${itemId}:${source}:${start}:${end}`;

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

/** Saved arbitrary-length text ranges. Legacy per-word marks remain readable. */
export function homeworkTextHighlightRanges(
  state: HomeworkStoredState,
  itemId: string,
  source: HomeworkTextHighlightSource,
  textLength = 8_000,
): HomeworkTextHighlightRange[] {
  if (!cleanId(itemId) || !TEXT_HIGHLIGHT_SOURCES.has(source)) return [];
  const prefix = `${TEXT_RANGE_HIGHLIGHT}${itemId}:${source}:`;
  return Object.entries(state).flatMap(([key, value]) => {
    if (!key.startsWith(prefix)) return [];
    const [startRaw, endRaw] = key.slice(prefix.length).split(":");
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > textLength ||
      (value !== "yellow" && value !== "green" && value !== "red")
    ) return [];
    return [{ start, end, color: value as HomeworkHighlightColor }];
  }).sort((a, b) => a.start - b.start || a.end - b.end);
}

export function toggleHomeworkTextHighlightRange(
  state: HomeworkStoredState,
  item: HomeworkItem,
  source: HomeworkTextHighlightSource,
  start: number,
  end: number,
  color: HomeworkHighlightColor,
): HomeworkStoredState {
  const next = { ...state };
  const value = homeworkTextSourceValue(item, state, source);
  if (
    !cleanId(item.id) ||
    !TEXT_HIGHLIGHT_SOURCES.has(source) ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > value.length ||
    !value.slice(start, end).trim() ||
    (color !== "yellow" && color !== "green" && color !== "red")
  ) return next;

  const exact = homeworkTextRangeHighlightKey(item.id, source, start, end);
  const removeExact = next[exact] === color;
  const prefix = `${TEXT_RANGE_HIGHLIGHT}${item.id}:${source}:`;
  for (const key of Object.keys(next)) {
    if (!key.startsWith(prefix)) continue;
    const [rangeStartRaw, rangeEndRaw] = key.slice(prefix.length).split(":");
    const rangeStart = Number(rangeStartRaw);
    const rangeEnd = Number(rangeEndRaw);
    if (rangeStart < end && rangeEnd > start) delete next[key];
  }
  if (!removeExact) next[exact] = color;
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
    const rangePrefix = `${TEXT_RANGE_HIGHLIGHT}${itemId}:${source ? `${source}:` : ""}`;
    if (key.startsWith(rangePrefix)) delete next[key];
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
  const questionAudioUrl = typeof raw.questionAudioUrl === "string"
    ? raw.questionAudioUrl.trim().slice(0, 2_000)
    : "";
  const safeQuestionAudioUrl = questionAudioUrl && (
    questionAudioUrl.startsWith("/uploads/") || /^https:\/\//i.test(questionAudioUrl)
  )
    ? questionAudioUrl
    : undefined;
  return {
    id,
    prompt,
    ...(safeQuestionAudioUrl ? { questionAudioUrl: safeQuestionAudioUrl } : {}),
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
export function normalizeInteractiveHomework(
  value: unknown,
  options: { allowEmpty?: boolean } = {},
): InteractiveHomeworkPlan | null {
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
      translationLanguage:
        kind === "translate" && (item.translationLanguage === "RU" || item.translationLanguage === "UK")
          ? item.translationLanguage
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
  if (exercises.length === 0 && !options.allowEmpty) return null;

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

export function homeworkExerciseTeacherScore(
  state: HomeworkStoredState,
  exerciseId: string,
): number | null {
  if (!cleanId(exerciseId)) return null;
  const raw = state[homeworkExerciseScoreKey(exerciseId)];
  if (raw === undefined) return null;
  const score = Number(raw);
  return Number.isInteger(score) && score >= 0 && score <= 100 ? score : null;
}

export function homeworkExerciseComment(
  state: HomeworkStoredState,
  exerciseId: string,
): string {
  if (!cleanId(exerciseId)) return "";
  return state[homeworkExerciseCommentKey(exerciseId)] ?? "";
}

export function homeworkExerciseNeedsTeacherScore(exercise: HomeworkExercise): boolean {
  return !isHomeworkAutoKind(exercise.kind);
}

export function homeworkExerciseScore(
  exercise: HomeworkExercise,
  state: HomeworkStoredState,
): number | null {
  const teacherScore = homeworkExerciseTeacherScore(state, exercise.id);
  if (teacherScore !== null) return teacherScore;
  if (!isHomeworkAutoKind(exercise.kind) || exercise.items.length === 0) return null;
  const correct = exercise.items.filter(
    (item) => homeworkStatus(state, item.id) === "correct",
  ).length;
  return Math.round((correct / exercise.items.length) * 100);
}

export function homeworkGradeLabel(score: number): HomeworkGradeLabel {
  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  if (normalized === 100) return "great";
  if (normalized >= 80) return "good";
  if (normalized >= 60) return "not-bad";
  if (normalized >= 50) return "could-be-better";
  return "bad";
}

export function homeworkOverallScore(
  exercises: readonly HomeworkExercise[],
  state: HomeworkStoredState,
): { score: number | null; graded: number; total: number } {
  const visible = exercises.filter(
    (exercise) => !homeworkExerciseHidden(state, exercise.id) && exercise.items.length > 0,
  );
  const scores = visible.flatMap((exercise) => {
    const score = homeworkExerciseScore(exercise, state);
    return score === null ? [] : [score];
  });
  return {
    score: scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null,
    graded: scores.length,
    total: visible.length,
  };
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

/**
 * A teacher may correct an automatic answer after any student/homework status.
 * The edit does not count as another student attempt and does not change the
 * submission/review status of the whole homework.
 */
export function homeworkStateAfterTeacherAutoAnswerEdit(
  state: HomeworkStoredState,
  item: HomeworkItem,
  supplied: string,
): HomeworkStoredState {
  const value = String(supplied ?? "").trim().slice(0, 300);
  const next = clearHomeworkTextHighlights({ ...state }, item.id, "answer");
  if (value) next[homeworkValueKey(item.id)] = value;
  else delete next[homeworkValueKey(item.id)];

  if (value && homeworkAnswerMatches(item, value)) {
    next[homeworkStatusKey(item.id)] = "correct";
  } else {
    delete next[homeworkStatusKey(item.id)];
  }
  return next;
}

/**
 * Words that still have to be used in a fill/definition exercise.
 * A correctly answered item consumes one matching bank entry. Keeping this as
 * a multiset makes the helper safe for legacy plans that contain duplicates.
 */
export function homeworkRemainingWordBank(
  exercise: HomeworkExercise,
  state: HomeworkStoredState,
): string[] {
  const remaining = [...(exercise.wordBank ?? [])];

  for (const item of exercise.items) {
    if (homeworkStatus(state, item.id) !== "correct") continue;

    const accepted = [
      state[homeworkValueKey(item.id)] ?? "",
      item.answer ?? "",
      ...(item.accepted ?? []),
    ]
      .map(normalizeHomeworkAnswer)
      .filter(Boolean);
    const index = remaining.findIndex((word) =>
      accepted.includes(normalizeHomeworkAnswer(word)),
    );
    if (index >= 0) remaining.splice(index, 1);
  }

  return remaining;
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
