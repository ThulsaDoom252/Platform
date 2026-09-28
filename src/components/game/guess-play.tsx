"use client";

/**
 * Ход партии у учителя.
 *
 * Галочка и крестик ставят оценку и переворачивают карту; если время
 * вышло, а учитель не нажал, карта переворачивается сама — это решает
 * сервер, здесь только видно результат. Следующая карта начинает новый
 * отсчёт, а не продолжает прежний.
 */
import { useCallback, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  answerCardAction,
  gameStateAction,
  nextCardAction,
  stopGameAction,
} from "@/lib/actions/guess-picture";
import { useGameState } from "@/lib/use-game-state";
import { GuessCard } from "./guess-card";
import { IconCheck, IconChevronRight, IconX } from "@/components/icons";

export function GuessPlay({
  studentId,
  onFinished,
}: {
  studentId: string;
  onFinished: () => void;
}) {
  const { t } = useT();
  const load = useCallback(() => gameStateAction(studentId), [studentId]);
  const { state, loaded, leftMs, refresh } = useGameState(load);
  const [busy, startBusy] = useTransition();

  if (!loaded) return <p className="text-sm text-faint">{t.common.loading}</p>;
  if (!state) return null;

  const act = (work: () => Promise<unknown>) =>
    startBusy(async () => {
      await work();
      await refresh();
    });

  if (state.status === "DONE" || !state.card) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="text-lg font-bold text-content">{t.game.finished}</p>
        <p className="mt-1 text-sm text-muted">
          {fmt(t.game.result, {
            right: state.score.right,
            wrong: state.score.wrong,
            total: state.score.total,
          })}
        </p>
        <button
          type="button"
          onClick={onFinished}
          className="mt-4 h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {t.game.again}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] font-bold text-faint">
          {fmt(t.game.cardOf, { at: state.at + 1, total: state.total })}
        </span>
        <span className="tint-green rounded-full px-2 py-0.5 text-[11px] font-bold">
          {state.score.right}
        </span>
        <span className="tint-rose rounded-full px-2 py-0.5 text-[11px] font-bold">
          {state.score.wrong}
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
        {!state.revealed ? (
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
    </div>
  );
}
