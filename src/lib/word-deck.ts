/** Чистая логика активности «Колода слов». */
import { DEFAULT_TIMER_SECONDS } from "@/lib/timer-settings";
import { normalizeTenseCorrectionSettings, type TenseCorrectionCardInfo, type TenseCorrectionSettings } from "./tense-correction-settings";

export type WordDeckTimerMode = "NONE" | "GAME" | "CARD";
export type WordDeckGameType = "WORDS" | "GUESS_DESCRIPTION" | "DESCRIPTION_SENTENCE" | "GUESS_PICTURE" | "SPELLING" | "TENSE_CORRECTION";
export type WordDeckPhase = "GUESS" | "SENTENCE" | "COMPLETE";

export function isWordDeckDescriptionGame(gameType: WordDeckGameType) {
  return gameType === "GUESS_DESCRIPTION" || gameType === "DESCRIPTION_SENTENCE" || gameType === "TENSE_CORRECTION";
}
export type GuessPictureMode = "PICTURE" | "TRANSLATION" | "MIXED";
export type WordDeckOwner = "TEACHER" | "STUDENT" | null;
export type WordDeckVerdict = "RIGHT" | "WRONG" | null;
export type WordDeckFeedback = "RIGHT" | "WRONG" | "TIME_UP" | null;
export type WordDeckBackground =
  | "MIDNIGHT"
  | "EMERALD"
  | "VIOLET"
  | "SUNSET"
  | "FOOD"
  | "CHORES"
  | "TALK"
  | "WEATHER"
  | "CUSTOM";

export type WordDeckSourceCard = {
  phraseId: string;
  word: string;
  icon?: string | null;
  description?: string | null;
  /** Источник нужен редактору, чтобы разложить общую колоду по словникам. */
  nodeId?: string;
  vocabName?: string;
  vocabIcon?: string | null;
  /** Used by saved Guess by picture presets. */
  translation?: string | null;
  imageUrl?: string | null;
  promptFace?: "PICTURE" | "TRANSLATION";
  transcriptionUs?: string | null;
  transcriptionUk?: string | null;
  tip?: string | null;
  examples?: { en: string; tr: string }[];
  correction?: TenseCorrectionCardInfo;
};

export const MIN_WORD_DECK_WORDS = 4;

export const hasEnoughWordDeckWords = (count: number) =>
  Number.isFinite(count) && count >= MIN_WORD_DECK_WORDS;

/** Истёкший таймер завершает текущую карту, но не запирает оставшуюся колоду. */
export function canDealNextWordDeckCard(state: {
  cardCount: number;
  at: number;
  expired: boolean;
  observer: boolean;
  gameType?: WordDeckGameType;
  phase?: WordDeckPhase;
}): boolean {
  return !state.observer && state.cardCount > 0 && state.at < state.cardCount - 1 &&
    !(state.gameType === "DESCRIPTION_SENTENCE" && state.at >= 0 && state.phase !== "SENTENCE");
}

export type WordDeckRuntimeCard = WordDeckSourceCard & {
  instanceId: string;
  owner: WordDeckOwner;
};

/** Единое состояние колоды в живом классе: учитель меняет, ученик наблюдает. */
export type WordDeckLiveState = {
  deck: WordDeckRuntimeCard[];
  at: number;
  faceUp: boolean;
  /** Combined mode: reveal starts sentence practice; revealing alone is not completion. */
  phase?: WordDeckPhase;
  sound: boolean;
  time: number;
  expired: boolean;
  /** Optional for older saved games. Explicit false resumes an answered card. */
  timerPaused?: boolean;
  /** Озвучивание синхронизируется, но переключатель видит только учитель. */
  readDescriptions: boolean;
  verdict: WordDeckVerdict;
  feedback: WordDeckFeedback;
  /** Teacher judgement per dealt instance; repeats count as separate turns. */
  ratings?: Record<string, Exclude<WordDeckVerdict, null>>;
  showScores?: boolean;
  updatedAt: string;
};

export type WordDeckHomeworkAttempt = {
  finishedAt: string;
  durationMs: number;
};

/** Advance from a saved anchor without persisting each clock tick. */
export function remainingWordDeckSeconds(state: WordDeckLiveState, settings: Pick<WordDeckSettings, "timerMode">, now = Date.now()) {
  if (settings.timerMode === "NONE" || state.at < 0 || state.expired || wordDeckTimerPaused(state, settings)) return state.time;
  const anchor = Date.parse(state.updatedAt);
  const elapsed = Number.isFinite(anchor) ? Math.max(0, Math.floor((now - anchor) / 1000)) : 0;
  return Math.max(0, state.time - elapsed);
}

/** Old answered card snapshots stopped the clock without an explicit pause flag. */
export function wordDeckTimerPaused(state: Pick<WordDeckLiveState, "timerPaused" | "verdict">, settings: Pick<WordDeckSettings, "timerMode">) {
  return state.timerPaused ?? Boolean(state.verdict && settings.timerMode === "CARD");
}

type WordDeckTimerSettings = Pick<WordDeckSettings, "timerMode" | "cardSeconds" | "gameSeconds"> &
  Partial<Pick<WordDeckSettings, "gameType" | "guessSeconds" | "sentenceSeconds">>;

export function wordDeckTimerSeconds(settings: WordDeckTimerSettings, phase: WordDeckPhase = "GUESS") {
  if (settings.timerMode === "GAME") return settings.gameSeconds;
  if (settings.gameType === "DESCRIPTION_SENTENCE") {
    return (phase === "GUESS" ? settings.guessSeconds : settings.sentenceSeconds) ?? settings.cardSeconds;
  }
  return settings.cardSeconds;
}

type WordDeckTimerState = Pick<WordDeckLiveState, "time" | "expired" | "feedback" | "updatedAt"> & { timerPaused: boolean };

/** Restart the clock only; retain the card, its revealed side and any judgement. */
export function restartWordDeckTimer<T extends Pick<WordDeckLiveState, "feedback" | "phase">>(state: T,
  settings: WordDeckTimerSettings, now = Date.now()): Omit<T, keyof WordDeckTimerState> & WordDeckTimerState {
  return { ...state, time: wordDeckTimerSeconds(settings, state.phase), expired: false, timerPaused: false,
    feedback: state.feedback === "TIME_UP" ? null : state.feedback, updatedAt: new Date(now).toISOString() };
}

/** The sentence has a fresh per-card clock, even after a wrong guess or timeout. */
export function startWordDeckSentence<T extends Pick<WordDeckLiveState, "time" | "expired" | "timerPaused" | "feedback">>(
  state: T, settings: WordDeckTimerSettings, now = Date.now(),
) {
  const sentence = { ...state, phase: "SENTENCE" as const, faceUp: true, feedback: null };
  return settings.timerMode === "CARD" ? restartWordDeckTimer(sentence, settings, now) : sentence;
}

export function isWordDeckFinished(state: Pick<WordDeckLiveState, "at" | "faceUp" | "phase"> & { deck: readonly unknown[] },
  settings: Pick<WordDeckSettings, "gameType">) {
  if (state.at < 0 || state.at < state.deck.length - 1 || state.deck.length === 0) return false;
  if (settings.gameType === "DESCRIPTION_SENTENCE") return state.faceUp && state.phase === "COMPLETE";
  return settings.gameType === "GUESS_DESCRIPTION" || settings.gameType === "GUESS_PICTURE" || settings.gameType === "TENSE_CORRECTION" ? state.faceUp : true;
}

export type WordDeckHomeworkTracking = {
  assignedByTeacherId?: string;
  attemptStartedAt?: string | null;
  lastCompletedAttemptStartedAt?: string | null;
  attempts?: WordDeckHomeworkAttempt[];
};

/** Keep ownership while removing every trace of student progress. */
export function resetWordDeckHomeworkTracking(
  tracking: WordDeckHomeworkTracking,
): WordDeckHomeworkTracking {
  return {
    ...tracking,
    attemptStartedAt: undefined,
    lastCompletedAttemptStartedAt: undefined,
    attempts: [],
  };
}

export function nextWordDeckHomeworkTracking(
  tracking: WordDeckHomeworkTracking,
  progress: { started: boolean; finished: boolean; wasFinished: boolean },
  now = new Date(),
): WordDeckHomeworkTracking {
  const attempts = tracking.attempts ?? [];
  if (!progress.started) {
    return { ...tracking, attemptStartedAt: undefined, attempts };
  }
  // A legacy completed row has no start timestamp. Opening it must not create
  // a fake zero-second attempt; the next explicit reset starts fresh tracking.
  if (progress.finished && progress.wasFinished && !tracking.attemptStartedAt) {
    return { ...tracking, attempts };
  }
  const attemptStartedAt = tracking.attemptStartedAt ?? now.toISOString();
  if (!progress.finished || tracking.lastCompletedAttemptStartedAt === attemptStartedAt) {
    return { ...tracking, attemptStartedAt, attempts };
  }
  const startedMs = new Date(attemptStartedAt).getTime();
  return {
    ...tracking,
    attemptStartedAt,
    lastCompletedAttemptStartedAt: attemptStartedAt,
    attempts: [...attempts, {
      finishedAt: now.toISOString(),
      durationMs: Number.isFinite(startedMs) ? Math.max(0, now.getTime() - startedMs) : 0,
    }].slice(-100),
  };
}

export type WordDeckSettings = {
  gameType: WordDeckGameType;
  timerMode: WordDeckTimerMode;
  gameSeconds: number;
  cardSeconds: number;
  guessSeconds: number;
  sentenceSeconds: number;
  repeats: number;
  alternate: boolean;
  studentPercent: number;
  sound: boolean;
  showIcons: boolean;
  descriptionIcons: boolean;
  answerIcons: boolean;
  background: WordDeckBackground;
  /** Guess by picture presets share the snapshot table, not the runtime UI. */
  guessMode: GuessPictureMode;
  shuffleWords: boolean;
  shuffleDecks: boolean;
  /** Spelling Practice: pronunciation and hint controls. */
  autoPronounce: boolean;
  allowUsAudio: boolean;
  allowUkAudio: boolean;
  showTips: boolean;
  autoPronounceUk: boolean;
  correction?: TenseCorrectionSettings;
};

export const DEFAULT_WORD_DECK_SETTINGS: WordDeckSettings = {
  gameType: "WORDS",
  timerMode: "NONE",
  gameSeconds: DEFAULT_TIMER_SECONDS,
  cardSeconds: DEFAULT_TIMER_SECONDS,
  guessSeconds: DEFAULT_TIMER_SECONDS,
  sentenceSeconds: DEFAULT_TIMER_SECONDS,
  repeats: 1,
  alternate: false,
  studentPercent: 50,
  sound: true,
  showIcons: false,
  descriptionIcons: false,
  answerIcons: true,
  background: "MIDNIGHT",
  guessMode: "PICTURE",
  shuffleWords: true,
  shuffleDecks: false,
  autoPronounce: true,
  allowUsAudio: true,
  allowUkAudio: false,
  showTips: true,
  autoPronounceUk: false,
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export function normalizeWordDeckSettings(
  value: Partial<WordDeckSettings> | null | undefined,
): WordDeckSettings {
  const timerMode: WordDeckTimerMode =
    value?.timerMode === "GAME" || value?.timerMode === "CARD"
      ? value.timerMode
      : "NONE";
  const backgrounds: WordDeckBackground[] = [
    "MIDNIGHT",
    "EMERALD",
    "VIOLET",
    "SUNSET",
    "FOOD",
    "CHORES",
    "TALK",
    "WEATHER",
    "CUSTOM",
  ];
  return {
    gameType:
      value?.gameType === "GUESS_DESCRIPTION" || value?.gameType === "DESCRIPTION_SENTENCE" || value?.gameType === "GUESS_PICTURE" || value?.gameType === "SPELLING" || value?.gameType === "TENSE_CORRECTION"
        ? value.gameType
        : "WORDS",
    timerMode,
    gameSeconds: clamp(value?.gameSeconds, 0, 3600, DEFAULT_TIMER_SECONDS),
    cardSeconds: clamp(value?.cardSeconds, 0, 300, DEFAULT_TIMER_SECONDS),
    guessSeconds: clamp(value?.guessSeconds, 0, 300, clamp(value?.cardSeconds, 0, 300, DEFAULT_TIMER_SECONDS)),
    sentenceSeconds: clamp(value?.sentenceSeconds, 0, 300, clamp(value?.cardSeconds, 0, 300, DEFAULT_TIMER_SECONDS)),
    repeats: value?.gameType === "TENSE_CORRECTION" ? 1 : clamp(value?.repeats, 1, 20, 1),
    alternate: value?.gameType !== "TENSE_CORRECTION" && value?.alternate === true,
    studentPercent: clamp(value?.studentPercent, 0, 100, 50),
    sound: value?.sound !== false,
    showIcons: value?.showIcons === true,
    descriptionIcons: value?.descriptionIcons === true,
    answerIcons: value?.answerIcons !== false,
    background: backgrounds.includes(value?.background as WordDeckBackground)
      ? (value!.background as WordDeckBackground)
      : "MIDNIGHT",
    guessMode:
      value?.guessMode === "TRANSLATION" || value?.guessMode === "MIXED"
        ? value.guessMode
        : "PICTURE",
    shuffleWords: value?.shuffleWords !== false,
    shuffleDecks: value?.shuffleDecks === true,
    autoPronounce: value?.autoPronounce !== false,
    allowUsAudio: value?.allowUsAudio !== false,
    allowUkAudio: value?.allowUkAudio === true,
    showTips: value?.showTips !== false,
    autoPronounceUk: value?.autoPronounceUk === true,
    ...(value?.gameType === "TENSE_CORRECTION" ? { correction: normalizeTenseCorrectionSettings(value.correction) } : {}),
  };
}

export function minimumWordDeckWords(rawSettings: Partial<WordDeckSettings>): number {
  const kind = normalizeWordDeckSettings(rawSettings).gameType;
  return kind === "SPELLING" || kind === "TENSE_CORRECTION"
    ? 1
    : MIN_WORD_DECK_WORDS;
}

/** В игре по описанию слова без описания не могут попасть на стол. */
export function playableWordDeckCards(
  source: WordDeckSourceCard[],
  rawSettings: Partial<WordDeckSettings>,
): WordDeckSourceCard[] {
  const settings = normalizeWordDeckSettings(rawSettings);
  return isWordDeckDescriptionGame(settings.gameType)
    ? source.filter((card) => Boolean(card.description?.trim()))
    : [...source];
}

/** Fisher–Yates с внедряемым random: тесты проверяют без случайности. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [next[index], next[other]] = [next[other], next[index]];
  }
  return next;
}

export function suggestedWordDeckTitle(sourceNames: string[]): string {
  const names = sourceNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 1) return names[0];
  return names.length > 1 ? "Mix" : "";
}

export function randomWordDeckPercentage<T>(
  items: T[],
  percent: 25 | 50 | 75,
  random: () => number = Math.random,
): T[] {
  if (items.length === 0) return [];
  const count = Math.max(1, Math.round(items.length * (percent / 100)));
  return shuffled(items, random).slice(0, count);
}

/** Каждое слово повторяется N раз; распределение ролей — точное, не примерное. */
export function buildWordDeck(
  source: WordDeckSourceCard[],
  rawSettings: Partial<WordDeckSettings>,
  random: () => number = Math.random,
): WordDeckRuntimeCard[] {
  const settings = normalizeWordDeckSettings(rawSettings);
  const repeated = Array.from({ length: settings.repeats }, (_, repeat) =>
    source.map((card, index) => ({
      ...card,
      instanceId: `${card.phraseId}:${repeat}:${index}`,
      owner: null as WordDeckOwner,
    })),
  ).flat();
  const deck = shuffled(repeated, random);
  if (!settings.alternate) return deck;

  const students = Math.round(deck.length * (settings.studentPercent / 100));
  const owners = shuffled<WordDeckOwner>(
    [
      ...Array.from({ length: students }, () => "STUDENT" as const),
      ...Array.from({ length: deck.length - students }, () => "TEACHER" as const),
    ],
    random,
  );
  return deck.map((card, index) => ({ ...card, owner: owners[index] }));
}

/** Перетасовывается только несыгранный хвост; предыдущие карты остаются на месте. */
export function shuffleWordDeckTail<T>(
  cards: T[],
  at: number,
  random: () => number = Math.random,
): T[] {
  const split = Math.min(cards.length, Math.max(0, Math.trunc(at)));
  return [...cards.slice(0, split), ...shuffled(cards.slice(split), random)];
}

/**
 * Сервер не доверяет присланным карточкам: принимает только порядок и роли,
 * а слово, иконку и источник восстанавливает из сохранённого снимка игры.
 */
export function normalizeWordDeckLiveState(
  source: WordDeckSourceCard[],
  rawSettings: Partial<WordDeckSettings>,
  value: Partial<WordDeckLiveState> | null | undefined,
): WordDeckLiveState | null {
  if (!value || !Array.isArray(value.deck)) return null;
  const settings = normalizeWordDeckSettings(rawSettings);
  const allowed = new Map<string, WordDeckRuntimeCard>();
  for (let repeat = 0; repeat < settings.repeats; repeat++) {
    source.forEach((card, index) => {
      const instanceId = `${card.phraseId}:${repeat}:${index}`;
      allowed.set(instanceId, { ...card, instanceId, owner: null });
    });
  }
  if (value.deck.length !== allowed.size) return null;

  const seen = new Set<string>();
  const deck: WordDeckRuntimeCard[] = [];
  for (const candidate of value.deck) {
    const canonical = allowed.get(String(candidate?.instanceId ?? ""));
    if (!canonical || seen.has(canonical.instanceId)) return null;
    seen.add(canonical.instanceId);
    const owner: WordDeckOwner = settings.alternate &&
      (candidate.owner === "TEACHER" || candidate.owner === "STUDENT")
      ? candidate.owner
      : null;
    deck.push({ ...canonical, owner });
  }

  const at = Math.min(deck.length - 1, Math.max(-1, Math.trunc(Number(value.at) || 0)));
  const phase: WordDeckPhase = settings.gameType === "DESCRIPTION_SENTENCE" && at >= 0 && value.faceUp === true
    ? value.phase === "COMPLETE" && at === deck.length - 1 ? "COMPLETE" : "SENTENCE"
    : "GUESS";
  const maxTime = wordDeckTimerSeconds(settings, phase);
  const time = Math.min(maxTime, Math.max(0, Math.trunc(Number(value.time) || 0)));
  const verdict: WordDeckVerdict = value.verdict === "RIGHT" || value.verdict === "WRONG"
    ? value.verdict
    : null;
  const feedback: WordDeckFeedback = value.feedback === "RIGHT" ||
    value.feedback === "WRONG" || value.feedback === "TIME_UP"
    ? value.feedback
    : null;
  const ratings = normalizeWordDeckRatings(deck, settings.alternate ? value.ratings : undefined);
  return {
    deck,
    at,
    faceUp: value.faceUp === true && at >= 0,
    phase,
    sound: value.sound !== false,
    time,
    expired: value.expired === true,
    timerPaused: phase === "COMPLETE" || (typeof value.timerPaused === "boolean" ? value.timerPaused : Boolean(verdict && settings.timerMode === "CARD" && phase === "GUESS")),
    readDescriptions: value.readDescriptions === true,
    verdict,
    feedback,
    ratings,
    showScores: settings.alternate && value.showScores === true,
    updatedAt: String(value.updatedAt ?? "").slice(0, 64) || new Date().toISOString(),
  };
}

/** Only real instances and explicit thumbs are accepted, never client-supplied totals. */
export function normalizeWordDeckRatings(deck: readonly WordDeckRuntimeCard[], value: unknown): Record<string, "RIGHT" | "WRONG"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return Object.fromEntries(deck.flatMap(card => Object.hasOwn(input, card.instanceId) &&
    (input[card.instanceId] === "RIGHT" || input[card.instanceId] === "WRONG")
    ? [[card.instanceId, input[card.instanceId] as "RIGHT" | "WRONG"]] : []));
}

export function wordDeckScores(deck: readonly WordDeckRuntimeCard[], ratings: Record<string, "RIGHT" | "WRONG"> = {}) {
  const result = { TEACHER: { right: 0, wrong: 0, total: 0 }, STUDENT: { right: 0, wrong: 0, total: 0 } };
  for (const card of deck) {
    if (!card.owner) continue;
    const score = result[card.owner];
    score.total++;
    const rating = Object.hasOwn(ratings, card.instanceId) ? ratings[card.instanceId] : null;
    if (rating === "RIGHT") score.right++;
    if (rating === "WRONG") score.wrong++;
  }
  return result;
}
