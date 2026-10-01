"use client";

import {
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import {
  addHomeworkQuestionAction,
  removeHomeworkQuestionAction,
  resetHomeworkExerciseAnswersAction,
  saveHomeworkResponseAction,
  saveHomeworkTeacherNoteAction,
  submitHomeworkAutoAnswerAction,
} from "@/lib/actions/lesson-homework";
import {
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkProgress,
  homeworkStatus,
  homeworkStatusKey,
  homeworkValueKey,
  type HomeworkExercise,
  type HomeworkItem,
  type HomeworkStoredState,
  type InteractiveHomeworkPlan,
} from "@/lib/lesson-homework";
import {
  IconCheck,
  IconChevronDown,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type InteractiveHomeworkSession = {
  assignmentId: string;
  unitId: string;
  teacher: boolean;
  state: HomeworkStoredState;
};

export function InteractiveHomework({
  plan,
  session,
}: {
  plan: InteractiveHomeworkPlan;
  session: InteractiveHomeworkSession;
}) {
  const { t } = useT();
  const [state, setState] = useState(session.state);
  const [showAnswers, setShowAnswers] = useState(false);
  const progress = homeworkProgress(plan, state);

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft via-surface to-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">
              {t.interactiveHomework.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black text-content">{plan.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {session.teacher && (
              <button
                type="button"
                aria-pressed={showAnswers}
                onClick={() => setShowAnswers((shown) => !shown)}
                className="flex h-10 items-center gap-2 rounded-xl bg-surface px-3 text-xs font-black text-accent ring-1 ring-line transition hover:ring-accent"
              >
                {showAnswers ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                {showAnswers
                  ? t.interactiveHomework.hideAnswers
                  : t.interactiveHomework.showAnswers}
              </button>
            )}
            <div className="rounded-xl bg-surface px-3 py-2 text-right ring-1 ring-line">
              <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                {t.interactiveHomework.requiredProgress}
              </p>
              <p className="text-lg font-black text-accent">
                {progress.done}/{progress.total}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </section>

      {plan.exercises.map((exercise, index) => (
        <HomeworkExerciseView
          key={exercise.id}
          exercise={exercise}
          number={plan.exercises.slice(0, index + 1).filter((item) => !item.optional).length}
          session={session}
          state={state}
          setState={setState}
          showAnswers={showAnswers}
        />
      ))}
    </div>
  );
}

function HomeworkExerciseView({
  exercise,
  number,
  session,
  state,
  setState,
  showAnswers,
}: {
  exercise: HomeworkExercise;
  number: number;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
}) {
  const { t } = useT();
  const [resetKey, setResetKey] = useState(0);
  const [resetting, startReset] = useTransition();
  const instruction =
    exercise.kind === "fill"
      ? t.interactiveHomework.instructions.fill
      : exercise.kind === "definition"
        ? t.interactiveHomework.instructions.definition
        : exercise.kind === "describe"
          ? t.interactiveHomework.instructions.describe
          : exercise.kind === "drag"
            ? t.interactiveHomework.instructions.drag
            : exercise.kind === "translate"
              ? t.interactiveHomework.instructions.translate
              : exercise.kind === "question-audio"
                ? t.interactiveHomework.instructions.questionAudio
                : t.interactiveHomework.instructions.questionText;
  const body = (
    <div className="mt-4">
      {exercise.wordBank && exercise.wordBank.length > 0 && exercise.kind !== "drag" && (
        <div className="mb-4 rounded-xl bg-accent-soft/70 p-3 ring-1 ring-accent/15">
          <p className="text-[10px] font-black uppercase tracking-wide text-accent">
            {t.interactiveHomework.useWords}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {exercise.wordBank.map((word) => (
              <li key={word} className="text-[13px] font-semibold leading-relaxed text-content">
                {word}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ExerciseItems
        key={resetKey}
        exercise={exercise}
        session={session}
        state={state}
        setState={setState}
        showAnswers={showAnswers}
      />
    </div>
  );

  if (exercise.optional) {
    return (
      <details className="group rounded-2xl border border-dashed border-accent/35 bg-surface p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <summary className="flex min-w-0 flex-1 cursor-pointer list-none items-center gap-3">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
              {t.interactiveHomework.bonus}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold text-content">{exercise.title}</span>
            <IconChevronDown className="h-4 w-4 text-faint transition group-open:rotate-180" />
          </summary>
          <ExerciseOptionsMenu
            busy={resetting}
            onReset={() => startReset(async () => {
              const result = await resetHomeworkExerciseAnswersAction(session.assignmentId, exercise.id);
              if (result.error) return;
              setState((current) => clearExerciseAnswers(current, exercise));
              setResetKey((key) => key + 1);
            })}
          />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">{instruction}</p>
        {body}
      </details>
    );
  }

  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-black text-white">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-content">{exercise.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{instruction}</p>
        </div>
        <ExerciseOptionsMenu
          busy={resetting}
          onReset={() => startReset(async () => {
            const result = await resetHomeworkExerciseAnswersAction(session.assignmentId, exercise.id);
            if (result.error) return;
            setState((current) => clearExerciseAnswers(current, exercise));
            setResetKey((key) => key + 1);
          })}
        />
      </div>
      {body}
    </section>
  );
}

function clearExerciseAnswers(state: HomeworkStoredState, exercise: HomeworkExercise) {
  const updated = { ...state };
  for (const item of exercise.items) {
    delete updated[homeworkValueKey(item.id)];
    delete updated[homeworkStatusKey(item.id)];
    delete updated[homeworkAttemptsKey(item.id)];
  }
  return updated;
}

function ExerciseOptionsMenu({ busy, onReset }: { busy: boolean; onReset: () => void }) {
  const { t } = useT();
  return (
    <details className="relative shrink-0">
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content [&::-webkit-details-marker]:hidden"
        title={t.interactiveHomework.options}
      >
        <IconDots className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 top-9 z-30 w-44 rounded-xl bg-surface p-1.5 shadow-xl ring-1 ring-line">
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            onReset();
          }}
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-bold text-content transition hover:bg-surface-2 disabled:opacity-50"
        >
          {t.interactiveHomework.resetAnswer}
        </button>
      </div>
    </details>
  );
}

function ExerciseItems(props: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
}) {
  if (props.exercise.kind === "drag") return <DragExercise {...props} />;
  if (props.exercise.kind === "fill" || props.exercise.kind === "definition") {
    return <AutoTextExercise {...props} />;
  }
  return <ManualExercise {...props} />;
}

function AutoTextExercise({
  exercise,
  session,
  state,
  setState,
  showAnswers,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
}) {
  const { t } = useT();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(exercise.items.map((item) => [item.id, state[homeworkValueKey(item.id)] ?? ""])),
  );
  const [feedback, setFeedback] = useState<Record<string, "wrong" | "right" | undefined>>({});
  const [busy, startBusy] = useTransition();

  const submit = (item: HomeworkItem) => {
    const value = drafts[item.id] ?? "";
    const savedValue = state[homeworkValueKey(item.id)] ?? "";
    if (!value.trim() || busy || value.trim() === savedValue.trim()) return;
    startBusy(async () => {
      const result = await submitHomeworkAutoAnswerAction(session.assignmentId, item.id, value);
      if ("error" in result && result.error) return;
      const next = result as { value: string; status: "correct" | "locked" | null; attempts: string[] };
      setState((current) => {
        const updated = {
          ...current,
          [homeworkValueKey(item.id)]: next.value,
          [homeworkAttemptsKey(item.id)]: JSON.stringify(next.attempts),
        };
        if (next.status) updated[homeworkStatusKey(item.id)] = next.status;
        else delete updated[homeworkStatusKey(item.id)];
        return updated;
      });
      setDrafts((current) => ({
        ...current,
        [item.id]: next.value,
      }));
      const tone = next.status === "correct" ? "right" : "wrong";
      setFeedback((current) => ({ ...current, [item.id]: undefined }));
      requestAnimationFrame(() => setFeedback((current) => ({ ...current, [item.id]: tone })));
      window.setTimeout(
        () => setFeedback((current) => ({ ...current, [item.id]: undefined })),
        900,
      );
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {exercise.items.map((item, index) => {
        const status = homeworkStatus(state, item.id);
        return (
          <HomeworkItemShell
            key={item.id}
            item={item}
            index={index}
            session={session}
            state={state}
            setState={setState}
            showAnswers={showAnswers}
          >
            <InlineHomeworkAnswer
              item={item}
              value={drafts[item.id] ?? ""}
              state={state}
              feedback={feedback[item.id]}
              disabled={Boolean(status) || busy}
              placeholder={t.interactiveHomework.answerPlaceholder}
              onChange={(value) => setDrafts((current) => ({ ...current, [item.id]: value }))}
              onCommit={() => submit(item)}
            />
          </HomeworkItemShell>
        );
      })}
    </div>
  );
}

function DragExercise({
  exercise,
  session,
  state,
  setState,
  showAnswers,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "wrong" | "right" | undefined>>({});
  const [busy, startBusy] = useTransition();
  const used = useMemo(
    () => session.teacher
      ? new Set<string>()
      : new Set(
          exercise.items
            .filter((item) => homeworkStatus(state, item.id))
            .map((item) => item.answer ?? ""),
        ),
    [exercise.items, session.teacher, state],
  );

  const drop = (item: HomeworkItem, answer: string | null) => {
    if (!answer || homeworkStatus(state, item.id)) return;
    startBusy(async () => {
      const result = await submitHomeworkAutoAnswerAction(session.assignmentId, item.id, answer);
      if ("error" in result && result.error) return;
      const next = result as { value: string; status: "correct" | "locked" | null; attempts: string[] };
      setState((current) => {
        const updated = {
          ...current,
          [homeworkValueKey(item.id)]: next.value,
          [homeworkAttemptsKey(item.id)]: JSON.stringify(next.attempts),
        };
        if (next.status) updated[homeworkStatusKey(item.id)] = next.status;
        else delete updated[homeworkStatusKey(item.id)];
        return updated;
      });
      setSelected(null);
      const tone = next.status === "correct" ? "right" : "wrong";
      setFeedback((current) => ({ ...current, [item.id]: undefined }));
      requestAnimationFrame(() => setFeedback((current) => ({ ...current, [item.id]: tone })));
      window.setTimeout(
        () => setFeedback((current) => ({ ...current, [item.id]: undefined })),
        900,
      );
    });
  };

  const onDrop = (event: DragEvent, item: HomeworkItem) => {
    event.preventDefault();
    drop(item, event.dataTransfer.getData("text/plain"));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
        {(exercise.wordBank ?? []).map((word) => (
          <button
            key={word}
            type="button"
            draggable={!used.has(word)}
            disabled={used.has(word) || busy}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", word)}
            onClick={() => setSelected((current) => current === word ? null : word)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold ring-1 transition",
              used.has(word)
                ? "bg-surface text-faint opacity-35 ring-line"
                : selected === word
                  ? "bg-accent text-white ring-accent"
                  : "cursor-grab bg-surface text-content ring-line hover:ring-accent",
            )}
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {exercise.items.map((item, index) => {
          const status = homeworkStatus(state, item.id);
          const value = state[homeworkValueKey(item.id)] ?? "";
          return (
            <HomeworkItemShell
              key={item.id}
              item={item}
              index={index}
              session={session}
              state={state}
              setState={setState}
              showAnswers={showAnswers}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold leading-relaxed text-content">
                <span>{item.prompt}</span>
                <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
                  <button
                    type="button"
                    disabled={Boolean(status) || busy}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDrop(event, item)}
                    onClick={() => drop(item, selected)}
                    className={cn(
                      "min-h-9 w-56 max-w-full rounded-lg border-2 border-dashed px-3 py-1.5 text-left text-sm font-bold transition",
                      feedback[item.id] === "wrong" && "homework-error-flash",
                      feedback[item.id] === "right" && "homework-correct-pop",
                      status === "correct"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : status === "locked"
                          ? "border-rose-500 bg-rose-50 text-rose-800"
                          : selected
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line bg-surface-2 text-faint",
                    )}
                  >
                    {value || (selected ? `${t.interactiveHomework.place}: ${selected}` : t.interactiveHomework.dropHere)}
                  </button>
                  <AttemptDots item={item} state={state} />
                </span>
              </div>
            </HomeworkItemShell>
          );
        })}
      </div>
    </div>
  );
}

function ManualExercise({
  exercise,
  session,
  state,
  setState,
  showAnswers,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(exercise.items.map((item) => [item.id, state[homeworkValueKey(item.id)] ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [busy, startBusy] = useTransition();

  const save = (item: HomeworkItem) => {
    const value = drafts[item.id] ?? "";
    if (busy || value.trim() === (state[homeworkValueKey(item.id)] ?? "").trim()) return;
    setError(null);
    startBusy(async () => {
      const result = await saveHomeworkResponseAction(session.assignmentId, item.id, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setState((current) => ({ ...current, [homeworkValueKey(item.id)]: value.trim() }));
    });
  };

  const addQuestion = () => {
    if (exercise.kind !== "question-text" && exercise.kind !== "question-audio") return;
    const questionKind = exercise.kind;
    setError(null);
    startBusy(async () => {
      const result = await addHomeworkQuestionAction(session.unitId, questionKind, newQuestion);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewQuestion("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {exercise.items.length === 0 && !session.teacher && (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-faint">
          {t.interactiveHomework.questionsLater}
        </p>
      )}
      {exercise.items.map((item, index) => {
        return (
          <HomeworkItemShell
            key={item.id}
            item={item}
            index={index}
            session={session}
            state={state}
            setState={setState}
            showAnswers={showAnswers}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {item.word && (
                  <p className="mb-1 text-sm font-black text-accent">{item.word}</p>
                )}
                <p className="text-sm font-semibold leading-relaxed text-content">{item.prompt}</p>
                {item.hint && (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {item.hint}
                  </span>
                )}
              </div>
              {session.teacher && (exercise.kind === "question-text" || exercise.kind === "question-audio") && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    const result = await removeHomeworkQuestionAction(session.unitId, item.id);
                    if (result.error) setError(result.error);
                    else router.refresh();
                  })}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-rose-50 hover:text-rose-500"
                  title={t.lessonUnits.remove}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {exercise.kind === "question-audio" && (
              <a
                href="https://vocaroo.com"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent transition hover:brightness-95"
              >
                {t.interactiveHomework.recordOnVocaroo}
              </a>
            )}

            {exercise.kind === "question-audio" ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={drafts[item.id] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  onBlur={() => save(item)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    event.currentTarget.blur();
                  }}
                  placeholder="https://voca.ro/..."
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:border-accent"
                />
              </div>
            ) : (
              <div className="mt-2">
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                  onBlur={() => save(item)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    event.currentTarget.blur();
                  }}
                  placeholder={t.interactiveHomework.writeAnswer}
                  className="min-h-24 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-content outline-none transition focus:border-accent"
                />
              </div>
            )}
          </HomeworkItemShell>
        );
      })}

      {session.teacher && (exercise.kind === "question-text" || exercise.kind === "question-audio") && (
        <div className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/30 p-3">
          <textarea
            value={newQuestion}
            onChange={(event) => setNewQuestion(event.target.value)}
            placeholder={t.interactiveHomework.questionPlaceholder}
            className="min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || !newQuestion.trim()}
            onClick={addQuestion}
            className="mt-2 flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-black text-white disabled:opacity-40"
          >
            <IconPlus className="h-4 w-4" />
            {t.interactiveHomework.addQuestion}
          </button>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
    </div>
  );
}

function InlineHomeworkAnswer({
  item,
  value,
  state,
  feedback,
  disabled,
  placeholder,
  onChange,
  onCommit,
}: {
  item: HomeworkItem;
  value: string;
  state: HomeworkStoredState;
  feedback?: "wrong" | "right";
  disabled: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const status = homeworkStatus(state, item.id);
  const blankAt = item.prompt.indexOf("___");
  const before = blankAt >= 0 ? item.prompt.slice(0, blankAt) : item.prompt;
  const after = blankAt >= 0 ? item.prompt.slice(blankAt + 3) : "";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold leading-relaxed text-content">
      {before && <span>{before}</span>}
      <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
          placeholder={placeholder}
          className={cn(
            "h-9 w-56 max-w-full rounded-lg border bg-surface-2 px-3 text-sm font-bold text-content outline-none transition focus:border-accent disabled:cursor-default",
            feedback === "wrong" && "homework-error-flash",
            feedback === "right" && "homework-correct-pop",
            status === "correct"
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : status === "locked"
                ? "border-rose-500 bg-rose-50 text-rose-800"
                : "border-line",
          )}
        />
        <AttemptDots item={item} state={state} />
      </span>
      {after && <span>{after}</span>}
    </div>
  );
}

function AttemptDots({ item, state }: { item: HomeworkItem; state: HomeworkStoredState }) {
  const { t } = useT();
  const attempts = homeworkAttempts(state, item.id);
  const status = homeworkStatus(state, item.id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const successAt = status === "correct" ? Math.min(attempts.length, 2) : -1;

  return (
    <span className="relative inline-flex shrink-0 flex-col gap-1" aria-label={t.interactiveHomework.showAttempts}>
      {[0, 1, 2].map((at) => {
        const wrong = at < attempts.length;
        const correct = at === successAt;
        if (wrong) {
          return (
            <button
              key={at}
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              title={t.interactiveHomework.showAttempts}
              className="h-2 w-2 rounded-full bg-rose-500 ring-1 ring-rose-100 transition hover:scale-125"
            />
          );
        }
        return (
          <span
            key={at}
            className={cn(
              "h-2 w-2 rounded-full",
              correct ? "bg-emerald-500 ring-1 ring-emerald-100" : "bg-line",
            )}
          />
        );
      })}
      {historyOpen && attempts.length > 0 && (
        <span className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-surface p-3 text-left text-xs text-content shadow-xl ring-1 ring-line">
          <span className="block font-black text-faint">{t.interactiveHomework.wrongAttempts}</span>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            {attempts.map((attempt, at) => <li key={`${at}-${attempt}`}>{attempt}</li>)}
          </ol>
        </span>
      )}
    </span>
  );
}

function HomeworkItemShell({
  item,
  index,
  session,
  state,
  setState,
  showAnswers,
  children,
}: {
  item: HomeworkItem;
  index: number;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const status = homeworkStatus(state, item.id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(state[homeworkNoteKey(item.id)] ?? "");
  const [visible, setVisible] = useState(state[homeworkNoteVisibleKey(item.id)] === "1");
  const [busy, startBusy] = useTransition();
  const note = state[homeworkNoteKey(item.id)] ?? "";
  const noteVisible = state[homeworkNoteVisibleKey(item.id)] === "1";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-surface p-3 transition sm:p-4",
        status === "correct"
          ? "border-emerald-400"
          : status === "locked"
            ? "border-rose-500"
            : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-black text-faint">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {session.teacher && showAnswers && item.answer && (
        <div className="ml-10 mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
          <span className="font-black">{t.interactiveHomework.correctAnswer}:</span>{" "}
          <span className="font-semibold">{item.answer}</span>
        </div>
      )}

      {session.teacher && (
        <div className="ml-10 mt-3">
          <button
            type="button"
            onClick={() => setNoteOpen((open) => !open)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-accent hover:opacity-80"
          >
            <IconPencil className="h-3.5 w-3.5" />
            {note ? t.interactiveHomework.editNote : t.interactiveHomework.addNote}
          </button>
          {noteOpen && (
            <div className="mt-2 rounded-xl bg-accent-soft/50 p-3 ring-1 ring-accent/20">
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder={t.interactiveHomework.notePlaceholder}
                className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-content outline-none focus:border-accent"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-content">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) => setVisible(event.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {t.interactiveHomework.showNoteToStudent}
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    const result = await saveHomeworkTeacherNoteAction(
                      session.assignmentId,
                      item.id,
                      noteDraft,
                      visible,
                    );
                    if (result.error) return;
                    setState((current) => ({
                      ...current,
                      [homeworkNoteKey(item.id)]: noteDraft.trim(),
                      [homeworkNoteVisibleKey(item.id)]: noteDraft.trim() && visible ? "1" : "",
                    }));
                    setNoteOpen(false);
                  })}
                  className="flex h-9 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-black text-white disabled:opacity-50"
                >
                  <IconCheck className="h-3.5 w-3.5" /> {t.lessonUnits.save}
                </button>
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="flex h-9 items-center gap-1 rounded-xl bg-surface px-3 text-xs font-bold text-muted ring-1 ring-line"
                >
                  <IconX className="h-3.5 w-3.5" /> {t.common.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!session.teacher && note && noteVisible && (
        <details className="ml-10 mt-3 rounded-xl bg-accent-soft/60 p-3 ring-1 ring-accent/20">
          <summary className="cursor-pointer text-xs font-black text-accent">
            {t.interactiveHomework.teacherNote}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content">{note}</p>
        </details>
      )}
    </article>
  );
}
