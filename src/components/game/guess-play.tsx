"use client";

/**
 * Ход партии у учителя.
 *
 * Партия начинается с паузы: её ставят заранее, а пускают, когда оба
 * готовы. Пока пауза — отсчёт стоит, и снять её можно в любой момент.
 *
 * Галочка и крестик ставят оценку и переворачивают карту; если время
 * вышло, а учитель не нажал, карта переворачивается сама — это решает
 * сервер, здесь только видно результат.
 */
import { useCallback, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  answerCardAction,
  gameStateAction,
  nextCardAction,
  pauseGameAction,
  playGameAction,
  stopGameAction,
} from "@/lib/actions/guess-picture";
import { useGameState } from "@/lib/use-game-state";
import { GuessCard } from "./guess-card";
import { GameStatsCard } from "./game-stats";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export function GuessPlay({
  gameId,
  studentId,
  onBack,
  onChanged,
}: {
  gameId: string;
  studentId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { t } = useT();
  const load = useCallback(
    () => gameStateAction(studentId, gameId),
    [studentId, gameId],
  );
  const { state, loaded, leftMs, refresh } = useGameState(load);
  const [busy, startBusy] = useTransition();

  const act = (work: () => Promise<unknown>) =>
    startBusy(async () => {
      await work();
      await refresh();
      onChanged();
    });

  if (!loaded) return <p className="text-sm text-faint">{t.common.loading}</p>;
  if (!state) return null;

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-content"
    >
      <IconChevronLeft className="h-3.5 w-3.5" /> {t.game.back}
    </button>
  );

  if (state.status === "DONE" || !state.card) {
    return (
      <div className="flex flex-col gap-3">
        {backButton}
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <GameStatsCard stats={state.stats} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <span className="font-mono text-[12px] font-bold text-faint">
          {fmt(t.game.cardOf, { at: state.at + 1, total: state.total })}
        </span>
        <span className="tint-green rounded-full px-2 py-0.5 text-[11px] font-bold">
          {state.stats.right}
        </span>
        <span className="tint-rose rounded-full px-2 py-0.5 text-[11px] font-bold">
          {state.stats.wrong}
        </span>

        <button
          type="button"
          onClick={() => act(() => stopGameAction(studentId))}
          className="ml-auto h-8 rounded-lg px-2.5 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-rose-500"
        >
          {t.game.stop}
        </button>
      </div>

      <GuessCard state={state} leftMs={leftMs} />

      <div className="flex flex-wrap gap-2">
        {state.paused ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => playGameAction(state.id))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            ▶ {state.at === 0 && state.stats.answered === 0 ? t.game.play : t.game.resume}
          </button>
        ) : !state.revealed ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => answerCardAction(studentId, "right"))}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <IconCheck className="h-5 w-5" /> {t.game.right}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => answerCardAction(studentId, "wrong"))}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <IconX className="h-5 w-5" /> {t.game.wrong}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => pauseGameAction(state.id))}
              title={t.game.pause}
              aria-label={t.game.pause}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line text-lg text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              ❚❚
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => nextCardAction(studentId))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {t.game.next} <IconChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {state.paused && (
        <p className={cn("text-center text-[12px] text-faint")}>
          {t.game.waitingPlay}
        </p>
      )}
    </div>
  );
}
