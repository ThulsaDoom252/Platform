"use server";

/**
 * «Угадай по картинке»: партия живёт на сервере.
 *
 * Два экрана должны видеть одно и то же, а постоянного соединения в
 * проекте нет — значит состояние хранится строкой в базе, учитель его
 * меняет, ученик опрашивает. Срок ответа лежит меткой времени, а не
 * остатком секунд: иначе два браузера отсчитывают по-своему и карта
 * переворачивается у них в разный момент.
 */
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityGames,
  materialNodes,
  materialPhrases,
  phraseImages,
  studentMaterials,
  users,
  type GameCard,
  type GameVerdict,
} from "@/lib/db/schema";
import { visibleNodeIds } from "@/lib/material-grants";
import { getSession } from "@/lib/session";
import {
  buildDeck,
  statsOf,
  type DeckSource,
  type GameStats,
} from "@/lib/game-deck";

/** Чем спрашиваем. MIXED — обоими способами, по две карты на слово. */
export type GameMode = "PICTURE" | "TRANSLATION" | "MIXED";

export type GameState = {
  id: string;
  status: string;
  mode: GameMode;
  title: string | null;
  at: number;
  total: number;
  revealed: boolean;
  seconds: number;
  /** На паузе ли партия: пока да, отсчёт стоит. */
  paused: boolean;
  /** Сколько миллисекунд осталось. Считается на сервере — часы там одни. */
  leftMs: number;
  card: GameCard | null;
  verdict: GameVerdict | null;
  stats: GameStats;
};

/** Строка очереди активностей в классе. */
export type QueuedGame = {
  id: string;
  title: string | null;
  mode: GameMode;
  status: string;
  total: number;
  at: number;
  paused: boolean;
  stats: GameStats;
  createdAt: string;
};

export type GameActionState = { ok?: boolean; error?: string; gameId?: string };

export type GameSetup = {
  studentId: string;
  mode: GameMode;
  /** Как назвать партию в очереди. Пусто — имя соберётся из режима. */
  title?: string;
  /** Словники в том порядке, в каком их выбрали. */
  nodeIds: string[];
  /** Какие слова участвуют. Пусто для словника — значит все. */
  phraseIds?: string[];
  shuffleWords: boolean;
  shuffleDecks: boolean;
  seconds: number;
};

/** Моментально очистить всю секцию Activities выбранного ученика. */
export async function clearClassActivitiesAction(
  studentId: string,
): Promise<{ error?: string }> {
  await requireTeacher();
  const target = String(studentId ?? "");
  if (!target) return { error: "Не выбран ученик" };
  await db.delete(activityGames).where(eq(activityGames.studentId, target));
  return {};
}

/**
 * Добавить расклад секции другому ученику, не стирая его активности.
 * Результаты и текущий таймер не копируются: у получателя все игры
 * начинают с чистого состояния, но с теми же карточками и настройками.
 */
export async function duplicateClassActivitiesAction(
  sourceStudentId: string,
  targetStudentId: string,
): Promise<{ error?: string }> {
  await requireTeacher();
  const source = String(sourceStudentId ?? "");
  const target = String(targetStudentId ?? "");
  if (!source || !target || source === target) return { error: "Выбери другого ученика" };

  const [student] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, target), eq(users.role, "STUDENT")))
    .limit(1);
  if (!student) return { error: "Ученик не найден" };

  const rows = await db
    .select()
    .from(activityGames)
    .where(eq(activityGames.studentId, source))
    .orderBy(asc(activityGames.createdAt));

  if (rows.length > 0) {
    await db.insert(activityGames).values(
      rows.map((row) => ({
        studentId: target,
        kind: row.kind,
        templateId: row.templateId,
        wordDeck: row.wordDeck,
        mode: row.mode,
        title: row.title,
        status: "LOBBY",
        cards: row.kind === "WORD_DECK" ? [] : row.cards,
        verdicts: row.kind === "WORD_DECK" ? [] : row.cards.map(() => null),
        timings: row.kind === "WORD_DECK" ? [] : row.cards.map(() => null),
        at: 0,
        revealed: false,
        seconds: row.seconds,
        paused: true,
        pausedLeftMs: row.seconds * 1000,
        deadline: null,
      })),
    );
  }
  return {};
}

async function requireTeacher() {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") throw new Error("Только для учителя");
  return session;
}

/** Собрать колоду и начать партию. */
export async function startGameAction(setup: GameSetup): Promise<GameActionState> {
  await requireTeacher();

  const studentId = String(setup?.studentId ?? "");
  const nodeIds = (setup?.nodeIds ?? []).map(String).filter(Boolean);
  if (!studentId) return { error: "Не выбран ученик" };
  if (nodeIds.length === 0) return { error: "Не выбран ни один словник" };

  const asked = String(setup?.mode ?? "");
  const mode: GameMode =
    asked === "TRANSLATION" || asked === "MIXED" ? asked : "PICTURE";
  // В смешанном нужны обе стороны, поэтому требования складываются.
  const needsPicture = mode !== "TRANSLATION";
  const needsTranslation = mode !== "PICTURE";

  /*
   * По картинке карта без картинки бессмысленна, поэтому слова без неё
   * просто не попадают в выборку. По переводу картинка не нужна вовсе —
   * там обязателен перевод.
   */
  const picture = db
    .select({
      phraseId: materialPhrases.id,
      nodeId: materialPhrases.nodeId,
      word: materialPhrases.phrase,
      translation: materialPhrases.translation,
      kind: materialPhrases.kind,
      imageUrl: phraseImages.url,
    })
    .from(materialPhrases)
    .innerJoin(
      phraseImages,
      and(
        eq(phraseImages.phraseId, materialPhrases.id),
        eq(phraseImages.picked, true),
      ),
    )
    .where(inArray(materialPhrases.nodeId, nodeIds))
    .orderBy(asc(materialPhrases.sortOrder));

  const text = db
    .select({
      phraseId: materialPhrases.id,
      nodeId: materialPhrases.nodeId,
      word: materialPhrases.phrase,
      translation: materialPhrases.translation,
      kind: materialPhrases.kind,
      imageUrl: sql<string>`''`,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodeIds))
    .orderBy(asc(materialPhrases.sortOrder));

  const rows = await (needsPicture ? picture : text);

  const chosen = new Set((setup?.phraseIds ?? []).map(String));
  const usable = rows
    .filter((r) => r.kind !== "NOTE")
    .filter((r) => !needsTranslation || !!r.translation?.trim())
    .filter((r) => chosen.size === 0 || chosen.has(r.phraseId));

  if (usable.length === 0) {
    return {
      error: needsPicture
        ? "У выбранных слов нет картинок — подбери их в словнике"
        : "У выбранных слов нет перевода",
    };
  }

  // Порядок словников — тот, в каком их выбрал учитель, а не алфавитный.
  const sources: DeckSource[] = nodeIds.map((nodeId) => ({
    nodeId,
    cards: usable
      .filter((r) => r.nodeId === nodeId)
      .map(
        (r): GameCard => ({
          phraseId: r.phraseId,
          nodeId: r.nodeId,
          word: r.word,
          translation: r.translation,
          imageUrl: r.imageUrl,
          // В смешанном режиме сторона проставится при удвоении колоды.
          face: mode === "TRANSLATION" ? "TRANSLATION" : "PICTURE",
        }),
      ),
  }));

  const deck = buildDeck(sources, {
    shuffleWords: setup?.shuffleWords ?? true,
    shuffleDecks: setup?.shuffleDecks ?? false,
    mixFaces: mode === "MIXED",
  });

  const seconds = Math.min(120, Math.max(3, Number(setup?.seconds) || 10));

  /*
   * Партия встаёт в очередь на паузе и никого оттуда не выгоняет.
   *
   * Игры готовят заранее, одну за другой, а начинают тогда, когда оба
   * готовы. Поэтому прежние не закрываются, а отсчёт не идёт, пока не
   * нажали «play».
   */
  const [created] = await db
    .insert(activityGames)
    .values({
      studentId,
      mode,
      title: String(setup?.title ?? "").trim().slice(0, 80) || null,
      status: "LOBBY",
      cards: deck,
      verdicts: deck.map(() => null),
      timings: deck.map(() => null),
      at: 0,
      revealed: false,
      seconds,
      paused: true,
      pausedLeftMs: seconds * 1000,
      deadline: null,
    })
    .returning({ id: activityGames.id });

  return { ok: true, gameId: created?.id };
}

/**
 * Партия, которая сейчас на столе.
 *
 * Очередь может быть длинной, но идёт всегда одна: та, которую начали.
 * Пока никто не начат, берётся ближайшая приготовленная — её и видят
 * оба экрана.
 */
async function currentGame(studentId: string) {
  const [running] = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.studentId, studentId),
        eq(activityGames.status, "RUNNING"),
        eq(activityGames.kind, "GUESS_PICTURE"),
      ),
    )
    .orderBy(desc(activityGames.updatedAt))
    .limit(1);
  if (running) return running;

  const [queued] = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.studentId, studentId),
        eq(activityGames.status, "LOBBY"),
        eq(activityGames.kind, "GUESS_PICTURE"),
      ),
    )
    .orderBy(asc(activityGames.createdAt))
    .limit(1);
  return queued ?? null;
}

/** Партия по её идентификатору — когда учитель выбрал её в очереди. */
async function gameById(id: string) {
  const [row] = await db
    .select()
    .from(activityGames)
    .where(and(eq(activityGames.id, id), eq(activityGames.kind, "GUESS_PICTURE")))
    .limit(1);
  return row ?? null;
}

type GameRow = NonNullable<Awaited<ReturnType<typeof gameById>>>;

function toState(row: GameRow): GameState {
  const cards = row.cards ?? [];
  const verdicts = row.verdicts ?? [];

  // На паузе время не идёт: остаток лежит числом, а не меткой.
  const expired =
    !row.paused && !!row.deadline && row.deadline.getTime() <= Date.now();
  const revealed = row.revealed || expired;

  const leftMs = row.paused
    ? row.pausedLeftMs
    : row.deadline
      ? Math.max(0, row.deadline.getTime() - Date.now())
      : 0;

  return {
    id: row.id,
    status: row.status,
    mode: (row.mode as GameMode) ?? "PICTURE",
    title: row.title,
    at: row.at,
    total: cards.length,
    revealed,
    seconds: row.seconds,
    paused: row.paused,
    leftMs,
    card: cards[row.at] ?? null,
    verdict: verdicts[row.at] ?? (expired && !row.revealed ? "timeout" : null),
    stats: statsOf(
      verdicts,
      row.timings ?? [],
      cards.map((card) => card.word),
    ),
  };
}

/** Сколько ушло на текущую карту. Пауза из счёта выпадает. */
function spentOn(row: GameRow): number | null {
  if (row.paused || !row.deadline) return null;
  const full = row.seconds * 1000;
  const left = Math.max(0, row.deadline.getTime() - Date.now());
  const spent = full - left;
  return spent > 0 ? spent : null;
}

/** Состояние для учителя. Можно спросить и конкретную партию из очереди. */
export async function gameStateAction(
  studentId: string,
  gameId?: string,
): Promise<GameState | null> {
  await requireTeacher();
  const row = gameId
    ? await gameById(String(gameId))
    : await currentGame(String(studentId ?? ""));
  return row ? toState(row) : null;
}

/**
 * Очередь активностей ученика.
 *
 * Партии не пропадают сами: приготовленные ждут, законченные остаются
 * со своим итогом, пока учитель их не уберёт.
 */
export async function listGamesAction(studentId: string): Promise<QueuedGame[]> {
  await requireTeacher();
  const student = String(studentId ?? "");
  if (!student) return [];

  const rows = await db
    .select()
    .from(activityGames)
    .where(
      and(
        eq(activityGames.studentId, student),
        eq(activityGames.kind, "GUESS_PICTURE"),
      ),
    )
    .orderBy(asc(activityGames.createdAt));

  return rows.map((row) => {
    const cards = row.cards ?? [];
    return {
      id: row.id,
      title: row.title,
      mode: (row.mode as GameMode) ?? "PICTURE",
      status: row.status,
      total: cards.length,
      at: row.at,
      paused: row.paused,
      stats: statsOf(
        row.verdicts ?? [],
        row.timings ?? [],
        cards.map((card) => card.word),
      ),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/**
 * Пустить партию или снять её с паузы.
 *
 * Отсчёт начинается отсюда, а не от создания: игру ставят заранее, а
 * начинают, когда оба готовы.
 */
export async function playGameAction(gameId: string): Promise<GameActionState> {
  await requireTeacher();
  const row = await gameById(String(gameId ?? ""));
  if (!row) return { error: "Партия не найдена" };
  if (row.status === "DONE") return { error: "Партия уже закончена" };

  // На столе всегда одна: остальные начатые уходят на паузу.
  await db
    .update(activityGames)
    .set({ paused: true, deadline: null, updatedAt: new Date() })
    .where(
      and(
        eq(activityGames.studentId, row.studentId),
        eq(activityGames.status, "RUNNING"),
        eq(activityGames.kind, "GUESS_PICTURE"),
        ne(activityGames.id, row.id),
      ),
    );

  const left = row.pausedLeftMs > 0 ? row.pausedLeftMs : row.seconds * 1000;

  await db
    .update(activityGames)
    .set({
      status: "RUNNING",
      paused: false,
      pausedLeftMs: 0,
      // Карта уже перевёрнута — ждём «следующую», отсчитывать нечего.
      deadline: row.revealed ? null : new Date(Date.now() + left),
      updatedAt: new Date(),
    })
    .where(eq(activityGames.id, row.id));

  return { ok: true };
}

/** Пауза: остаток превращается обратно в число и стоит. */
export async function pauseGameAction(gameId: string): Promise<GameActionState> {
  await requireTeacher();
  const row = await gameById(String(gameId ?? ""));
  if (!row) return { error: "Партия не найдена" };

  const left = row.deadline
    ? Math.max(0, row.deadline.getTime() - Date.now())
    : row.pausedLeftMs;

  await db
    .update(activityGames)
    .set({ paused: true, pausedLeftMs: left, deadline: null, updatedAt: new Date() })
    .where(eq(activityGames.id, row.id));

  return { ok: true };
}

/** Убрать активность из очереди вместе с её итогом. */
export async function removeGameAction(gameId: string): Promise<GameActionState> {
  await requireTeacher();
  const id = String(gameId ?? "");
  if (!id) return { error: "Не выбрана активность" };

  await db
    .delete(activityGames)
    .where(and(eq(activityGames.id, id), eq(activityGames.kind, "GUESS_PICTURE")));
  return { ok: true };
}

/**
 * Состояние для ученика — только своей партии.
 *
 * Отдельным действием, потому что проверка другая: ученик не должен
 * читать чужую игру, подставив идентификатор.
 */
export async function myGameStateAction(): Promise<GameState | null> {
  const session = await getSession();
  if (!session) return null;
  const row = await currentGame(session.userId);
  return row ? toState(row) : null;
}

/** Оценить ответ и перевернуть карту. */
export async function answerCardAction(
  studentId: string,
  verdict: GameVerdict,
): Promise<GameActionState> {
  await requireTeacher();
  const row = await currentGame(String(studentId ?? ""));
  if (!row) return { error: "Партия не найдена" };

  const verdicts = [...(row.verdicts ?? [])];
  verdicts[row.at] = verdict;

  // Время ответа снимаем здесь: дальше карта уже перевёрнута.
  const timings = [...(row.timings ?? [])];
  timings[row.at] = spentOn(row);

  await db
    .update(activityGames)
    .set({
      verdicts,
      timings,
      revealed: true,
      paused: false,
      pausedLeftMs: 0,
      deadline: null,
      updatedAt: new Date(),
    })
    .where(eq(activityGames.id, row.id));

  return { ok: true };
}

/** Следующая карта. Кончились — партия закрывается. */
export async function nextCardAction(studentId: string): Promise<GameActionState> {
  await requireTeacher();
  const row = await currentGame(String(studentId ?? ""));
  if (!row) return { error: "Партия не найдена" };

  const cards = row.cards ?? [];
  const verdicts = [...(row.verdicts ?? [])];

  // Ушли, не нажав ни галочки, ни крестика — это истёкшее время.
  if (verdicts[row.at] == null) verdicts[row.at] = "timeout";

  const next = row.at + 1;

  if (next >= cards.length) {
    await db
      .update(activityGames)
      .set({
        verdicts,
        status: "DONE",
        revealed: true,
        paused: true,
        pausedLeftMs: 0,
        deadline: null,
        updatedAt: new Date(),
      })
      .where(eq(activityGames.id, row.id));
    return { ok: true };
  }

  await db
    .update(activityGames)
    .set({
      verdicts,
      at: next,
      revealed: false,
      paused: false,
      pausedLeftMs: 0,
      // Отсчёт возобновляется со следующей карты, а не продолжается.
      deadline: new Date(Date.now() + row.seconds * 1000),
      updatedAt: new Date(),
    })
    .where(eq(activityGames.id, row.id));

  return { ok: true };
}

/** Закончить партию досрочно. */
export async function stopGameAction(studentId: string): Promise<GameActionState> {
  await requireTeacher();
  const id = String(studentId ?? "");
  if (!id) return { error: "Не выбран ученик" };

  await db
    .update(activityGames)
    .set({ status: "DONE", deadline: null, updatedAt: new Date() })
    .where(
      and(
        eq(activityGames.studentId, id),
        eq(activityGames.kind, "GUESS_PICTURE"),
        ne(activityGames.status, "DONE"),
      ),
    );

  return { ok: true };
}

export type GameVocab = {
  id: string;
  name: string;
  icon: string | null;
  words: number;
  /** Своё дерево ученика или раздел, выданный ему из общей базы. */
  personal: boolean;
  /** На каком языке в нём переводы — его и увидит ученик на карте. */
  lang: string;
};

/**
 * Словники, которыми можно играть с этим учеником.
 *
 * Берутся только его: то, что лежит в его собственном дереве, и то, что
 * ему выдано из общей библиотеки. Чужой словник на уроке бесполезен —
 * ученик этих слов не видел.
 *
 * Для игры по картинке — только те, где картинка подобрана каждому
 * слову. Наполовину готовый словник даёт колоду с дырами: часть слов
 * молча выпадет из игры, и почему их не было — на уроке не разберёшь.
 *
 * Для игры по переводу подбирать нечего, поэтому годится любой словник
 * ученика, где у слов есть перевод.
 */
export async function listGameVocabAction(
  studentId: string,
  mode: GameMode = "PICTURE",
): Promise<GameVocab[]> {
  await requireTeacher();
  const student = String(studentId ?? "");
  if (!student) return [];

  // Общая библиотека целиком — по ней считаем, что открыто ученику.
  const shared = await db
    .select({ id: materialNodes.id, parentId: materialNodes.parentId })
    .from(materialNodes)
    .where(and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)));

  const grants = await db
    .select({ nodeId: studentMaterials.materialNodeId })
    .from(studentMaterials)
    .where(eq(studentMaterials.studentId, student));

  const open = visibleNodeIds(shared, grants.map((row) => row.nodeId));

  const nodes = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      icon: materialNodes.icon,
      scope: materialNodes.scope,
      ownerId: materialNodes.ownerId,
      lang: materialNodes.translationLang,
    })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.pageKind, "VOCAB"),
        or(
          // Личное дерево ученика.
          and(eq(materialNodes.scope, "STUDENT"), eq(materialNodes.ownerId, student)),
          // Общая библиотека — отфильтруем по выдаче ниже.
          and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)),
        ),
      ),
    )
    .orderBy(asc(materialNodes.name));

  const mine = nodes.filter(
    (node) => node.scope === "STUDENT" || open.has(node.id),
  );
  if (mine.length === 0) return [];

  const phrases = await db
    .select({
      nodeId: materialPhrases.nodeId,
      phraseId: materialPhrases.id,
      kind: materialPhrases.kind,
      translation: materialPhrases.translation,
    })
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, mine.map((n) => n.id)));

  /*
   * Где спрашивают переводом, слово без перевода показать нечем; где
   * картинкой — без картинки. В смешанном нужно и то и другое, поэтому
   * требования складываются, а не выбираются.
   */
  const needsPicture = mode !== "TRANSLATION";
  const needsTranslation = mode !== "PICTURE";

  const words = phrases.filter(
    (p) => p.kind !== "NOTE" && (!needsTranslation || !!p.translation?.trim()),
  );
  if (words.length === 0) return [];

  const ready = needsPicture
      ? new Set(
          (
            await db
              .select({ phraseId: phraseImages.phraseId })
              .from(phraseImages)
              .where(
                and(
                  inArray(phraseImages.phraseId, words.map((w) => w.phraseId)),
                  eq(phraseImages.picked, true),
                ),
              )
          ).map((row) => row.phraseId),
        )
      : null;

  return mine
    .map((node) => {
      const own = words.filter((w) => w.nodeId === node.id);
      return {
        id: node.id,
        name: node.name,
        icon: node.icon,
        words: own.length,
        // Без картинок готовность считать не по чему: годится всё.
        done: ready ? own.filter((w) => ready.has(w.phraseId)).length : own.length,
        personal: node.scope === "STUDENT",
        lang: node.lang,
      };
    })
    .filter((node) => node.words > 0 && node.done === node.words)
    .map(({ id, name, icon, words: count, personal, lang }) => ({
      id,
      name,
      icon,
      words: count,
      personal,
      lang,
    }));
}

export type GameWord = {
  phraseId: string;
  word: string;
  translation: string | null;
  hasImage: boolean;
};

/** Слова словника для ручного отбора: видно, у каких есть картинка. */
export async function listGameWordsAction(
  nodeId: string,
  mode: GameMode = "PICTURE",
): Promise<GameWord[]> {
  await requireTeacher();
  const id = String(nodeId ?? "");
  if (!id) return [];

  const rows = await db
    .select({
      phraseId: materialPhrases.id,
      word: materialPhrases.phrase,
      translation: materialPhrases.translation,
      kind: materialPhrases.kind,
      imageId: phraseImages.id,
    })
    .from(materialPhrases)
    .leftJoin(
      phraseImages,
      and(
        eq(phraseImages.phraseId, materialPhrases.id),
        eq(phraseImages.picked, true),
      ),
    )
    .where(eq(materialPhrases.nodeId, id))
    .orderBy(asc(materialPhrases.sortOrder));

  return rows
    .filter((r) => r.kind !== "NOTE")
    .map((r) => ({
      phraseId: r.phraseId,
      word: r.word,
      translation: r.translation,
      // «Готово к игре» значит разное: там картинка, тут перевод.
      // «Готово к игре» значит разное: там картинка, тут перевод, а в
      // смешанном — и то и другое сразу.
      hasImage:
        mode === "TRANSLATION"
          ? !!r.translation?.trim()
          : mode === "MIXED"
            ? !!r.imageId && !!r.translation?.trim()
            : !!r.imageId,
    }));
}

/** Имя ученика для заголовка партии. */
export async function gameStudentAction(studentId: string): Promise<string | null> {
  await requireTeacher();
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, String(studentId ?? "")))
    .limit(1);
  return row?.name ?? null;
}
