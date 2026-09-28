"use client";

/**
 * Карта на столе — общая для учителя и ученика.
 *
 * Пока идёт отсчёт, видна только картинка. Когда карта перевёрнута,
 * показывается слово и то, чем дело кончилось: верно, неверно или время
 * вышло. Разметка одна на обоих, чтобы они видели ровно одно и то же.
 */
import Image from "next/image";
import { useT } from "@/components/i18n-provider";
import type { GameState } from "@/lib/actions/guess-picture";
import { cn } from "@/lib/utils";

export function GuessCard({
  state,
  leftMs,
}: {
  state: GameState;
  /** Остаток считает страница: сервер даёт точку отсчёта, не тик. */
  leftMs: number;
}) {
  const { t } = useT();
  const card = state.card;
  if (!card) return null;

  const full = state.seconds * 1000;
  const part = full > 0 ? Math.max(0, Math.min(1, leftMs / full)) : 0;
  const left = Math.ceil(leftMs / 1000);
  const timedOut = state.revealed && state.verdict === "timeout";

  return (
    <div className="relative flex flex-col gap-3">
      {/* Полоса времени: цифры на уроке считывать некогда, полоса — да. */}
      {!state.revealed && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200 ease-linear",
                part > 0.33 ? "bg-accent" : "bg-rose-500",
              )}
              style={{ width: `${part * 100}%` }}
            />
          </div>
          <span
            className={cn(
              "w-8 shrink-0 text-right font-mono text-lg font-bold tabular-nums",
              part > 0.33 ? "text-content" : "text-rose-500",
            )}
          >
            {left}
          </span>
        </div>
      )}

      <div className="relative flex min-h-[46vh] flex-1 items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
        {/* Лицевая сторона: картинка или перевод — смотря во что играем. */}
        {card.face === "TRANSLATION" ? (
          <p className="px-6 py-10 text-center text-3xl font-black leading-tight text-content sm:text-5xl">
            {card.translation}
          </p>
        ) : (
          <Image
            key={card.phraseId}
            src={card.imageUrl}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            unoptimized
            priority
            className="object-contain p-3"
          />
        )}

        {state.verdict === "wrong" && (
          <div className="absolute inset-0 flex items-center justify-center bg-rose-600/85">
            <span className="animate-pulse text-5xl font-black tracking-widest text-white drop-shadow-lg sm:text-7xl">
              {t.game.wrongBanner}
            </span>
          </div>
        )}

        {state.verdict === "right" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/85">
            <span className="text-5xl font-black tracking-widest text-white drop-shadow-lg sm:text-7xl">
              {t.game.rightBanner}
            </span>
          </div>
        )}
      </div>

      {/* Оборот карты: слово и перевод. */}
      {state.revealed && (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-center ring-1",
            timedOut ? "bg-surface-2 ring-line" : "bg-surface ring-line",
          )}
        >
          <p className="text-2xl font-black text-content sm:text-3xl">{card.word}</p>
          {card.translation && card.face === "PICTURE" && (
            <p className="mt-0.5 text-sm text-muted">{card.translation}</p>
          )}
          {timedOut && (
            <p className="mt-1 text-[12px] font-semibold text-faint">{t.game.flipped}</p>
          )}
        </div>
      )}
    </div>
  );
}
