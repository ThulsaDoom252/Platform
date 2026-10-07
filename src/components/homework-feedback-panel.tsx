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
  const { locale } = useT();
  const text = labels[locale];
  const router = useRouter();
  const initial = readHomeworkFeedback(settings);
  const source = `${kind}:${id}:${initial.autoEnabled}:${initial.manualReaction ?? ""}`;
  const [override, setOverride] = useState<{ source: string; value: HomeworkFeedbackSettings } | null>(null);
  const current = override && override.source === source ? override.value : initial;
  const [error, setError] = useState(false);
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

  function save(next: HomeworkFeedbackSettings) {
    setError(false);
    startBusy(async () => {
      try {
        const response = await saveHomeworkFeedbackAction(kind, id, next);
        if (response.error) { setError(true); return; }
        setOverride({ source, value: next });
        onChange?.(next);
        if (!onChange) router.refresh();
      } catch { setError(true); }
    });
  }
  const reaction = resolveHomeworkFeedback(current, score, canAuto);
  if (!teacher) return <HomeworkResultReactionBadge reaction={reaction} />;
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
            onClick={() => save({ autoEnabled: false, manualReaction: item.id })}
            className="rounded-xl border border-line bg-surface-2 px-2 py-3 text-xs font-bold text-content transition hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft disabled:opacity-50">
            <span aria-hidden className="mb-1 block text-2xl">{item.emoji}</span>{item.caption}
          </button>)}
        </div>
        {current.manualReaction && <button type="button" disabled={busy} onClick={() => save({ autoEnabled: false, manualReaction: null })}
          className="mt-3 rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted hover:text-accent disabled:opacity-50">{text.clear}</button>}
      </>}
      <HomeworkResultReactionBadge reaction={reaction} />
      {error && <p role="alert" className="mt-2 text-sm text-rose-500">{text.failed}</p>}
    </section>
  );
}
