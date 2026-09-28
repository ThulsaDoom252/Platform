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
import { buildDeck, scoreOf, type DeckSource, type GameScore } from "@/lib/game-deck";

/** Что на лицевой стороне карты. */
export type GameMode = "PICTURE" | "TRANSLATION";

export type GameState = {
  id: string;
  status: string;
  mode: GameMode;
  at: number;
  total: number;
  revealed: boolean;
  seconds: number;
  /** Сколько миллисекунд осталось. Считается на сервере — часы там одни. */
  leftMs: number;
  card: GameCard | null;
  verdict: GameVerdict | null;
  score: GameScore;
};

export type GameActionState = { ok?: boolean; error?: string };

export type GameSetup = {
  studentId: string;
  mode: GameMode;
  /** Словники в том порядке, в каком их выбрали. */
  nodeIds: string[];
  /** Какие слова участвуют. Пусто для словника — значит все. */
  phraseIds?: string[];
  shuffleWords: boolean;
  shuffleDecks: boolean;
  seconds: number;
};

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

  const mode: GameMode = setup?.mode === "TRANSLATION" ? "TRANSLATION" : "PICTURE";

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

  const rows = await (mode === "PICTURE" ? picture : text);

  const chosen = new Set((setup?.phraseIds ?? []).map(String));
  const usable = rows
    .filter((r) => r.kind !== "NOTE")
    .filter((r) => mode === "PICTURE" || !!r.translation?.trim())
    .filter((r) => chosen.size === 0 || chosen.has(r.phraseId));

  if (usable.length === 0) {
    return {
      error:
        mode === "PICTURE"
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
        }),
      ),
  }));

  const deck = buildDeck(sources, {
    shuffleWords: setup?.shuffleWords ?? true,
    shuffleDecks: setup?.shuffleDecks ?? false,
  });

  const seconds = Math.min(120, Math.max(3, Number(setup?.seconds) || 10));

  // Прошлые партии этого ученика закрываем: идёт всегда одна.
  await db
    .update(activityGames)
    .set({ status: "DONE", updatedAt: new Date() })
    .where(
      and(eq(activityGames.studentId, studentId), ne(activityGames.status, "DONE")),
    );

  await db.insert(activityGames).values({
    studentId,
    mode,
    status: "RUNNING",
    cards: deck,
    verdicts: deck.map(() => null),
    at: 0,
    revealed: false,
    seconds,
    // Отсчёт идёт с первой карты, как только партия началась.
    deadline: new Date(Date.now() + seconds * 1000),
  });

  return { ok: true };
}

/** Текущая партия ученика — её читают оба экрана. */
async function currentGame(studentId: string) {
  const [row] = await db
    .select()
    .from(activityGames)
    .where(
      and(eq(activityGames.studentId, studentId), ne(activityGames.status, "DONE")),
    )
    .orderBy(desc(activityGames.createdAt))
    .limit(1);
  return row ?? null;
}

function toState(row: NonNullable<Awaited<ReturnType<typeof currentGame>>>): GameState {
  const cards = row.cards ?? [];
  const verdicts = row.verdicts ?? [];

  // Время вышло, а учитель не нажал — карта переворачивается сама.
  const expired = !!row.deadline && row.deadline.getTime() <= Date.now();
  const revealed = row.revealed || expired;

  return {
    id: row.id,
    status: row.status,
    mode: (row.mode as GameMode) ?? "PICTURE",
    at: row.at,
    total: cards.length,
    revealed,
    seconds: row.seconds,
    leftMs: row.deadline ? Math.max(0, row.deadline.getTime() - Date.now()) : 0,
    card: cards[row.at] ?? null,
    verdict: verdicts[row.at] ?? (expired && !row.revealed ? "timeout" : null),
    score: scoreOf(verdicts),
  };
}

/** Состояние для учителя. */
export async function gameStateAction(studentId: string): Promise<GameState | null> {
  await requireTeacher();
  const row = await currentGame(String(studentId ?? ""));
  return row ? toState(row) : null;
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

  await db
    .update(activityGames)
    .set({ verdicts, revealed: true, deadline: null, updatedAt: new Date() })
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
      .set({ verdicts, status: "DONE", revealed: true, deadline: null, updatedAt: new Date() })
      .where(eq(activityGames.id, row.id));
    return { ok: true };
  }

  await db
    .update(activityGames)
    .set({
      verdicts,
      at: next,
      revealed: false,
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
    .where(and(eq(activityGames.studentId, id), ne(activityGames.status, "DONE")));

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

  // В игре по переводу слово без перевода показать нечем.
  const words = phrases.filter(
    (p) => p.kind !== "NOTE" && (mode === "PICTURE" || !!p.translation?.trim()),
  );
  if (words.length === 0) return [];

  const ready =
    mode === "PICTURE"
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
      hasImage: mode === "PICTURE" ? !!r.imageId : !!r.translation?.trim(),
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
