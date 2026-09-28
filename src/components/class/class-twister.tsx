"use client";

/**
 * Скороговорки на уроке.
 *
 * Ученик здесь уже известен — это тот, с кем открыт класс, — поэтому
 * карточка из пула уходит к нему одним нажатием, без выбора получателя.
 * Взять можно несколько: на урок их обычно берут пачкой и проходят по
 * очереди. Любую можно снять, история при этом остаётся.
 */
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  assignTwisterAction,
  listTwistersAction,
  pinnedTwistersAction,
  twisterHistoryAction,
  unpinTwisterAction,
  type Twister,
  type TwisterHistoryRow,
} from "@/lib/actions/tongue-twisters";
import { TwisterViewer } from "@/components/twisters/twister-viewer";
import { IconCheck, IconEye, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ClassTwister({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const { t, locale } = useT();
  const [pinned, setPinned] = useState<Twister[]>([]);
  const [history, setHistory] = useState<TwisterHistoryRow[]>([]);
  const [pool, setPool] = useState<Twister[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [focusAt, setFocusAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [busy, startBusy] = useTransition();

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  useEffect(() => {
    let alive = true;
    Promise.all([pinnedTwistersAction(studentId), twisterHistoryAction(studentId)])
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

  // Пул подтягиваем один раз: на уроке он меняется редко.
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

  const pinnedIds = new Set(pinned.map((item) => item.id));

  const toggle = (twister: Twister) =>
    startBusy(async () => {
      await (pinnedIds.has(twister.id)
        ? unpinTwisterAction(studentId, twister.id)
        : assignTwisterAction(twister.id, studentId));
      setNonce((n) => n + 1);
    });

  return (
    <div className="flex min-h-[320px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-content">{t.twisters.pinnedList}</span>
        {pinned.length > 0 && (
          <span className="tint-green rounded-full px-2 py-0.5 text-[11px] font-bold">
            {fmt(t.twisters.pinnedCount, { n: pinned.length })}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            "ml-auto h-8 rounded-lg px-2.5 text-[12px] font-semibold transition",
            showHistory ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2",
          )}
        >
          {t.twisters.history}
          {history.length > 0 && <span className="ml-1 text-faint">{history.length}</span>}
        </button>

        {pinned.length > 0 && !showHistory && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              startBusy(async () => {
                await unpinTwisterAction(studentId);
                setNonce((n) => n + 1);
              })
            }
            className="h-8 rounded-lg px-2.5 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
          >
            {t.twisters.unpinAll}
          </button>
        )}
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
      ) : pinned.length > 0 ? (
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          {pinned.map((item) => (
            <div
              key={item.id}
              className="group relative min-h-[200px] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line"
            >
              <button
                type="button"
                onClick={() => setFocusAt(item.id)}
                title={t.twisters.focus}
                className="relative block h-full w-full"
              >
                <Image
                  src={item.imageUrl}
                  alt={item.title ?? t.twisters.untitled}
                  fill
                  sizes="(max-width: 640px) 100vw, 40vw"
                  className="object-contain p-2"
                />
              </button>

              <span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
                <IconEye className="mr-1 inline h-3 w-3" />
                {t.twisters.focus}
              </span>

              <button
                type="button"
                disabled={busy}
                onClick={() => toggle(item)}
                title={t.twisters.unpin}
                aria-label={t.twisters.unpin}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100 disabled:opacity-50"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        loaded && (
          <div className="rounded-2xl bg-surface-2 p-6 text-center">
            <p className="text-sm font-semibold text-content">{t.twisters.noPinned}</p>
            <p className="mt-1 text-[12px] text-faint">
              {fmt(t.twisters.addHere, { name: studentName })}
            </p>
          </div>
        )
      )}

      {/* Пул: нажатие сразу ставит карточку на урок этому ученику. */}
      {!showHistory && (pool?.length ?? 0) > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            {t.twisters.fromPool}
          </p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
            {(pool ?? []).map((item) => {
              const on = pinnedIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(item)}
                  title={on ? t.twisters.already : (item.title || t.twisters.untitled)}
                  className={cn(
                    "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-2 transition disabled:opacity-60",
                    on ? "ring-accent" : "ring-transparent hover:ring-line",
                  )}
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.title ?? t.twisters.untitled}
                    fill
                    sizes="96px"
                    className="object-contain"
                  />
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {focusAt && (
        <TwisterViewer
          items={pinned}
          startId={focusAt}
          onClose={() => setFocusAt(null)}
        />
      )}
    </div>
  );
}
