"use client";

/**
 * Игра со стороны ученика.
 *
 * Только смотрит: оценку ставит учитель. Пока партии нет — видно, что
 * её ждут, чтобы пустой экран не выглядел поломкой.
 */
import { useCallback } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { myGameStateAction } from "@/lib/actions/guess-picture";
import { useGameState } from "@/lib/use-game-state";
import { GuessCard } from "./guess-card";

export function StudentGuess() {
  const { t } = useT();
  const load = useCallback(() => myGameStateAction(), []);
  const { state, loaded, leftMs } = useGameState(load);

  if (!loaded) {
    return <p className="p-4 text-sm text-faint">{t.common.loading}</p>;
  }

  if (!state || state.status === "DONE" || !state.card) {
    const finished = state?.status === "DONE";
    return (
      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="text-sm font-semibold text-content">
          {finished ? t.game.finished : t.game.waiting}
        </p>
        <p className="mt-1 text-[12px] text-faint">
          {finished
            ? fmt(t.game.result, {
                right: state.score.right,
                wrong: state.score.wrong,
                total: state.score.total,
              })
            : t.game.watchHere}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[12px] font-bold text-faint">
        {fmt(t.game.cardOf, { at: state.at + 1, total: state.total })}
      </span>
      <GuessCard state={state} leftMs={leftMs} />
    </div>
  );
}
