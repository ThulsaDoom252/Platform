"use client";

/**
 * Повторение слов в домашке ученика.
 *
 * Задание не запускается само: ученик открывает карточку, видит срок,
 * откуда оно выдано и сколько там слов, и стартует, когда готов. После
 * старта остановить нельзя, поэтому решение начать должно быть его.
 */
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import type { RevisionCard } from "@/lib/actions/revision";
import type { RevisionMode } from "@/lib/revision-modes";
import { IconCap, IconChevronRight, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

export function RevisionList({ items }: { items: RevisionCard[] }) {
  const { t, locale } = useT();

  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const MODE_LABEL: Record<RevisionMode, string> = {
    flashcards: t.revision.modeFlashcards,
    choose: t.revision.modeChoose,
    pairs: t.revision.modePairs,
    unscramble: t.revision.modeUnscramble,
    picture: t.revision.modePicture,
    definition: t.revision.modeDefinition,
    definitionPairs: t.revision.modeDefinitionPairs,
  };

  // Время берём один раз при показе: в рендере оно ползло бы само.
  const [now] = useState(() => Date.now());

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-content">{t.revision.title}</h2>

      {items.map((item) => {
        const late = item.dueAt && new Date(item.dueAt).getTime() < now && item.open;

        return (
          <div
            key={item.id}
            className={cn(
              "rounded-2xl bg-surface p-4 ring-1 shadow-sm sm:p-5",
              item.open ? "ring-line" : "ring-line opacity-80",
            )}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  item.open ? "tint-accent" : "bg-surface-2 text-faint",
                )}
              >
                {item.open ? (
                  <IconCap className="h-5 w-5" />
                ) : (
                  <IconCheck className="h-5 w-5" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-content">{item.title}</h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      !item.open
                        ? "tint-green"
                        : late
                          ? "tint-rose"
                          : "tint-amber",
                    )}
                  >
                    {item.attempts > 0
                      ? fmt(t.revision.attemptsDone, { n: item.attempts })
                      : t.revision.notDone}
                  </span>
                </div>

                <p className="mt-0.5 text-[12px] text-muted">
                  {fmt(t.revision.selected, { n: item.words })}
                  {item.dueAt && ` · ${t.revision.due} ${when.format(new Date(item.dueAt))}`}
                </p>

                {/* Откуда выдано: ученик должен дойти до тех же слов. */}
                {item.nodeName && (
                  <p className="mt-1 text-[12px] text-faint">
                    {t.revision.fromVocab}:{" "}
                    <Link
                      href="/student/materials"
                      className="font-semibold text-accent transition hover:opacity-80"
                    >
                      {item.nodeName}
                    </Link>{" "}
                    · {when.format(new Date(item.createdAt))}
                  </p>
                )}

                <p className="mt-1.5 flex flex-wrap gap-1">
                  {item.modes.map((mode) => (
                    <span
                      key={mode}
                      className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted"
                    >
                      {MODE_LABEL[mode as RevisionMode] ?? mode}
                    </span>
                  ))}
                </p>

                {item.open ? (
                  <Link
                    href={`/student/homework/revision/${item.id}`}
                    className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    {t.revision.open} <IconChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/student/homework/revision/${item.id}`}
                    className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-semibold text-content transition hover:border-accent hover:text-accent"
                  >
                    {t.revision.showResult} <IconChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
