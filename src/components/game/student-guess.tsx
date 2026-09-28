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
import { GameStatsCard } from "./game-stats";

export function StudentGuess() {
  const { t } = useT();
  const load = useCallback(() => myGameStateAction(), []);
  const { state, loaded, leftMs } = useGameState(load);

  if (!loaded) {
    return <p className="p-4 text-sm text-faint">{t.common.loading}</p>;
  }

  // Итог видит и ученик: он о своей игре, прятать там нечего.
  if (state?.status === "DONE") {
    return (
      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <GameStatsCard stats={state.stats} />
      </div>
    );
  }

  if (!state || !state.card) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="text-sm font-semibold text-content">{t.game.waiting}</p>
        <p className="mt-1 text-[12px] text-faint">{t.game.watchHere}</p>
      </div>
    );
  }

  // Партия готова, но ещё не пущена — карту показывать рано.
  if (state.paused && state.stats.answered === 0 && state.at === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <p className="text-sm font-semibold text-content">{t.game.waiting}</p>
        <p className="mt-1 text-[12px] text-faint">{t.game.watchHere}</p>
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
