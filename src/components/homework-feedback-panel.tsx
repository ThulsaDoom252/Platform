"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { HomeworkResultReactionBadge } from "@/components/homework-result-reaction";
import { homeworkFeedbackAction, saveHomeworkFeedbackAction } from "@/lib/actions/homework-feedback";
import {
  HOMEWORK_RESULT_REACTIONS, readHomeworkFeedback, resolveHomeworkFeedback,
  type HomeworkFeedbackKind, type HomeworkFeedbackSettings, type HomeworkResultScore,
} from "@/lib/homework-feedback";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { IconPencil } from "@/components/icons";
import { PublicHomeworkTeacherNote } from "@/components/lessons/homework-teacher-note";

const labels = {
  en: { title: "Result reaction", auto: "Automatic reaction", hint: "The reaction is based on the completed attempt. Flashcards do not count.", manual: "Choose a reaction — visible to the student", clear: "Clear reaction", failed: "Could not save the reaction. Try again." },
  ru: { title: "Реакция на результат", auto: "Автоматическая реакция", hint: "По результату завершённой попытки. Flashcards не учитываются.", manual: "Выберите реакцию — ученик её увидит", clear: "Сбросить реакцию", failed: "Не удалось сохранить реакцию. Попробуйте ещё раз." },
  uk: { title: "Реакція на результат", auto: "Автоматична реакція", hint: "За результатом завершеної спроби. Flashcards не враховуються.", manual: "Виберіть реакцію — учень її побачить", clear: "Скинути реакцію", failed: "Не вдалося зберегти реакцію. Спробуйте ще раз." },
};

export function HomeworkFeedbackPanel({ kind, id, settings, score, canAuto = false, teacher = false, studentId, onChange }: {
  kind: HomeworkFeedbackKind; id: string; settings?: HomeworkFeedbackSettings | null;
  score?: HomeworkResultScore | null; canAuto?: boolean; teacher?: boolean;
  studentId?: string; onChange?: (settings: HomeworkFeedbackSettings) => void;
}) {
  const { locale, t } = useT();
  const text = labels[locale];
  const router = useRouter();
  const initial = readHomeworkFeedback(settings);
  const source = JSON.stringify([kind, id, initial.autoEnabled, initial.manualReaction, initial.teacherNote]);
  const [override, setOverride] = useState<{ source: string; value: HomeworkFeedbackSettings } | null>(null);
  const current = override && override.source === source ? override.value : initial;
  const [error, setError] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, startBusy] = useTransition();
  const refresh = async () => {
    const next = await homeworkFeedbackAction(kind, id);
    if (next) setOverride({ source, value: next });
  };
  // One subscription only on an open activity; the cards in the list never poll.
  useRealtimeSubscription({ channel: studentId ? `user:${studentId}` : null, events: "homework-feedback",
    enabled: !teacher && !!studentId && (kind !== "LESSON" || !onChange),
    onMessage: (message) => {
      if (message.data?.id === id && message.data?.kind === kind) return refresh();
    }, onFallback: refresh, fallbackMs: 30_000 });

  function save(next: HomeworkFeedbackSettings, closeNote = false) {
    setError(false);
    startBusy(async () => {
      try {
        const response = await saveHomeworkFeedbackAction(kind, id, { ...next, teacherNote: next.teacherNote ?? "" });
        if (response.error) { setError(true); return; }
        const saved = response.settings ?? readHomeworkFeedback(next);
        setOverride({ source, value: saved });
        onChange?.(saved);
        if (closeNote) setEditingNote(false);
        if (!onChange) router.refresh();
      } catch { setError(true); }
    });
  }
  const reaction = resolveHomeworkFeedback(current, score, canAuto);
  if (!teacher) return <><HomeworkResultReactionBadge reaction={reaction} />
    <PublicHomeworkTeacherNote label={t.interactiveHomework.teacherNote} note={current.teacherNote} /></>;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-sm font-black text-content">{text.title}</h2>
      {canAuto && <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm font-bold text-content">
        <input type="checkbox" checked={current.autoEnabled} disabled={busy}
          onChange={(event) => save({ ...current, autoEnabled: event.target.checked })} className="h-5 w-5 accent-accent" />
        {text.auto}
      </label>}
      {canAuto && current.autoEnabled ? <p className="mt-2 text-xs text-muted">{text.hint}</p> : <>
        <p className="mt-2 text-xs text-muted">{text.manual}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOMEWORK_RESULT_REACTIONS.map((item) => <button key={item.id} type="button" disabled={busy}
            aria-pressed={current.manualReaction === item.id}
            onClick={() => save({ ...current, autoEnabled: false, manualReaction: item.id })}
            className="rounded-xl border border-line bg-surface-2 px-2 py-3 text-xs font-bold text-content transition hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft disabled:opacity-50">
            <span aria-hidden className="mb-1 block text-2xl">{item.emoji}</span>{item.caption}
          </button>)}
        </div>
        {current.manualReaction && <button type="button" disabled={busy} onClick={() => save({ ...current, autoEnabled: false, manualReaction: null })}
          className="mt-3 rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted hover:text-accent disabled:opacity-50">{text.clear}</button>}
      </>}
      <HomeworkResultReactionBadge reaction={reaction} />
      <PublicHomeworkTeacherNote label={t.interactiveHomework.teacherNote} note={current.teacherNote} />
      {editingNote ? <form className="mt-3 rounded-xl bg-surface-2 p-3" onSubmit={event => { event.preventDefault(); save({ ...current, teacherNote: noteDraft }, true); }}>
        <label className="text-xs font-bold text-muted">{t.interactiveHomework.teacherNote}
          <textarea rows={3} maxLength={4000} value={noteDraft} disabled={busy} onChange={event => setNoteDraft(event.target.value)}
            className="mt-2 w-full resize-y rounded-xl bg-surface p-3 text-sm text-content outline-none ring-1 ring-line focus:ring-accent" />
        </label>
        <p className="mt-1 text-xs text-muted">{t.interactiveHomework.gradeNotePublic}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-black text-white disabled:opacity-45">{busy ? t.interactiveHomework.scoreSaving : t.interactiveHomework.scoreSave}</button>
          <button type="button" disabled={busy} onClick={() => setEditingNote(false)} className="min-h-10 rounded-xl border border-line px-4 text-xs font-bold text-muted">{t.interactiveHomework.cancel}</button>
        </div>
      </form> : <button type="button" disabled={busy} onClick={() => { setNoteDraft(current.teacherNote ?? ""); setEditingNote(true); setError(false); }}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-xs font-black text-accent hover:bg-accent-soft disabled:opacity-45">
        <IconPencil className="h-4 w-4" />{t.interactiveHomework.teacherNote}
      </button>}
      {error && <p role="alert" className="mt-2 text-sm text-rose-500">{text.failed}</p>}
    </section>
  );
}
