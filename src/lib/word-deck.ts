/** Чистая логика активности «Колода слов». */

export type WordDeckTimerMode = "NONE" | "GAME" | "CARD";
export type WordDeckGameType = "WORDS" | "GUESS_DESCRIPTION" | "GUESS_PICTURE" | "SPELLING";
export type GuessPictureMode = "PICTURE" | "TRANSLATION" | "MIXED";
export type WordDeckOwner = "TEACHER" | "STUDENT" | null;
export type WordDeckVerdict = "RIGHT" | "WRONG" | null;
export type WordDeckFeedback = "RIGHT" | "WRONG" | "TIME_UP" | null;
export type WordDeckBackground =
  | "MIDNIGHT"
  | "EMERALD"
  | "VIOLET"
  | "SUNSET"
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
}): boolean {
  return !state.observer && state.cardCount > 0 && state.at < state.cardCount - 1;
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
  sound: boolean;
  time: number;
  expired: boolean;
  /** Озвучивание синхронизируется, но переключатель видит только учитель. */
  readDescriptions: boolean;
  verdict: WordDeckVerdict;
  feedback: WordDeckFeedback;
  updatedAt: string;
};

export type WordDeckSettings = {
  gameType: WordDeckGameType;
  timerMode: WordDeckTimerMode;
  gameSeconds: number;
  cardSeconds: number;
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
};

export const DEFAULT_WORD_DECK_SETTINGS: WordDeckSettings = {
  gameType: "WORDS",
  timerMode: "NONE",
  gameSeconds: 120,
  cardSeconds: 10,
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
    "CUSTOM",
  ];
  return {
    gameType:
      value?.gameType === "GUESS_DESCRIPTION" || value?.gameType === "GUESS_PICTURE" || value?.gameType === "SPELLING"
        ? value.gameType
        : "WORDS",
    timerMode,
    gameSeconds: clamp(value?.gameSeconds, 10, 3600, 120),
    cardSeconds: clamp(value?.cardSeconds, 3, 300, 10),
    repeats: clamp(value?.repeats, 1, 20, 1),
    alternate: value?.alternate === true,
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
  };
}

export function minimumWordDeckWords(rawSettings: Partial<WordDeckSettings>): number {
  return normalizeWordDeckSettings(rawSettings).gameType === "SPELLING"
    ? 1
    : MIN_WORD_DECK_WORDS;
}

/** В игре по описанию слова без описания не могут попасть на стол. */
export function playableWordDeckCards(
  source: WordDeckSourceCard[],
  rawSettings: Partial<WordDeckSettings>,
): WordDeckSourceCard[] {
  const settings = normalizeWordDeckSettings(rawSettings);
  return settings.gameType === "GUESS_DESCRIPTION"
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
  const maxTime = settings.timerMode === "GAME" ? settings.gameSeconds : settings.cardSeconds;
  const time = Math.min(maxTime, Math.max(0, Math.trunc(Number(value.time) || 0)));
  const verdict: WordDeckVerdict = value.verdict === "RIGHT" || value.verdict === "WRONG"
    ? value.verdict
    : null;
  const feedback: WordDeckFeedback = value.feedback === "RIGHT" ||
    value.feedback === "WRONG" || value.feedback === "TIME_UP"
    ? value.feedback
    : null;
  return {
    deck,
    at,
    faceUp: value.faceUp === true && at >= 0,
    sound: value.sound !== false,
    time,
    expired: value.expired === true,
    readDescriptions: value.readDescriptions === true,
    verdict,
    feedback,
    updatedAt: String(value.updatedAt ?? "").slice(0, 64) || new Date().toISOString(),
  };
}
