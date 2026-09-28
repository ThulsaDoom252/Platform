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
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activityGames,
  materialPhrases,
  phraseImages,
  users,
  type GameCard,
  type GameVerdict,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { buildDeck, scoreOf, type DeckSource, type GameScore } from "@/lib/game-deck";

export type GameState = {
  id: string;
  status: string;
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

  const rows = await db
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

  const chosen = new Set((setup?.phraseIds ?? []).map(String));
  const usable = rows
    .filter((r) => r.kind !== "NOTE")
    .filter((r) => chosen.size === 0 || chosen.has(r.phraseId));

  if (usable.length === 0) {
    return { error: "У выбранных слов нет картинок — подбери их в словнике" };
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

export type GameWord = {
  phraseId: string;
  word: string;
  translation: string | null;
  hasImage: boolean;
};

/** Слова словника для ручного отбора: видно, у каких есть картинка. */
export async function listGameWordsAction(nodeId: string): Promise<GameWord[]> {
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
      hasImage: !!r.imageId,
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
