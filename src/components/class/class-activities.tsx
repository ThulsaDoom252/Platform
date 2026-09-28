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
import {
  listGamesAction,
  pauseGameAction,
  playGameAction,
  removeGameAction,
  type GameMode,
  type QueuedGame,
} from "@/lib/actions/guess-picture";
import { GuessSetup } from "@/components/game/guess-setup";
import { GuessPlay } from "@/components/game/guess-play";
import { GameStatsCard } from "@/components/game/game-stats";
import { IconPlus, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ClassActivities({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [queue, setQueue] = useState<QueuedGame[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const reload = useCallback(async () => {
    const rows = await listGamesAction(studentId);
    setQueue(rows);
    return rows;
  }, [studentId]);

  useEffect(() => {
    let alive = true;
    listGamesAction(studentId)
      .then((rows) => alive && setQueue(rows))
      .catch(() => alive && setQueue([]));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const modeLabel: Record<GameMode, string> = {
    PICTURE: t.game.modePicture,
    TRANSLATION: t.game.modeTranslation,
    MIXED: t.game.modeMixed,
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-content">{t.game.queue}</span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> {t.game.add}
        </button>
      </div>

      {queue === null && <p className="text-sm text-faint">{t.common.loading}</p>}

      {queue?.length === 0 && (
        <div className="rounded-2xl bg-surface-2 p-6 text-center">
          <p className="text-sm font-semibold text-content">{t.game.queueEmpty}</p>
          <p className="mt-1 text-[12px] text-faint">{t.game.subtitle}</p>
        </div>
      )}

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
    </div>
  );
}
