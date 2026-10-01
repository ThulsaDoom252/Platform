"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconCheck, IconPencil, IconPlus, IconSearch, IconTrash, IconX } from "@/components/icons";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import {
  addClassVocabularyAction,
  deleteClassVocabularyAction,
  listClassVocabularyAction,
  translateClassVocabularyAction,
  updateClassVocabularyAction,
  type ClassVocabularyDraft,
  type ClassVocabularyWord,
} from "@/lib/actions/class-vocabulary";
import { cleanClassVocabularyText, type ClassVocabularyLang } from "@/lib/class-vocabulary";
import { cn } from "@/lib/utils";

const POLL_MS = 4_000;

export function ClassVocabulary({
  ready,
  onAdded,
  compact = false,
}: {
  ready: boolean;
  onAdded: (word: ClassVocabularyWord) => void;
  /** Панель уже имеет общий заголовок и собственную фиксированную высоту. */
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const speech = useSpeech();
  const panel = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<ClassVocabularyWord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<ClassVocabularyLang>("UK");
  const [draft, setDraft] = useState<ClassVocabularyDraft | null>(null);
  const [sort, setSort] = useState<"DATE" | "ALPHA">("DATE");
  const [editing, setEditing] = useState<{
    id: string;
    english: string;
    translation: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const translateRun = useRef(0);

  const load = useCallback(async () => {
    if (!ready) {
      setRows([]);
      setLoaded(true);
      return;
    }
    try {
      setRows(await listClassVocabularyAction());
    } finally {
      setLoaded(true);
    }
  }, [ready]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    if (!ready) return () => window.cancelAnimationFrame(frame);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [load, ready]);

  const translate = useCallback((raw: string, target: ClassVocabularyLang = lang) => {
    const text = cleanClassVocabularyText(raw);
    if (!text) return;
    const ticket = ++translateRun.current;
    setQuery(text);
    setError(null);
    startBusy(async () => {
      const result = await translateClassVocabularyAction(text, target);
      if (ticket !== translateRun.current) return;
      if (!result.draft) {
        setDraft(null);
        setError(result.error ?? t.classVocabulary.translateFailed);
        return;
      }
      setDraft(result.draft);
    });
  }, [lang, t.classVocabulary.translateFailed]);

  const switchLang = (next: ClassVocabularyLang) => {
    setLang(next);
    setDraft(null);
    if (query.trim()) translate(query, next);
  };

  const ordered = useMemo(() => {
    if (sort === "DATE") return rows;
    return [...rows].sort((a, b) => a.english.localeCompare(b.english, "en"));
  }, [rows, sort]);

  const date = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    [locale],
  );

  if (!ready) {
    return (
      <section className="rounded-2xl bg-surface p-6 text-center ring-1 ring-line">
        <p className="text-sm font-semibold text-content">{t.classVocabulary.pickStudent}</p>
      </section>
    );
  }

  return (
    <section
      ref={panel}
      className={cn(
        "scroll-mt-4 overflow-hidden bg-surface",
        compact ? "flex h-full min-h-0 flex-col" : "rounded-2xl ring-1 ring-line",
      )}
    >
      <div className="border-b border-line p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          {!compact && (
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-content">{t.classVocabulary.title}</h2>
              <p className="mt-0.5 text-xs text-faint">{t.classVocabulary.subtitle}</p>
            </div>
          )}
          {compact && <div className="min-w-0 flex-1" />}
          <div className="flex rounded-xl bg-surface-2 p-1">
            {(["UK", "RU"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => switchLang(value)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-black transition",
                  lang === value ? "bg-accent text-white" : "text-muted hover:text-content",
                )}
              >
                {value === "UK" ? "UA" : "RU"}
              </button>
            ))}
          </div>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            translate(query);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.classVocabulary.placeholder}
              maxLength={240}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm font-semibold text-content outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="h-11 rounded-xl bg-accent px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? t.common.loading : t.classVocabulary.translate}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-faint">DeepL · {t.classVocabulary.selectionHint}</p>

        {draft && (
          <div className="mt-4 rounded-2xl bg-accent-soft p-3 ring-1 ring-accent/30">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-faint">EN</span>
                <span className="flex items-center gap-1 rounded-xl bg-surface px-2 ring-1 ring-line">
                  <SpeakPair text={draft.english} id="class-vocabulary-draft" speech={speech} showUk={false} />
                  <input
                    value={draft.english}
                    onChange={(event) => setDraft((value) => value ? { ...value, english: event.target.value } : value)}
                    className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-bold text-content outline-none"
                  />
                </span>
              </label>
              <span className="hidden pt-4 text-faint sm:block">⇄</span>
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-faint">{draft.translationLang === "UK" ? "UA" : "RU"}</span>
                <input
                  value={draft.translation}
                  onChange={(event) => setDraft((value) => value ? { ...value, translation: event.target.value } : value)}
                  className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-bold text-content outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-muted">
                {draft.direction === "FROM_ENGLISH" ? `EN → ${draft.translationLang === "UK" ? "UA" : "RU"}` : `${draft.translationLang === "UK" ? "UA" : "RU"} → EN`}
              </span>
              <button
                type="button"
                disabled={busy || !draft.english.trim() || !draft.translation.trim()}
                onClick={() => startBusy(async () => {
                  setError(null);
                  const result = await addClassVocabularyAction(draft);
                  if (!result.word) {
                    setError(result.error ?? t.classVocabulary.addFailed);
                    return;
                  }
                  setRows((current) => [result.word!, ...current.filter((word) => word.id !== result.word!.id)]);
                  onAdded(result.word);
                  setDraft(null);
                  setQuery("");
                })}
                className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-black text-white disabled:opacity-40"
              >
                <IconPlus className="h-3.5 w-3.5" /> {t.classVocabulary.add}
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
      </div>

      <div className="flex items-center gap-1 border-b border-line px-4 py-2.5">
        <span className="mr-auto text-xs font-bold text-muted">{rows.length} · {t.classVocabulary.entries}</span>
        <button type="button" onClick={() => setSort("DATE")} className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-bold", sort === "DATE" ? "bg-accent text-white" : "text-muted")}>{t.classVocabulary.newest}</button>
        <button type="button" onClick={() => setSort("ALPHA")} className={cn("rounded-lg px-2.5 py-1.5 text-[11px] font-bold", sort === "ALPHA" ? "bg-accent text-white" : "text-muted")}>{t.classVocabulary.alphabetical}</button>
      </div>

      <div className={cn("overflow-y-auto p-3", compact ? "min-h-0 flex-1" : "max-h-[32rem]")}>
        {!loaded && <p className="p-6 text-center text-sm text-faint">{t.common.loading}</p>}
        {loaded && ordered.length === 0 && <p className="p-8 text-center text-sm text-faint">{t.classVocabulary.empty}</p>}
        <div className="flex flex-col gap-2">
          {ordered.map((word) => {
            const active = editing?.id === word.id;
            return (
              <article key={word.id} className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                {active && editing ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={editing.english} onChange={(event) => setEditing({ ...editing, english: event.target.value })} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-content outline-none focus:border-accent" />
                    <input value={editing.translation} onChange={(event) => setEditing({ ...editing, translation: event.target.value })} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-content outline-none focus:border-accent" />
                    <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                      <button type="button" onClick={() => setEditing(null)} className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-muted"><IconX className="h-3.5 w-3.5" /> {t.classVocabulary.cancel}</button>
                      <button type="button" disabled={busy} onClick={() => startBusy(async () => {
                        const result = await updateClassVocabularyAction(word.id, editing);
                        if (!result.word) { setError(result.error ?? t.classVocabulary.saveFailed); return; }
                        setRows((current) => current.map((item) => item.id === result.word!.id ? result.word! : item));
                        setEditing(null);
                      })} className="flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-xs font-bold text-white disabled:opacity-40"><IconCheck className="h-3.5 w-3.5" /> {t.classVocabulary.save}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <SpeakPair text={word.english} id={`class-vocabulary-${word.id}`} speech={speech} showUk={false} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-black text-content">{word.english}</p>
                        <p className="mt-0.5 break-words text-sm font-semibold text-accent">{word.translation}</p>
                        <p className="mt-1 text-[10px] font-semibold text-faint">{word.translationLang === "UK" ? "UA" : "RU"} · {date.format(new Date(word.createdAt))}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setEditing({ id: word.id, english: word.english, translation: word.translation });
                          }}
                          title={t.classVocabulary.edit}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-accent"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(word.id)}
                          title={t.classVocabulary.delete}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {confirmDeleteId === word.id && (
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-lg bg-rose-500/10 px-2.5 py-2 ring-1 ring-rose-500/20">
                        <span className="mr-auto text-xs font-bold text-rose-600 dark:text-rose-400">
                          {t.classVocabulary.deleteConfirm}
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-muted transition hover:bg-surface"
                        >
                          <IconX className="h-3.5 w-3.5" /> {t.classVocabulary.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startBusy(async () => {
                            setError(null);
                            const result = await deleteClassVocabularyAction(word.id);
                            if (!result.deleted) {
                              setError(result.error ?? t.classVocabulary.deleteFailed);
                              return;
                            }
                            setRows((current) => current.filter((item) => item.id !== result.deleted));
                            setConfirmDeleteId(null);
                          })}
                          className="flex h-8 items-center gap-1 rounded-lg bg-rose-500 px-2.5 text-xs font-bold text-white transition hover:bg-rose-600 disabled:opacity-40"
                        >
                          <IconTrash className="h-3.5 w-3.5" /> {t.classVocabulary.delete}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
