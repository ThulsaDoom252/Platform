"use client";

/**
 * Активности на уроке.
 *
 * Пока активность одна — «Угадай по картинке», — но список сделан
 * списком: следующие встанут рядом, не ломая разметку. У учителя здесь
 * настройка и ход партии, у ученика — только карта.
 */
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { gameStateAction } from "@/lib/actions/guess-picture";
import { GuessSetup } from "@/components/game/guess-setup";
import { GuessPlay } from "@/components/game/guess-play";
import { cn } from "@/lib/utils";

export function ClassActivities({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [running, setRunning] = useState<boolean | null>(null);
  const [nonce, setNonce] = useState(0);

  /*
   * Если партия уже идёт, сразу показываем её, а не настройку заново:
   * учитель мог просто перезагрузить страницу посреди игры.
   */
  useEffect(() => {
    let alive = true;
    gameStateAction(studentId)
      .then((state) => {
        if (alive) setRunning(!!state && state.status !== "DONE");
      })
      .catch(() => {
        if (alive) setRunning(false);
      });
    return () => {
      alive = false;
    };
  }, [studentId, nonce]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold",
            "bg-accent text-white",
          )}
        >
          {t.game.title}
        </span>
        <span className="text-[12px] text-faint">{t.game.subtitle}</span>
      </div>

      {running === null ? (
        <p className="text-sm text-faint">{t.common.loading}</p>
      ) : running ? (
        <GuessPlay
          studentId={studentId}
          onFinished={() => {
            setRunning(false);
            setNonce((n) => n + 1);
          }}
        />
      ) : (
        <GuessSetup studentId={studentId} onStarted={() => setRunning(true)} />
      )}
    </div>
  );
}
