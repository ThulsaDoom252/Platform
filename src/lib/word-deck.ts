/** Чистая логика активности «Колода слов». */

export type WordDeckTimerMode = "NONE" | "GAME" | "CARD";
export type WordDeckOwner = "TEACHER" | "STUDENT" | null;
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
  /** Источник нужен редактору, чтобы разложить общую колоду по словникам. */
  nodeId?: string;
  vocabName?: string;
  vocabIcon?: string | null;
};

export const MIN_WORD_DECK_WORDS = 4;

export const hasEnoughWordDeckWords = (count: number) =>
  Number.isFinite(count) && count >= MIN_WORD_DECK_WORDS;

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
  updatedAt: string;
};

export type WordDeckSettings = {
  timerMode: WordDeckTimerMode;
  gameSeconds: number;
  cardSeconds: number;
  repeats: number;
  alternate: boolean;
  studentPercent: number;
  sound: boolean;
  showIcons: boolean;
  background: WordDeckBackground;
};

export const DEFAULT_WORD_DECK_SETTINGS: WordDeckSettings = {
  timerMode: "NONE",
  gameSeconds: 120,
  cardSeconds: 10,
  repeats: 1,
  alternate: false,
  studentPercent: 50,
  sound: true,
  showIcons: false,
  background: "MIDNIGHT",
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
    timerMode,
    gameSeconds: clamp(value?.gameSeconds, 10, 3600, 120),
    cardSeconds: clamp(value?.cardSeconds, 3, 300, 10),
    repeats: clamp(value?.repeats, 1, 20, 1),
    alternate: value?.alternate === true,
    studentPercent: clamp(value?.studentPercent, 0, 100, 50),
    sound: value?.sound !== false,
    showIcons: value?.showIcons === true,
    background: backgrounds.includes(value?.background as WordDeckBackground)
      ? (value!.background as WordDeckBackground)
      : "MIDNIGHT",
  };
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
  return {
    deck,
    at,
    faceUp: value.faceUp === true && at >= 0,
    sound: value.sound !== false,
    time,
    expired: value.expired === true,
    updatedAt: String(value.updatedAt ?? "").slice(0, 64) || new Date().toISOString(),
  };
}
