"use client";

/**
 * Итог партии.
 *
 * Показывается и в конце игры, и в очереди у законченной активности:
 * результат никуда не девается, пока его не уберут.
 */
import { useT } from "@/components/i18n-provider";
import type { GameStats } from "@/lib/game-deck";
import { cn } from "@/lib/utils";

/** Секунды с одним знаком: «1.2 с» читается быстрее, чем «1234 мс». */
function seconds(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}`;
}

export function GameStatsCard({
  stats,
  compact = false,
}: {
  stats: GameStats;
  /** В очереди — одной строкой, в конце партии — во всю ширину. */
  compact?: boolean;
}) {
  const { t } = useT();

  if (compact) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        <span className="tint-green rounded-full px-2 py-0.5">{stats.right}</span>
        <span className="tint-rose rounded-full px-2 py-0.5">{stats.wrong}</span>
        {stats.timeouts > 0 && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-faint">
            {stats.timeouts}
          </span>
        )}
        {stats.answered > 0 && (
          <span className="text-faint">{stats.accuracy}%</span>
        )}
      </span>
    );
  }

  const tile = (
    label: string,
    value: string,
    hint?: string | null,
    tone?: string,
  ) => (
    <div className={cn("rounded-2xl px-4 py-3", tone ?? "bg-surface-2")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-black text-content">{value}</p>
      {hint && <p className="truncate text-[12px] text-muted">{hint}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-bold text-content">{t.game.statsTitle}</p>
        {stats.answered > 0 && (
          <span className="text-sm font-semibold text-accent">
            {stats.accuracy}% · {t.game.statsAccuracy.toLowerCase()}
          </span>
        )}
      </div>

      {/* Полоса верных и ошибок: доля видна раньше, чем прочитаны числа. */}
      {stats.answered > 0 && (
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${(stats.right / stats.answered) * 100}%` }}
          />
          <div
            className="bg-rose-500 transition-all"
            style={{ width: `${(stats.wrong / stats.answered) * 100}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tile(t.game.statsRight, String(stats.right), null, "tint-green")}
        {tile(t.game.statsWrong, String(stats.wrong), null, "tint-rose")}
        {tile(t.game.statsTimeouts, String(stats.timeouts))}
        {tile(t.game.statsAverage, `${seconds(stats.averageMs)} s`)}
      </div>

      {stats.fastestMs !== null || stats.slowestMs !== null ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {tile(
            t.game.statsFastest,
            `${seconds(stats.fastestMs)} s`,
            stats.fastestWord,
            "tint-sky",
          )}
          {tile(
            t.game.statsSlowest,
            `${seconds(stats.slowestMs)} s`,
            stats.slowestWord,
            "tint-amber",
          )}
        </div>
      ) : (
        <p className="text-[12px] text-faint">{t.game.statsNoTimes}</p>
      )}
    </div>
  );
}
