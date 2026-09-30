"use client";

/**
 * Активности на урок.
 *
 * Это очередь, а не одна игра: их выставляют заранее, одну за другой, и
 * они никуда не пропадают — приготовленные ждут своего часа,
 * законченные остаются с итогом, пока учитель их не уберёт.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { showGameToStudentAction } from "@/lib/actions/class";
import {
  clearClassActivitiesAction,
  duplicateClassActivitiesAction,
  listGamesAction,
  pauseGameAction,
  playGameAction,
  removeGameAction,
  type GameMode,
  type QueuedGame,
} from "@/lib/actions/guess-picture";
import {
  twisterStudentsAction,
  type TwisterStudent,
} from "@/lib/actions/tongue-twisters";
import { GuessSetup } from "@/components/game/guess-setup";
import { GuessPlay } from "@/components/game/guess-play";
import { GameStatsCard } from "@/components/game/game-stats";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import {
  listClassWordDeckActivitiesAction,
  removeWordDeckFromClassAction,
  type ClassWordDeckActivity,
} from "@/lib/actions/word-deck";
import { IconPlus, IconTrash, IconUser, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ClassActivities({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [queue, setQueue] = useState<QueuedGame[] | null>(null);
  const [decks, setDecks] = useState<ClassWordDeckActivity[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDeck, setOpenDeck] = useState<ClassWordDeckActivity | null>(null);
  const [focusedDeckId, setFocusedDeckId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [students, setStudents] = useState<TwisterStudent[]>([]);
  const [copyTarget, setCopyTarget] = useState("");
  const [busy, startBusy] = useTransition();
  /** Не удалось позвать ученика — говорим об этом на месте. */
  const [showError, setShowError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [rows, wordDecks] = await Promise.all([
      listGamesAction(studentId),
      listClassWordDeckActivitiesAction(studentId),
    ]);
    setQueue(rows);
    setDecks(wordDecks);
    return rows;
  }, [studentId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listGamesAction(studentId),
      listClassWordDeckActivitiesAction(studentId),
    ])
      .then(([rows, wordDecks]) => {
        if (!alive) return;
        setQueue(rows);
        setDecks(wordDecks);
      })
      .catch(() => {
        if (!alive) return;
        setQueue([]);
        setDecks([]);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  const modeLabel: Record<GameMode, string> = {
    PICTURE: t.game.modePicture,
    TRANSLATION: t.game.modeTranslation,
    MIXED: t.game.modeMixed,
  };
  const hasActivities = (queue?.length ?? 0) + (decks?.length ?? 0) > 0;

  const openCopy = () => {
    setCopying(true);
    setCopyTarget("");
    setShowError(null);
    if (students.length === 0) {
      void twisterStudentsAction().then((rows) => setStudents(rows.filter((row) => row.id !== studentId)));
    }
  };

  if (adding) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="self-start text-[12px] font-semibold text-muted transition hover:text-content"
        >
          ← {t.game.back}
        </button>
        <GuessSetup
          studentId={studentId}
          onStarted={() => {
            setAdding(false);
            void reload();
          }}
        />
      </div>
    );
  }

  if (openId) {
    return (
      <GuessPlay
        gameId={openId}
        studentId={studentId}
        onBack={() => {
          setOpenId(null);
          void reload();
        }}
        onChanged={() => void reload()}
      />
    );
  }

  if (openDeck) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpenDeck(null)} className="text-[12px] font-semibold text-muted transition hover:text-content">
            ← {t.wordDeck.back}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => startBusy(async () => {
              const result = await showGameToStudentAction(openDeck.id);
              setShowError(result.error ?? null);
              if (!result.error) setFocusedDeckId(openDeck.id);
            })}
            className={cn(
              "ml-auto flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50",
              focusedDeckId === openDeck.id
                ? "bg-amber-400 text-slate-950"
                : "bg-accent text-white hover:opacity-90",
            )}
          >
            <IconUser className="h-4 w-4" />
            {focusedDeckId === openDeck.id
              ? t.classRoom.studentFocusedOnGame
              : t.classRoom.sendStudentToGame}
          </button>
        </div>
        {showError && <p className="text-sm font-semibold text-rose-500">{showError}</p>}
        <WordDeckBoard key={openDeck.id} activity={openDeck} compact live />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-content">{t.game.queue}</span>
        {hasActivities && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => startBusy(async () => {
                const result = await clearClassActivitiesAction(studentId);
                setShowError(result.error ?? null);
                await reload();
              })}
              className="h-9 rounded-xl px-3 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
            >
              {t.classRoom.clearSection}
            </button>
            <button
              type="button"
              onClick={openCopy}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-bold text-content ring-1 ring-line transition hover:ring-accent"
            >
              <IconUser className="h-4 w-4" /> {t.classRoom.duplicateForStudent}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> {t.game.add}
        </button>
      </div>

      {(queue === null || decks === null) && <p className="text-sm text-faint">{t.common.loading}</p>}

      {queue?.length === 0 && decks?.length === 0 && (
        <div className="rounded-2xl bg-surface-2 p-6 text-center">
          <p className="text-sm font-semibold text-content">{t.game.queueEmpty}</p>
          <p className="mt-1 text-[12px] text-faint">{t.game.subtitle}</p>
        </div>
      )}

      {(decks ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-black uppercase tracking-wide text-faint">{t.wordDeck.attachedGames}</p>
          {(decks ?? []).map((deck) => (
            <div key={deck.id} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setOpenDeck(deck)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-11 w-9 shrink-0 -rotate-3 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-violet-600 text-lg text-white shadow">♠</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-content">{deck.title}</span>
                    <span className="block text-[11px] text-faint">{fmt(t.wordDeck.cardCount, { n: deck.cards.length * deck.settings.repeats })}</span>
                  </span>
                </button>
                <button type="button" onClick={() => setOpenDeck(deck)} className="h-9 rounded-xl bg-accent-soft px-3 text-xs font-bold text-accent">{t.wordDeck.play}</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(t.wordDeck.removeFromClassConfirm)) return;
                    startBusy(async () => {
                      await removeWordDeckFromClassAction(deck.id);
                      await reload();
                    });
                  }}
                  title={t.wordDeck.removeFromClass}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showError && <p className="text-sm text-rose-500">{showError}</p>}

      <div className="flex flex-col gap-2">
        {(queue ?? []).map((game) => {
          const done = game.status === "DONE";
          const running = game.status === "RUNNING";

          return (
            <div
              key={game.id}
              className={cn(
                "rounded-2xl bg-surface p-3 ring-1 transition",
                running && !game.paused ? "ring-accent" : "ring-line",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenId(game.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] font-bold text-content">
                    {game.title || t.game.title}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {modeLabel[game.mode]} ·{" "}
                    {fmt(t.game.cardOf, {
                      at: done ? game.total : game.at + 1,
                      total: game.total,
                    })}
                  </span>
                </button>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    done
                      ? "bg-surface-2 text-faint"
                      : running && !game.paused
                        ? "tint-green"
                        : "tint-amber",
                  )}
                >
                  {done
                    ? t.game.finished
                    : running
                      ? game.paused
                        ? t.game.paused
                        : t.game.running
                      : t.game.ready}
                </span>

                {/*
                  * Игра появляется у ученика сама, но поверх неё может
                  * стоять доска — она во весь экран. Кнопка возвращает
                  * ученика к игре, не трогая саму игру.
                  */}
                {running && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startBusy(async () => {
                        const result = await showGameToStudentAction();
                        setShowError(result.error ?? null);
                      })
                    }
                    title={t.classRoom.sendStudentToGame}
                    aria-label={t.classRoom.sendStudentToGame}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-accent disabled:opacity-50"
                  >
                    <IconUser className="h-4 w-4" />
                  </button>
                )}

                {!done && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startBusy(async () => {
                        await (running && !game.paused
                          ? pauseGameAction(game.id)
                          : playGameAction(game.id));
                        await reload();
                        // Пущенную открываем сразу: смотреть на список,
                        // когда игра пошла, незачем.
                        if (game.paused || !running) setOpenId(game.id);
                      })
                    }
                    title={running && !game.paused ? t.game.pause : t.game.play}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition hover:opacity-90 disabled:opacity-50"
                  >
                    {running && !game.paused ? "❚❚" : "▶"}
                  </button>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(t.game.removeConfirm)) return;
                    startBusy(async () => {
                      await removeGameAction(game.id);
                      await reload();
                    });
                  }}
                  title={t.game.remove}
                  aria-label={t.game.remove}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>

              {/* Итог остаётся у законченной: за ним сюда и возвращаются. */}
              {(done || game.stats.answered > 0) && (
                <div className="mt-2">
                  <GameStatsCard stats={game.stats} compact />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {copying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => event.target === event.currentTarget && setCopying(false)}>
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
            <div className="flex items-center gap-3">
              <h3 className="flex-1 font-black text-content">{t.classRoom.duplicateTitle}</h3>
              <button type="button" onClick={() => setCopying(false)}><IconX className="h-4 w-4 text-muted" /></button>
            </div>
            <select value={copyTarget} onChange={(event) => setCopyTarget(event.target.value)} className="mt-4 h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-content ring-1 ring-line outline-none focus:ring-accent">
              <option value="">{t.classRoom.chooseStudent}</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <button
              type="button"
              disabled={!copyTarget || busy}
              onClick={() => startBusy(async () => {
                const result = await duplicateClassActivitiesAction(studentId, copyTarget);
                if (result.error) {
                  setShowError(result.error);
                  return;
                }
                setCopying(false);
              })}
              className="mt-4 h-10 w-full rounded-xl bg-accent text-sm font-black text-white disabled:opacity-40"
            >
              {t.classRoom.duplicate}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
