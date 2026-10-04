"use client";

import { CheckCircle2, Languages, SpellCheck2 } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { PublishedSpellingMistake } from "@/lib/spelling-mistakes-data";
import type { SpellingPartOfSpeech } from "@/lib/spelling-mistake";

const GROUPS: SpellingPartOfSpeech[] = ["NOUN", "ADJECTIVE", "VERB", "PHRASE"];

export function SpellingMistakesView({
  items,
}: {
  items: PublishedSpellingMistake[];
}) {
  const { t } = useT();
  const labels: Record<SpellingPartOfSpeech, string> = {
    NOUN: t.mistakes.nouns,
    ADJECTIVE: t.mistakes.adjectives,
    VERB: t.mistakes.verbs,
    PHRASE: t.mistakes.phrases,
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-line">
      <div className="border-b border-line bg-surface-2/80 p-3 sm:p-4">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-black text-white shadow-sm">
          <SpellCheck2 className="h-4 w-4" />
          {t.mistakes.spelling}
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{items.length}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/55 dark:text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-lg font-black text-content">{t.mistakes.spellingEmpty}</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            {t.mistakes.spellingEmptyHint}
          </p>
        </div>
      ) : (
        <div className="space-y-8 p-4 sm:p-6">
          {GROUPS.map((group) => {
            const words = items.filter((item) => item.partOfSpeech === group);
            if (words.length === 0) return null;
            return (
              <div key={group}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    {group === "NOUN" ? "N" : group === "ADJECTIVE" ? "A" : group === "VERB" ? "V" : "P"}
                  </span>
                  <h2 className="text-base font-black text-content">{labels[group]}</h2>
                  <span className="text-xs font-bold text-faint">{words.length}</span>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {words.map((word) => (
                    <article
                      key={word.id}
                      className="group overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/35 motion-reduce:transform-none"
                    >
                      <div className="flex gap-3.5 p-4 sm:p-5">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-sky-100 text-3xl shadow-sm dark:from-violet-950/70 dark:to-sky-950/70">
                          {word.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-lg font-black text-content">{word.english}</h3>
                            {word.occurrences > 1 && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/55 dark:text-amber-300">
                                ×{word.occurrences}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-300">
                            <Languages className="h-3.5 w-3.5 shrink-0" /> {word.translation}
                          </p>
                          <div className="mt-3 space-y-2">
                            {word.examples.map((example, index) => (
                              <div key={`${word.id}-${index}`} className="rounded-xl bg-surface px-3 py-2 ring-1 ring-line/70">
                                <p className="text-xs font-bold leading-relaxed text-content">{example.en}</p>
                                <p className="mt-0.5 text-[11px] italic leading-relaxed text-muted">{example.tr}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
