"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { BookOpen, Check, CheckCircle2, Eye, ListPlus, Pencil, Send, SpellCheck2, X } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import {
  createClassLessonNoteAction,
  focusClassLessonNoteAction,
  listClassLessonNotesAction,
  publishClassLessonSpellingAction,
  publishClassLessonSpellingDayAction,
  updateClassLessonNoteAction,
  type ClassLessonNote,
} from "@/lib/actions/class-tools";
import { SCHEDULE_FORMAT_TIME_ZONE } from "@/lib/schedule-time";
import { cn } from "@/lib/utils";

export type FocusedClassNote = {
  id: string;
  kind: "NOTE" | "SPELLING";
  body: string;
  translation: string | null;
  partOfSpeech: string | null;
  icon: string | null;
  examples: { en: string; tr: string }[];
  lessonDay: string;
  at: string;
};

export function ClassNotes({
  studentName,
  compact = false,
  embedded = false,
  onClose,
}: {
  studentName: string;
  compact?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const { t, locale } = useT();
  const [notes, setNotes] = useState<ClassLessonNote[]>([]);
  const [activeTab, setActiveTab] = useState<"NOTE" | "SPELLING">("NOTE");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const load = () => listClassLessonNotesAction().then(setNotes);
  useEffect(() => {
    let alive = true;
    void listClassLessonNotesAction().then((items) => {
      if (alive) setNotes(items);
    });
    return () => { alive = false; };
  }, [studentName]);

  const groups = useMemo(() => {
    const map = new Map<string, ClassLessonNote[]>();
    for (const note of notes.filter((item) => item.kind === activeTab)) {
      const key = note.lessonDay.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), note]);
    }
    return [...map.entries()];
  }, [activeTab, notes]);
  const localeName = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-GB";
  const day = new Intl.DateTimeFormat(localeName, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const time = new Intl.DateTimeFormat(localeName, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });

  const create = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setMessage(null);
    startTransition(async () => {
      const result = await createClassLessonNoteAction(text, activeTab);
      if (result.error) return setMessage(result.error);
      setDraft("");
      await load();
    });
  };

  const saveEdit = (id: string) => {
    const text = editDraft.trim();
    if (!text || busy) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updateClassLessonNoteAction(id, text);
      if (result.error) return setMessage(result.error);
      setEditing(null);
      setEditDraft("");
      await load();
    });
  };

  const publishOne = (id: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await publishClassLessonSpellingAction(id);
      if (result.error) return setMessage(result.error);
      setMessage(t.classRoom.spellingAdded);
      await load();
    });
  };

  const publishDay = (lessonDay: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await publishClassLessonSpellingDayAction(lessonDay);
      if (result.error) return setMessage(result.error);
      setMessage(t.classRoom.spellingAllAdded);
      await load();
    });
  };

  return (
    <section className={cn(
      "flex min-h-0 flex-col overflow-hidden bg-surface",
      embedded ? "h-full" : "rounded-2xl shadow-xl ring-1 ring-line",
      !embedded && (compact ? "h-full max-h-[720px]" : "h-[min(70dvh,650px)] w-[min(430px,calc(100vw-1rem))]"),
    )}>
      {!embedded && <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3.5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-content">{t.classRoom.notes}</h3>
          <p className="truncate text-[11px] text-faint">{studentName}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-content" aria-label={t.common.close}>
            <X className="h-4 w-4" />
          </button>
        )}
      </header>}

      <div className="border-b border-line p-3">
        <div className="mb-2 grid grid-cols-2 rounded-xl bg-surface-2 p-1 ring-1 ring-line">
          <button
            type="button"
            onClick={() => { setActiveTab("NOTE"); setDraft(""); setMessage(null); }}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-black transition",
              activeTab === "NOTE" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-content",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" /> {t.classRoom.notesTab}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("SPELLING"); setDraft(""); setMessage(null); }}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-black transition",
              activeTab === "SPELLING" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-content",
            )}
          >
            <SpellCheck2 className="h-3.5 w-3.5" /> {t.classRoom.spellingTab}
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-1.5 ring-1 ring-line focus-within:ring-accent">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                create();
              }
            }}
            placeholder={activeTab === "SPELLING" ? t.classRoom.spellingPlaceholder : t.classRoom.notesPlaceholder}
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-content outline-none placeholder:text-faint"
          />
          <button type="button" onClick={create} disabled={!draft.trim() || busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition hover:brightness-95 disabled:opacity-35" aria-label={activeTab === "SPELLING" ? t.classRoom.spellingCreate : t.classRoom.notesAdd}>
            {activeTab === "SPELLING" ? <SpellCheck2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-faint">
          {activeTab === "SPELLING" ? t.classRoom.spellingHint : t.classRoom.notesEnterHint}
        </p>
        {message && <p className="mt-1 text-[11px] font-bold text-rose-500">{message}</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {activeTab === "SPELLING" ? <SpellCheck2 className="h-9 w-9 text-accent/45" /> : <BookOpen className="h-9 w-9 text-accent/45" />}
            <p className="mt-2 text-xs font-bold text-faint">
              {activeTab === "SPELLING" ? t.classRoom.spellingEmpty : t.classRoom.notesEmpty}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(([key, items]) => (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-faint">
                    {day.format(new Date(items[0].lessonDay))}
                  </p>
                  {activeTab === "SPELLING" && items.some((item) => !item.publishedAt) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => publishDay(items[0].lessonDay)}
                      className="flex h-7 items-center gap-1 rounded-lg bg-accent-soft px-2 text-[10px] font-black text-accent transition hover:bg-accent hover:text-white disabled:opacity-45"
                    >
                      <ListPlus className="h-3 w-3" /> {t.classRoom.spellingAddAll}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((note, index) => (
                    <article key={note.id} className="group rounded-xl bg-surface-2 p-3 ring-1 ring-line">
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-lg bg-accent-soft px-1 text-[10px] font-black text-accent">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editing === note.id ? (
                            <input
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveEdit(note.id);
                                }
                                if (event.key === "Escape") setEditing(null);
                              }}
                              autoFocus
                              className="h-9 w-full rounded-lg bg-surface px-2 text-xs font-semibold text-content outline-none ring-1 ring-accent"
                            />
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                {note.kind === "SPELLING" && <span className="text-xl">{note.icon ?? "✏️"}</span>}
                                <p className={cn("whitespace-pre-wrap break-words font-semibold leading-relaxed text-content", note.kind === "SPELLING" ? "text-sm font-black" : "text-xs")}>{note.body}</p>
                              </div>
                              {note.kind === "SPELLING" && (
                                <div className="mt-2 rounded-lg bg-surface p-2 ring-1 ring-line/70">
                                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300">{note.translation}</p>
                                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-faint">
                                    {note.partOfSpeech ? t.mistakes[note.partOfSpeech === "NOUN" ? "nouns" : note.partOfSpeech === "ADJECTIVE" ? "adjectives" : note.partOfSpeech === "VERB" ? "verbs" : "phrases"] : ""}
                                  </p>
                                  {note.examples.map((example, exampleIndex) => (
                                    <p key={exampleIndex} className="mt-1 text-[10px] leading-relaxed text-muted">
                                      <span className="font-semibold text-content">{example.en}</span> — {example.tr}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          <p className="mt-1 text-[9px] font-medium text-faint">
                            {time.format(new Date(note.createdAt))}
                            {note.updatedAt !== note.createdAt ? ` · ${t.classRoom.notesEdited}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end gap-1">
                        {note.kind === "SPELLING" && (
                          note.publishedAt ? (
                            <span className="mr-auto flex h-7 items-center gap-1 rounded-lg bg-emerald-100 px-2 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> {t.classRoom.spellingAdded}
                            </span>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => publishOne(note.id)} className="mr-auto flex h-7 items-center gap-1 rounded-lg bg-violet-100 px-2 text-[10px] font-black text-violet-700 transition hover:bg-violet-200 disabled:opacity-45 dark:bg-violet-950/60 dark:text-violet-300">
                              <ListPlus className="h-3 w-3" /> {t.classRoom.spellingAddOne}
                            </button>
                          )
                        )}
                        {editing === note.id ? (
                          <button type="button" onClick={() => saveEdit(note.id)} className="flex h-7 items-center gap-1 rounded-lg bg-accent px-2 text-[10px] font-black text-white">
                            <Check className="h-3 w-3" /> {t.common.save}
                          </button>
                        ) : (
                          <button type="button" onClick={() => { setEditing(note.id); setEditDraft(note.body); }} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-muted transition hover:bg-surface hover:text-content">
                            <Pencil className="h-3 w-3" /> {t.classRoom.edit}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startTransition(async () => {
                            const result = await focusClassLessonNoteAction(note.id);
                            setMessage(result.error ?? t.classRoom.notesFocused);
                          })}
                          className="flex h-7 items-center gap-1 rounded-lg bg-emerald-100 px-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <Eye className="h-3 w-3" /> {t.classRoom.notesFocus}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function StudentFocusedNote({
  note,
  onClose,
}: {
  note: FocusedClassNote | null;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  if (!note) return null;
  const localeName = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-GB";
  const date = new Intl.DateTimeFormat(localeName, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  }).format(new Date(note.lessonDay));
  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <section className="class-note-focus relative w-full max-w-2xl overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-line sm:p-9">
        <button type="button" onClick={onClose} aria-label={t.common.close} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content">
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent shadow-sm">
          {note.kind === "SPELLING" ? <span className="text-3xl">{note.icon ?? "✏️"}</span> : <BookOpen className="h-7 w-7" />}
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[.18em] text-accent">
          {note.kind === "SPELLING" ? t.classRoom.spellingFocusTitle : t.classRoom.notesTeacherNote}
        </p>
        <p className="mt-1 text-xs font-semibold capitalize text-faint">{date}</p>
        <p className="mt-5 whitespace-pre-wrap break-words text-xl font-black leading-relaxed text-content sm:text-2xl">
          {note.body}
        </p>
        {note.kind === "SPELLING" && (
          <div className="mt-4 rounded-2xl bg-surface-2 p-4 ring-1 ring-line">
            <p className="text-base font-black text-emerald-600 dark:text-emerald-300">{note.translation}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[.16em] text-faint">{note.partOfSpeech}</p>
            <div className="mt-3 space-y-2">
              {note.examples.map((example, index) => (
                <div key={index} className="rounded-xl bg-surface px-3 py-2 ring-1 ring-line/70">
                  <p className="text-sm font-bold text-content">{example.en}</p>
                  <p className="mt-0.5 text-xs italic text-muted">{example.tr}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
