"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconPlus, IconX } from "@/components/icons";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import {
  addClassVocabularyAction,
  translateClassVocabularyAction,
  type ClassVocabularyDraft,
  type ClassVocabularyWord,
} from "@/lib/actions/class-vocabulary";
import type { ClassVocabularyLang } from "@/lib/class-vocabulary";
import { cn } from "@/lib/utils";

export type ClassTextSelection = {
  text: string;
  x: number;
  y: number;
  nonce: number;
};

/**
 * Быстрый перевод выделения. Он намеренно не связан с открытием словника:
 * запись появляется там только после явного нажатия «Добавить».
 */
export function SelectionTranslationPopover({
  request,
  onClose,
  onAdded,
}: {
  request: ClassTextSelection | null;
  onClose: () => void;
  onAdded: (word: ClassVocabularyWord) => void;
}) {
  const { t } = useT();
  const speech = useSpeech();
  const root = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const [lang, setLang] = useState<ClassVocabularyLang>("UK");
  const [draft, setDraft] = useState<ClassVocabularyDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [adding, startAdding] = useTransition();

  const translate = (target: ClassVocabularyLang) => {
    if (!request) return;
    const ticket = ++run.current;
    setLang(target);
    setDraft(null);
    setError(null);
    setLoading(true);
    void translateClassVocabularyAction(request.text, target)
      .then((result) => {
        if (ticket !== run.current) return;
        if (!result.draft) {
          setError(result.error ?? t.classVocabulary.translateFailed);
          return;
        }
        setDraft(result.draft);
      })
      .catch(() => {
        if (ticket === run.current) setError(t.classVocabulary.translateFailed);
      })
      .finally(() => {
        if (ticket === run.current) setLoading(false);
      });
  };

  useEffect(() => {
    if (!request) return;
    const ticket = ++run.current;
    void translateClassVocabularyAction(request.text, "UK")
      .then((result) => {
        if (ticket !== run.current) return;
        if (!result.draft) {
          setError(result.error ?? t.classVocabulary.translateFailed);
          return;
        }
        setDraft(result.draft);
      })
      .catch(() => {
        if (ticket === run.current) setError(t.classVocabulary.translateFailed);
      })
      .finally(() => {
        if (ticket === run.current) setLoading(false);
      });
    return () => {
      run.current += 1;
    };
  }, [request, t.classVocabulary.translateFailed]);

  useLayoutEffect(() => {
    if (!request || !root.current) return;
    const box = root.current.getBoundingClientRect();
    const margin = 12;
    const left = Math.min(
      Math.max(margin, request.x - Math.min(28, box.width / 4)),
      Math.max(margin, window.innerWidth - box.width - margin),
    );
    const below = request.y + 12;
    const top = below + box.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, request.y - box.height - 12);
    setPosition({ left, top });
  }, [draft, error, loading, request]);

  useEffect(() => {
    if (!request) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const closeOnScroll = () => onClose();
    const frame = requestAnimationFrame(() => {
      document.addEventListener("pointerdown", closeOutside);
      document.addEventListener("keydown", closeOnEscape);
      window.addEventListener("scroll", closeOnScroll, true);
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [onClose, request]);

  if (!request) return null;

  return (
    <div
      ref={root}
      role="dialog"
      aria-label={t.classVocabulary.translate}
      className="fixed z-[90] w-[min(22rem,calc(100vw-24px))] overflow-hidden rounded-2xl border border-accent/35 bg-surface shadow-2xl ring-4 ring-accent/10"
      style={position}
    >
      <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wide text-accent">
          {t.classVocabulary.translate}
        </span>
        <div className="flex rounded-lg bg-surface/80 p-0.5">
          {(["UK", "RU"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={loading || adding}
              onClick={() => translate(value)}
              className={cn(
                "h-7 rounded-md px-2 text-[10px] font-black transition",
                lang === value ? "bg-accent text-white" : "text-muted hover:text-accent",
              )}
            >
              {value === "UK" ? "UA" : "RU"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-content"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        {loading ? (
          <p className="py-5 text-center text-sm font-semibold text-muted">{t.common.loading}</p>
        ) : error ? (
          <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-600">
            {error}
          </p>
        ) : draft ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <SpeakPair
                text={draft.english}
                id={`selection-translation-${request.nonce}`}
                speech={speech}
                showUk={false}
              />
              <p className="min-w-0 flex-1 break-words text-base font-black text-content">
                {draft.english}
              </p>
            </div>
            <label className="block">
              <span className="sr-only">{draft.translationLang === "UK" ? "UA" : "RU"}</span>
              <textarea
                value={draft.translation}
                rows={2}
                onChange={(event) =>
                  setDraft((current) => current
                    ? { ...current, translation: event.target.value }
                    : current)
                }
                className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-bold text-content outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <button
              type="button"
              disabled={adding || !draft.english.trim() || !draft.translation.trim()}
              onClick={() => startAdding(async () => {
                setError(null);
                const result = await addClassVocabularyAction(draft);
                if (!result.word) {
                  setError(result.error ?? t.classVocabulary.addFailed);
                  return;
                }
                onAdded(result.word);
                onClose();
              })}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-sm font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-40"
            >
              <IconPlus className="h-4 w-4" />
              {t.classVocabulary.add}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
