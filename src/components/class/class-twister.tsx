"use client";

/**
 * Скороговорка на уроке.
 *
 * Показывает ту, что закреплена за учеником, и даёт открыть её на весь
 * экран — читают её вдвоём, мелкой она не годится. Рядом история: что
 * этому ученику уже давали и когда, чтобы не выдать то же самое в
 * третий раз, не заметив.
 */
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  listTwistersAction,
  pinnedTwisterAction,
  twisterHistoryAction,
  unpinTwisterAction,
  type Twister,
  type TwisterHistoryRow,
} from "@/lib/actions/tongue-twisters";
import { TwisterViewer } from "@/components/twisters/twister-viewer";
import { TwisterAssign } from "@/components/twisters/twister-assign";
import { IconEye, IconPlus, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ClassTwister({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const { t, locale } = useT();
  const [pinned, setPinned] = useState<Twister | null>(null);
  const [history, setHistory] = useState<TwisterHistoryRow[]>([]);
  const [pool, setPool] = useState<Twister[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [focus, setFocus] = useState(false);
  const [picking, setPicking] = useState<Twister | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [, startBusy] = useTransition();

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([pinnedTwisterAction(studentId), twisterHistoryAction(studentId)])
      .then(([current, rows]) => {
        if (!alive) return;
        setPinned(current);
        setHistory(rows);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [studentId, nonce]);

  // Пул подтягиваем только когда его открывают: на уроке он нужен редко.
  useEffect(() => {
    if (pool !== null) return;
    let alive = true;
    listTwistersAction()
      .then((list) => alive && setPool(list))
      .catch(() => alive && setPool([]));
    return () => {
      alive = false;
    };
  }, [pool]);

  return (
    <div className="flex min-h-[320px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {pinned && (
          <>
            <button
              type="button"
              onClick={() => setFocus(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <IconEye className="h-4 w-4" /> {t.twisters.focus}
            </button>
            <button
              type="button"
              onClick={() =>
                startBusy(async () => {
                  await unpinTwisterAction(studentId);
                  setNonce((n) => n + 1);
                })
              }
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-muted transition hover:border-rose-400 hover:text-rose-500"
            >
              <IconX className="h-3.5 w-3.5" /> {t.twisters.unpin}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            "h-9 rounded-xl px-3 text-[13px] font-semibold transition",
            showHistory ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2",
          )}
        >
          {t.twisters.history}
          {history.length > 0 && <span className="ml-1 text-faint">{history.length}</span>}
        </button>
      </div>

      {showHistory ? (
        <div className="rounded-2xl bg-surface-2 p-3">
          <p className="text-[12px] font-semibold text-content">
            {fmt(t.twisters.historyFor, { name: studentName })}
          </p>
          {history.length === 0 ? (
            <p className="mt-2 text-[12px] text-faint">{t.twisters.historyEmpty}</p>
          ) : (
            <div className="mt-2 flex flex-col divide-y divide-line">
              {history.map((row) => (
                <div key={row.id} className="flex items-center gap-2.5 py-1.5">
                  <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    <Image
                      src={row.imageUrl}
                      alt={row.title ?? t.twisters.untitled}
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-content">
                    {row.title || t.twisters.untitled}
                  </span>
                  {row.pinned && (
                    <span className="tint-green shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {t.twisters.pinnedNow}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    {when.format(new Date(row.assignedAt))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : pinned ? (
        <button
          type="button"
          onClick={() => setFocus(true)}
          className="relative min-h-[260px] flex-1 overflow-hidden rounded-2xl bg-surface-2"
        >
          <Image
            src={pinned.imageUrl}
            alt={pinned.title ?? t.twisters.untitled}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-contain p-2"
          />
        </button>
      ) : (
        loaded && (
          <div className="rounded-2xl bg-surface-2 p-6 text-center">
            <p className="text-sm font-semibold text-content">{t.twisters.noPinned}</p>
            <p className="mt-1 text-[12px] text-faint">{t.twisters.noPinnedHint}</p>
          </div>
        )
      )}

      {/* Выбор прямо отсюда: за карточкой не надо уходить из класса. */}
      {!showHistory && (pool?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            {t.twisters.fromPool}
          </p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
            {(pool ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPicking(item)}
                title={item.title || t.twisters.untitled}
                className={cn(
                  "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 transition hover:ring-accent",
                  pinned?.id === item.id ? "ring-accent" : "ring-line",
                )}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.title ?? t.twisters.untitled}
                  fill
                  sizes="96px"
                  className="object-contain"
                />
              </button>
            ))}
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-faint">
              <IconPlus className="h-4 w-4" />
            </span>
          </div>
        </div>
      )}

      {focus && pinned && (
        <TwisterViewer items={[pinned]} startId={pinned.id} onClose={() => setFocus(false)} />
      )}

      {picking && (
        <TwisterAssign
          twister={picking}
          onClose={() => setPicking(null)}
          onDone={() => setNonce((n) => n + 1)}
        />
      )}
    </div>
  );
}
