"use client";

import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import {
  addHomeworkQuestionAction,
  assignInteractiveHomeworkAction,
  highlightHomeworkTextAction,
  removeHomeworkQuestionAction,
  returnInteractiveHomeworkForRevisionAction,
  reviewInteractiveHomeworkAction,
  resetHomeworkExerciseAnswersAction,
  shuffleHomeworkExerciseItemsAction,
  saveStudentHomeworkPlanAction,
  saveHomeworkResponseAction,
  saveHomeworkTeacherNoteAction,
  setHomeworkReactionAction,
  setHomeworkExerciseHiddenAction,
  submitInteractiveHomeworkForReviewAction,
  submitHomeworkAutoAnswerAction,
  translateHomeworkExerciseLanguageAction,
} from "@/lib/actions/lesson-homework";
import {
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkAssignedAt,
  homeworkAssignedAtKey,
  homeworkAssignedExerciseIds,
  homeworkAssignedExercisesKey,
  homeworkExerciseHidden,
  homeworkExerciseProgress,
  homeworkExerciseHiddenKey,
  homeworkExerciseFocusId,
  homeworkItemFocusId,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkReaction,
  homeworkStatus,
  homeworkStatusKey,
  homeworkSubmittedAt,
  homeworkSubmittedAtKey,
  homeworkReviewedAt,
  homeworkReviewedAtKey,
  homeworkRevisionRequestedAt,
  homeworkRevisionRequestedAtKey,
  homeworkTextHighlight,
  homeworkTextTokens,
  homeworkTranslationLanguage,
  homeworkValueKey,
  homeworkVoiceRecordingTarget,
  setHomeworkReaction,
  toggleHomeworkTextHighlight,
  type HomeworkHighlightColor,
  type HomeworkReaction,
  type HomeworkReactionTarget,
  type HomeworkTextHighlightSource,
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
  IconShuffle,
  IconTrash,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { StudentHomeworkExerciseEditor } from "@/components/lessons/student-homework-editor";
import { RegularVoiceRecorder } from "@/components/lessons/regular-voice-recorder";
import { HomeworkTeacherVoiceMessages } from "@/components/lessons/homework-teacher-voice-messages";

export type InteractiveHomeworkSession = {
  assignmentId: string;
  unitId: string;
  teacher: boolean;
  state: HomeworkStoredState;
  canAssign?: boolean;
  canEdit?: boolean;
};

type HomeworkInteractionContextValue = {
  reviewTools: boolean;
  highlightMode: boolean;
  highlightColor: HomeworkHighlightColor;
  busy: boolean;
  onHighlightText?: (
    item: HomeworkItem,
    source: HomeworkTextHighlightSource,
    tokenIndex: number,
  ) => void;
};

const HomeworkInteractionContext = createContext<HomeworkInteractionContextValue>({
  reviewTools: false,
  highlightMode: false,
  highlightColor: "yellow",
  busy: false,
});

export function InteractiveHomework({
  plan,
  session,
  onStateChange,
  focusId,
  onFocus,
  teacherReviewTools = false,
}: {
  plan: InteractiveHomeworkPlan;
  session: InteractiveHomeworkSession;
  onStateChange?: (state: HomeworkStoredState) => void;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
  teacherReviewTools?: boolean;
}) {
  const { t } = useT();
  const [state, setState] = useState(session.state);
  const [editedPlan, setEditedPlan] = useState<InteractiveHomeworkPlan | null>(null);
  const currentPlan = editedPlan ?? plan;
  const [editingExerciseId, setEditingExerciseId] = useState<string | null | undefined>(undefined);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, startDelete] = useTransition();
  const [showAnswers, setShowAnswers] = useState(false);
  const [reviewBusy, startReview] = useTransition();
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [revisionArmed, setRevisionArmed] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HomeworkHighlightColor>("yellow");
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [interactionBusy, startInteraction] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const progress = homeworkExerciseProgress(currentPlan, state);
  const submittedAt = homeworkSubmittedAt(state);
  const reviewedAt = homeworkReviewedAt(state);
  const revisionRequestedAt = homeworkRevisionRequestedAt(state);
  const assignedAt = homeworkAssignedAt(state);
  const exercises = currentPlan.exercises.filter(
    (exercise) => session.teacher || !homeworkExerciseHidden(state, exercise.id),
  );

  // Homework review has one explicit interaction tool: text highlighting.
  // Live lessons may still provide their own focus callback outside review.
  const interactWithElement = teacherReviewTools ? undefined : onFocus;

  const highlightText = teacherReviewTools && highlightMode
    ? (item: HomeworkItem, source: HomeworkTextHighlightSource, tokenIndex: number) => {
        setInteractionError(null);
        startInteraction(async () => {
          const result = await highlightHomeworkTextAction(
            session.assignmentId,
            item.id,
            source,
            tokenIndex,
            highlightColor,
          );
          if (result.error) {
            setInteractionError(result.error);
            return;
          }
          setState((current) =>
            toggleHomeworkTextHighlight(current, item, source, tokenIndex, highlightColor));
        });
      }
    : undefined;

  const translateExerciseLanguage = async (exerciseId: string, language: "RU" | "UK") => {
    const result = await translateHomeworkExerciseLanguageAction(
      session.assignmentId,
      exerciseId,
      language,
    );
    if (result.error || !result.plan || !result.state) {
      return result.error ?? t.interactiveHomework.translationFailed;
    }
    setEditedPlan(result.plan);
    setState(result.state);
  };

  const shuffleExercise = async (exerciseId: string) => {
    const result = await shuffleHomeworkExerciseItemsAction(
      session.assignmentId,
      exerciseId,
    );
    if (result.error || !result.plan || !result.state) {
      return result.error ?? t.interactiveHomework.shuffleFailed;
    }
    setEditedPlan(result.plan);
    setState(result.state);
  };

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  useEffect(() => {
    if (!focusId || !rootRef.current) return;
    const target = [...rootRef.current.querySelectorAll<HTMLElement>("[data-homework-focus]")]
      .find((node) => node.dataset.homeworkFocus === focusId);
    if (!target) return;
    const details = target.closest("details");
    if (details) details.open = true;
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId]);

  return (
    <HomeworkInteractionContext.Provider value={{
      reviewTools: teacherReviewTools,
      highlightMode,
      highlightColor,
      busy: interactionBusy,
      onHighlightText: highlightText,
    }}>
    <div ref={rootRef} className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent-soft via-surface to-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">
              {t.interactiveHomework.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black text-content">{currentPlan.title}</h2>
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
            {reviewedAt ? (
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                {t.interactiveHomework.reviewed}
              </span>
            ) : session.teacher && submittedAt ? (
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                {t.interactiveHomework.sentForReview}
              </span>
            ) : null}
            {revisionRequestedAt && !submittedAt && !reviewedAt && (
              <span className="rounded-xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 ring-1 ring-orange-200">
                {t.interactiveHomework.returnedForRevision}
              </span>
            )}
            {session.teacher && session.canEdit && (
              <button
                type="button"
                onClick={() => setEditingExerciseId(currentPlan.exercises[0]?.id ?? null)}
                className="flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-3 text-xs font-black text-accent ring-1 ring-accent/20 transition hover:bg-accent hover:text-white"
              >
                <IconPencil className="h-4 w-4" />
                {t.interactiveHomework.editHomework}
              </button>
            )}
            {session.teacher && teacherReviewTools && submittedAt && (
              <button
                type="button"
                disabled={reviewBusy || Boolean(reviewedAt)}
                onClick={() => {
                  setReviewError(null);
                  startReview(async () => {
                    const result = await reviewInteractiveHomeworkAction(session.assignmentId);
                    if (result.error || !result.reviewedAt) {
                      setReviewError(result.error ?? t.interactiveHomework.reviewFailed);
                      return;
                    }
                    setState((current) => ({
                      ...current,
                      [homeworkReviewedAtKey()]: result.reviewedAt!,
                    }));
                  });
                }}
                className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-default disabled:opacity-60"
              >
                <IconCheck className="h-4 w-4" />
                {reviewedAt
                  ? t.interactiveHomework.reviewed
                  : t.interactiveHomework.markReviewed}
              </button>
            )}
            {session.teacher && teacherReviewTools && (submittedAt || reviewedAt) && (
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => {
                  if (!revisionArmed) {
                    setRevisionArmed(true);
                    return;
                  }
                  setReviewError(null);
                  startReview(async () => {
                    const result = await returnInteractiveHomeworkForRevisionAction(session.assignmentId);
                    if (result.error || !result.state) {
                      setReviewError(result.error ?? t.interactiveHomework.revisionFailed);
                      return;
                    }
                    setRevisionArmed(false);
                    setState(result.state);
                  });
                }}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:opacity-50",
                  revisionArmed
                    ? "bg-orange-500 text-white shadow-sm hover:bg-orange-600"
                    : "bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100",
                )}
              >
                <span aria-hidden>↩</span>
                {revisionArmed
                  ? t.interactiveHomework.confirmRevision
                  : t.interactiveHomework.sendToRevision}
              </button>
            )}
            <div className="rounded-xl bg-surface px-3 py-2 text-right ring-1 ring-line">
              <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                {t.interactiveHomework.exercisesProgress}
              </p>
              <p className="text-lg font-black text-accent">
                {progress.required.done}/{progress.required.total}
              </p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-2 text-right ring-1 ring-line">
              <p className="text-[10px] font-bold uppercase tracking-wide text-faint">
                {t.interactiveHomework.bonusesProgress}
              </p>
              <p className="text-lg font-black text-accent">
                {progress.bonuses.done}/{progress.bonuses.total}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${progress.required.total ? (progress.required.done / progress.required.total) * 100 : 0}%` }}
          />
        </div>
        {reviewError && (
          <p className="mt-3 text-xs font-bold text-rose-600">{reviewError}</p>
        )}
      </section>

      <HomeworkTeacherVoiceMessages
        assignmentId={session.assignmentId}
        teacher={session.teacher && teacherReviewTools}
        state={state}
        onStateChange={setState}
      />

      {session.teacher && teacherReviewTools && (
        <div className="sticky top-20 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/95 px-3 py-2 shadow-lg backdrop-blur-md">
          <span className="mr-auto text-[12px] font-semibold text-muted">
            {highlightMode
              ? t.interactiveHomework.reviewHighlightHint
              : t.interactiveHomework.reviewHighlightOffHint}
          </span>
          <button
            type="button"
            onClick={() => setHighlightMode((enabled) => !enabled)}
            aria-pressed={highlightMode}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold ring-1 transition",
              highlightMode
                ? "bg-yellow-300 text-slate-950 ring-yellow-500 shadow-sm"
                : "bg-surface text-muted ring-line hover:text-content hover:ring-accent/50",
            )}
          >
            <span aria-hidden>🖍️</span>
            {t.interactiveHomework.highlightToggle}
          </button>
          <div className={cn(
            "flex items-center gap-1 rounded-lg bg-surface p-1 ring-1 ring-line transition",
            !highlightMode && "opacity-45",
          )}>
            {(["yellow", "green", "red"] as const).map((color) => (
              <button
                key={color}
                type="button"
                disabled={!highlightMode}
                onClick={() => setHighlightColor(color)}
                aria-pressed={highlightMode && highlightColor === color}
                aria-label={color === "yellow"
                  ? t.lessonUnits.highlightYellow
                  : color === "green"
                    ? t.lessonUnits.highlightGreen
                    : t.interactiveHomework.highlightRed}
                title={color === "yellow"
                  ? t.lessonUnits.highlightYellow
                  : color === "green"
                    ? t.lessonUnits.highlightGreen
                    : t.interactiveHomework.highlightRed}
                className={cn(
                  "h-5 w-5 rounded-full transition enabled:hover:scale-110 disabled:cursor-default",
                  color === "yellow"
                    ? "bg-yellow-300"
                    : color === "green"
                      ? "bg-emerald-400"
                      : "bg-rose-500",
                  highlightMode && highlightColor === color
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                    : "ring-1 ring-black/10",
                )}
              />
            ))}
          </div>
          {interactionError && (
            <p className="basis-full text-[11px] font-semibold text-rose-500">{interactionError}</p>
          )}
        </div>
      )}

      {session.teacher && session.canAssign && (
        <HomeworkAssignmentPanel
          key={`${currentPlan.exercises.map((exercise) => exercise.id).join(":")}:${homeworkAssignedAt(state) ?? "draft"}:${homeworkAssignedExercisesKey() in state ? state[homeworkAssignedExercisesKey()] : ""}`}
          plan={currentPlan}
          assignmentId={session.assignmentId}
          state={state}
          onAssigned={(assigned, exerciseIds) => {
            setState((current) => {
              const next = {
                ...current,
                [homeworkAssignedAtKey()]: assigned,
                [homeworkAssignedExercisesKey()]: JSON.stringify(exerciseIds),
              };
              delete next[homeworkSubmittedAtKey()];
              delete next[homeworkReviewedAtKey()];
              delete next[homeworkRevisionRequestedAtKey()];
              return next;
            });
          }}
        />
      )}

      {exercises.map((exercise, index) => (
        <HomeworkExerciseView
          key={JSON.stringify(exercise)}
          exercise={exercise}
          number={exercises.slice(0, index + 1).filter((item) => !item.optional).length}
          session={session}
          state={state}
          setState={setState}
          showAnswers={showAnswers}
          focusId={focusId}
          onFocus={interactWithElement}
          onEdit={session.canEdit ? () => setEditingExerciseId(exercise.id) : undefined}
          onDelete={session.canEdit ? () => {
            setDeleteError(null);
            setDeletingExerciseId(exercise.id);
          } : undefined}
          onShuffle={session.teacher && exercise.items.length > 1
            ? () => shuffleExercise(exercise.id)
            : undefined}
          onTranslateLanguage={session.teacher && exercise.kind === "translate"
            ? (language) => translateExerciseLanguage(exercise.id, language)
            : undefined}
        />
      ))}

      {session.teacher && session.canEdit && (
        <button
          type="button"
          onClick={() => setEditingExerciseId(null)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/45 bg-accent-soft/40 px-4 text-sm font-black text-accent transition hover:bg-accent-soft"
        >
          <IconPlus className="h-4 w-4" />
          {t.interactiveHomework.addExercise}
        </button>
      )}

      {!session.teacher && assignedAt && (
        <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
          <button
            type="button"
            disabled={reviewBusy || Boolean(submittedAt)}
            onClick={() => startReview(async () => {
              const result = await submitInteractiveHomeworkForReviewAction(session.assignmentId);
              if (result.error || !result.submittedAt) return;
              setState((current) => ({
                ...current,
                [homeworkSubmittedAtKey()]: result.submittedAt!,
              }));
            })}
            className="min-h-12 rounded-2xl bg-accent px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-95 disabled:translate-y-0 disabled:opacity-60"
          >
            {submittedAt
              ? reviewedAt
                ? t.interactiveHomework.reviewed
                : t.interactiveHomework.sentForReview
              : t.interactiveHomework.sendForReview}
          </button>
        </div>
      )}

      {session.teacher && session.canEdit && editingExerciseId !== undefined && (
        <StudentHomeworkExerciseEditor
          assignmentId={session.assignmentId}
          plan={currentPlan}
          exerciseId={editingExerciseId}
          onClose={() => setEditingExerciseId(undefined)}
          onSaved={(nextPlan, nextState) => {
            setEditedPlan(nextPlan);
            setState(nextState);
          }}
        />
      )}
      {session.teacher && session.canEdit && deletingExerciseId && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <section className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:rounded-3xl">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <IconTrash className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-content">
                  {t.interactiveHomework.deleteExercise}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {t.interactiveHomework.confirmDeleteExercise}
                </p>
              </div>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeletingExerciseId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-content"
                aria-label={t.interactiveHomework.cancel}
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            {deleteError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeletingExerciseId(null)}
                className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-content disabled:opacity-50"
              >
                {t.interactiveHomework.cancel}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => startDelete(async () => {
                  const result = await saveStudentHomeworkPlanAction(session.assignmentId, {
                    ...currentPlan,
                    exercises: currentPlan.exercises.filter(
                      (exercise) => exercise.id !== deletingExerciseId,
                    ),
                  });
                  if (result.error || !result.plan || !result.state) {
                    setDeleteError(result.error ?? t.interactiveHomework.assignmentFailed);
                    return;
                  }
                  setEditedPlan(result.plan);
                  setState(result.state);
                  setDeletingExerciseId(null);
                })}
                className="h-11 rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {t.interactiveHomework.confirmDelete}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
    </HomeworkInteractionContext.Provider>
  );
}

function HomeworkAssignmentPanel({
  plan,
  assignmentId,
  state,
  onAssigned,
}: {
  plan: InteractiveHomeworkPlan;
  assignmentId: string;
  state: HomeworkStoredState;
  onAssigned: (assignedAt: string, exerciseIds: string[]) => void;
}) {
  const { t } = useT();
  const assignedAt = homeworkAssignedAt(state);
  const assignedIds = homeworkAssignedExerciseIds(plan, state);
  const [selected, setSelected] = useState<string[]>(
    assignedIds.length > 0 ? assignedIds : plan.exercises.map((exercise) => exercise.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, startAssign] = useTransition();
  const exerciseGroups = useMemo(() => {
    const groups: Array<{ exercise: HomeworkExercise; bonuses: HomeworkExercise[] }> = [];
    for (const exercise of plan.exercises) {
      const current = groups.at(-1);
      if (exercise.optional && current) {
        current.bonuses.push(exercise);
      } else {
        groups.push({ exercise, bonuses: [] });
      }
    }
    return groups;
  }, [plan.exercises]);

  const exerciseType = (exercise: HomeworkExercise) =>
    exercise.kind === "describe"
      ? t.interactiveHomework.typeDescribe
      : exercise.kind === "translate"
        ? t.interactiveHomework.typeTranslate
        : exercise.kind === "question-text" || exercise.kind === "question-audio"
          ? t.interactiveHomework.typeQuestions
          : t.interactiveHomework.typeFill;

  const bonusTitle = (exercise: HomeworkExercise) =>
    exercise.title.match(/(?:^|[—–-]\s*)(Bonus\b.*)$/i)?.[1] ?? exercise.title;

  const toggle = (exerciseId: string) => {
    setError(null);
    setSelected((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  };

  return (
    <section className="rounded-2xl border border-accent/25 bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-content">
              {t.interactiveHomework.assignmentTitle}
            </h3>
            {assignedAt && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                {t.interactiveHomework.assigned}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{t.interactiveHomework.assignmentHint}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (selected.length === 0) {
              setError(t.interactiveHomework.selectAtLeastOne);
              return;
            }
            startAssign(async () => {
              const result = await assignInteractiveHomeworkAction(assignmentId, selected);
              if (result.error || !result.assignedAt || !result.exerciseIds) {
                setError(result.error ?? t.interactiveHomework.assignmentFailed);
                return;
              }
              setError(null);
              onAssigned(result.assignedAt, result.exerciseIds);
            });
          }}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
        >
          {busy
            ? t.interactiveHomework.assigning
            : assignedAt
              ? t.interactiveHomework.updateAssignment
              : t.interactiveHomework.assignHomework}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {exerciseGroups.map(({ exercise, bonuses }, index) => {
          const checked = selected.includes(exercise.id);
          return (
            <div
              key={exercise.id}
              className={cn(
                "overflow-hidden rounded-2xl border transition",
                checked
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line bg-canvas hover:border-accent/25",
              )}
            >
              <label className="flex cursor-pointer items-center gap-3 p-3.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(exercise.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-sm font-black text-accent ring-1 ring-accent/20">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-content">
                    {exercise.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-bold text-muted">
                    {exerciseType(exercise)}
                  </span>
                </span>
              </label>

              {bonuses.length > 0 && (
                <div className="border-t border-accent/15 bg-surface/70 px-3.5 py-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-accent">
                    {t.interactiveHomework.bonusesProgress}
                  </p>
                  <div className="flex flex-col gap-2">
                    {bonuses.map((bonus) => {
                      const bonusChecked = selected.includes(bonus.id);
                      return (
                        <label
                          key={bonus.id}
                          className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-content"
                        >
                          <input
                            type="checkbox"
                            checked={bonusChecked}
                            onChange={() => toggle(bonus.id)}
                            className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                          />
                          <span className="min-w-0 truncate">{bonusTitle(bonus)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
    </section>
  );
}

function HomeworkExerciseView({
  exercise,
  number,
  session,
  state,
  setState,
  showAnswers,
  focusId,
  onFocus,
  onEdit,
  onDelete,
  onShuffle,
  onTranslateLanguage,
}: {
  exercise: HomeworkExercise;
  number: number;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShuffle?: () => Promise<string | undefined>;
  onTranslateLanguage?: (language: "RU" | "UK") => Promise<string | undefined>;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
  const [resetKey, setResetKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, startAction] = useTransition();
  const hidden = homeworkExerciseHidden(state, exercise.id);
  const exerciseFocusId = homeworkExerciseFocusId(exercise.id);
  const translationLanguage = exercise.kind === "translate"
    ? homeworkTranslationLanguage(exercise)
    : null;
  const switchLanguage = (language: "RU" | "UK") => {
    if (!onTranslateLanguage || language === translationLanguage) return;
    setActionError(null);
    startAction(async () => {
      const error = await onTranslateLanguage(language);
      if (error) setActionError(error);
      else setResetKey((key) => key + 1);
    });
  };
  const shuffleItems = () => {
    if (!onShuffle) return;
    setActionError(null);
    startAction(async () => {
      const error = await onShuffle();
      if (error) setActionError(error);
      else setResetKey((key) => key + 1);
    });
  };
  const fallbackInstruction =
    exercise.kind === "fill"
      ? t.interactiveHomework.instructions.fill
      : exercise.kind === "definition"
        ? t.interactiveHomework.instructions.definition
        : exercise.kind === "describe"
          ? t.interactiveHomework.instructions.describe
          : exercise.kind === "drag"
            ? t.interactiveHomework.instructions.drag
            : exercise.kind === "translate"
              ? exercise.translationDirection === "from-english"
                ? t.interactiveHomework.instructions.translateFromEnglish
                : t.interactiveHomework.instructions.translate
              : exercise.kind === "question-audio"
                ? t.interactiveHomework.instructions.questionAudio
                : t.interactiveHomework.instructions.questionText;
  const instruction = exercise.instruction.trim() || fallbackInstruction;
  const body = (
    <div className="mt-4">
      {actionError && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
          {actionError}
        </p>
      )}
      {exercise.wordBank && exercise.wordBank.length > 0 && exercise.kind !== "drag" && exercise.kind !== "describe" && (
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
        focusId={focusId}
        onFocus={onFocus}
      />
    </div>
  );

  const reset = () => startAction(async () => {
    const result = await resetHomeworkExerciseAnswersAction(session.assignmentId, exercise.id);
    if (result.error) return;
    setState((current) => clearExerciseAnswers(current, exercise, !session.teacher));
    setResetKey((key) => key + 1);
  });

  const toggleHidden = () => startAction(async () => {
    const result = await setHomeworkExerciseHiddenAction(session.assignmentId, exercise.id, !hidden);
    if (result.error) return;
    setState((current) => {
      const updated = { ...current };
      const key = homeworkExerciseHiddenKey(exercise.id);
      if (hidden) delete updated[key];
      else updated[key] = "1";
      return updated;
    });
  });

  if (exercise.optional) {
    return (
      <section className={cn(
        "flex items-start gap-2 rounded-2xl border border-dashed border-accent/35 bg-surface p-4 shadow-sm",
        hidden && "border-faint/40 opacity-70",
        focusId === exerciseFocusId && "border-accent ring-2 ring-accent/40",
      )}>
        <details data-homework-focus={exerciseFocusId} className="group min-w-0 flex-1">
          <summary className="flex min-w-0 flex-1 cursor-pointer list-none items-center gap-3">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
              {t.interactiveHomework.bonus}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold text-content">{exercise.title}</span>
            {hidden && (
              <span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-bold text-faint">
                {t.interactiveHomework.hiddenFromStudent}
              </span>
            )}
            <IconChevronDown className="h-4 w-4 text-faint transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{instruction}</p>
          {body}
        </details>
        {onTranslateLanguage && translationLanguage && (
          <HomeworkTranslationLanguageToggle
            language={translationLanguage}
            busy={busy}
            onChange={switchLanguage}
          />
        )}
        <HomeworkReactionControl
          target="exercise"
          targetId={exercise.id}
          session={session}
          state={state}
          setState={setState}
        />
        {onShuffle && (
          <button
            type="button"
            disabled={busy}
            onClick={shuffleItems}
            title={t.interactiveHomework.shuffleExercise}
            aria-label={t.interactiveHomework.shuffleExercise}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[11px] font-black text-accent transition hover:bg-accent hover:text-white disabled:opacity-45"
          >
            <IconShuffle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.interactiveHomework.shuffle}</span>
          </button>
        )}
        {session.teacher && onFocus && !interaction.highlightMode && (
          <button
            type="button"
            disabled={interaction.busy}
            onClick={() => onFocus(exerciseFocusId)}
            title={t.lessonUnits.focusElement}
            aria-label={t.lessonUnits.focusElement}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft disabled:opacity-45"
          >
            <IconEye className="h-4 w-4" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title={t.interactiveHomework.editExercise}
            aria-label={t.interactiveHomework.editExercise}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft"
          >
            <IconPencil className="h-4 w-4" />
          </button>
        )}
        <ExerciseOptionsMenu
          busy={busy}
          teacher={session.teacher}
          hidden={hidden}
          onReset={reset}
          onToggleHidden={toggleHidden}
          onDelete={onDelete}
        />
      </section>
    );
  }

  return (
    <section className={cn(
      "rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5",
      hidden && "opacity-70 ring-faint/40",
      focusId === exerciseFocusId && "ring-2 ring-accent",
    )}>
      <div data-homework-focus={exerciseFocusId} className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-black text-white">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-content">{exercise.title}</h3>
            {hidden && (
              <span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-bold text-faint">
                {t.interactiveHomework.hiddenFromStudent}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{instruction}</p>
        </div>
        {onTranslateLanguage && translationLanguage && (
          <HomeworkTranslationLanguageToggle
            language={translationLanguage}
            busy={busy}
            onChange={switchLanguage}
          />
        )}
        <HomeworkReactionControl
          target="exercise"
          targetId={exercise.id}
          session={session}
          state={state}
          setState={setState}
        />
        {onShuffle && (
          <button
            type="button"
            disabled={busy}
            onClick={shuffleItems}
            title={t.interactiveHomework.shuffleExercise}
            aria-label={t.interactiveHomework.shuffleExercise}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[11px] font-black text-accent transition hover:bg-accent hover:text-white disabled:opacity-45"
          >
            <IconShuffle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.interactiveHomework.shuffle}</span>
          </button>
        )}
        {session.teacher && onFocus && !interaction.highlightMode && (
          <button
            type="button"
            disabled={interaction.busy}
            onClick={() => onFocus(exerciseFocusId)}
            title={t.lessonUnits.focusElement}
            aria-label={t.lessonUnits.focusElement}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft disabled:opacity-45"
          >
            <IconEye className="h-4 w-4" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title={t.interactiveHomework.editExercise}
            aria-label={t.interactiveHomework.editExercise}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft"
          >
            <IconPencil className="h-4 w-4" />
          </button>
        )}
        <ExerciseOptionsMenu
          busy={busy}
          teacher={session.teacher}
          hidden={hidden}
          onReset={reset}
          onToggleHidden={toggleHidden}
          onDelete={onDelete}
        />
      </div>
      {body}
    </section>
  );
}

function HomeworkTranslationLanguageToggle({
  language,
  busy,
  onChange,
}: {
  language: "RU" | "UK";
  busy: boolean;
  onChange: (language: "RU" | "UK") => void;
}) {
  const { t } = useT();
  return (
    <div
      className="flex shrink-0 rounded-lg bg-surface-2 p-0.5 ring-1 ring-line"
      title={`DeepL · ${t.interactiveHomework.translationLanguage}`}
    >
      {(["UK", "RU"] as const).map((value) => (
        <button
          key={value}
          type="button"
          disabled={busy || value === language}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onChange(value);
          }}
          className={cn(
            "h-7 rounded-md px-2 text-[10px] font-black transition disabled:cursor-default",
            value === language
              ? "bg-accent text-white"
              : "text-muted hover:text-accent disabled:opacity-55",
          )}
        >
          {value === "UK" ? "UA" : "RU"}
        </button>
      ))}
    </div>
  );
}

function clearExerciseAnswers(
  state: HomeworkStoredState,
  exercise: HomeworkExercise,
  markAsDraft: boolean,
) {
  const updated = { ...state };
  for (const item of exercise.items) {
    delete updated[homeworkValueKey(item.id)];
    delete updated[homeworkStatusKey(item.id)];
    delete updated[homeworkAttemptsKey(item.id)];
  }
  if (markAsDraft) {
    delete updated[homeworkSubmittedAtKey()];
    delete updated[homeworkReviewedAtKey()];
  }
  return updated;
}

function ExerciseOptionsMenu({
  busy,
  teacher,
  hidden,
  onReset,
  onToggleHidden,
  onDelete,
}: {
  busy: boolean;
  teacher: boolean;
  hidden: boolean;
  onReset: () => void;
  onToggleHidden: () => void;
  onDelete?: () => void;
}) {
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
        {teacher && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              onToggleHidden();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-content transition hover:bg-surface-2 disabled:opacity-50"
          >
            {hidden ? <IconEye className="h-3.5 w-3.5" /> : <IconEyeOff className="h-3.5 w-3.5" />}
            {hidden
              ? t.interactiveHomework.showExercise
              : t.interactiveHomework.hideExercise}
          </button>
        )}
        {teacher && onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <IconTrash className="h-3.5 w-3.5" />
            {t.interactiveHomework.deleteExercise}
          </button>
        )}
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
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
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
  focusId,
  onFocus,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
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
        if (!session.teacher) {
          delete updated[homeworkSubmittedAtKey()];
          delete updated[homeworkReviewedAtKey()];
        }
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
            focusId={focusId}
            onFocus={onFocus}
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
  focusId,
  onFocus,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
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
        if (!session.teacher) {
          delete updated[homeworkSubmittedAtKey()];
          delete updated[homeworkReviewedAtKey()];
        }
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
          const blankAt = item.prompt.indexOf("___");
          const before = blankAt >= 0 ? item.prompt.slice(0, blankAt) : item.prompt;
          const after = blankAt >= 0 ? item.prompt.slice(blankAt + 3) : "";
          const showAsText = interaction.reviewTools || Boolean(homeworkReviewedAt(state));
          return (
            <HomeworkItemShell
              key={item.id}
              item={item}
              index={index}
              session={session}
              state={state}
              setState={setState}
              showAnswers={showAnswers}
              focusId={focusId}
              onFocus={onFocus}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold leading-relaxed text-content">
                {before && (
                  <HomeworkHighlightableText
                    item={item}
                    source="prompt-before"
                    text={before}
                    state={state}
                  />
                )}
                <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
                  {showAsText ? (
                    <span className={cn(
                      "min-h-9 w-56 max-w-full rounded-lg border-2 border-dashed px-3 py-1.5 text-left text-sm font-bold",
                      status === "correct"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : status === "locked"
                          ? "border-rose-500 bg-rose-50 text-rose-800"
                          : "border-line bg-surface-2 text-faint",
                    )}>
                      {value ? (
                        <HomeworkHighlightableText
                          item={item}
                          source="answer"
                          text={value}
                          state={state}
                        />
                      ) : t.interactiveHomework.noAnswer}
                    </span>
                  ) : (
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
                  )}
                  <AttemptDots item={item} state={state} />
                </span>
                {after && (
                  <HomeworkHighlightableText
                    item={item}
                    source="prompt-after"
                    text={after}
                    state={state}
                  />
                )}
              </div>
              {item.hint && (
                <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {item.hint}
                </span>
              )}
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
  focusId,
  onFocus,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const interaction = useContext(HomeworkInteractionContext);
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
      setState((current) => {
        const updated = { ...current, [homeworkValueKey(item.id)]: value.trim() };
        if (!session.teacher) {
          delete updated[homeworkSubmittedAtKey()];
          delete updated[homeworkReviewedAtKey()];
        }
        return updated;
      });
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
            focusId={focusId}
            onFocus={onFocus}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {item.questionAudioUrl && (
                  <div className="mb-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line" data-no-lesson-highlight>
                    <audio
                      controls
                      preload="metadata"
                      src={item.questionAudioUrl}
                      aria-label={item.prompt}
                      className="w-full"
                    />
                  </div>
                )}
                {item.word && exercise.kind !== "translate" && (
                  <p className="mb-1 text-sm font-black text-accent">
                    <HomeworkHighlightableText
                      item={item}
                      source="word"
                      text={item.word}
                      state={state}
                    />
                  </p>
                )}
                {exercise.kind !== "describe" && (
                  <p className="text-sm font-semibold leading-relaxed text-content">
                    <HomeworkHighlightableText
                      item={item}
                      source="prompt"
                      text={item.prompt}
                      state={state}
                    />
                  </p>
                )}
                {item.hint && exercise.kind !== "translate" && exercise.kind !== "describe" && (
                  <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {item.hint}
                  </span>
                )}
              </div>
              {session.teacher && !session.canEdit && (exercise.kind === "question-text" || exercise.kind === "question-audio") && (
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

            {exercise.kind === "question-audio" ? (
              <RegularVoiceRecorder
                assignmentId={session.assignmentId}
                sectionId={homeworkVoiceRecordingTarget(item.id)}
                exercise={{ instruction: "", prompts: [item.prompt], maxSeconds: 600 }}
                teacher={session.teacher}
                state={state}
                onStateChange={setState}
                compact
              />
            ) : (
              <div className="mt-2">
                {interaction.reviewTools || homeworkReviewedAt(state) ? (
                  <div className="min-h-24 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-content">
                    {(drafts[item.id] ?? "") ? (
                      <HomeworkHighlightableText
                        item={item}
                        source="answer"
                        text={drafts[item.id] ?? ""}
                        state={state}
                      />
                    ) : (
                      <span className="text-faint">{t.interactiveHomework.noAnswer}</span>
                    )}
                  </div>
                ) : (
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
                )}
              </div>
            )}
          </HomeworkItemShell>
        );
      })}

      {session.teacher && !session.canEdit && (exercise.kind === "question-text" || exercise.kind === "question-audio") && (
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

function HomeworkHighlightableText({
  item,
  source,
  text,
  state,
  className,
}: {
  item: HomeworkItem;
  source: HomeworkTextHighlightSource;
  text: string;
  state: HomeworkStoredState;
  className?: string;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
  const tokens = homeworkTextTokens(text);
  const canHighlight = interaction.reviewTools && interaction.highlightMode && interaction.onHighlightText;

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {tokens.map((token, tokenIndex) => {
        const color = homeworkTextHighlight(state, item.id, source, tokenIndex);
        const colorClass = color === "yellow"
          ? "bg-yellow-300 text-slate-950"
          : color === "green"
            ? "bg-emerald-300 text-emerald-950"
            : color === "red"
              ? "bg-rose-400 text-white"
              : "";
        if (!token.highlightable || !canHighlight) {
          return (
            <span key={`${source}-${tokenIndex}`} className={cn("rounded-sm", colorClass)}>
              {token.text}
            </span>
          );
        }
        return (
          <button
            key={`${source}-${tokenIndex}`}
            type="button"
            disabled={interaction.busy}
            onClick={() => interaction.onHighlightText?.(item, source, tokenIndex)}
            title={t.interactiveHomework.highlightWord}
            className={cn(
              "rounded-sm px-0.5 font-[inherit] transition hover:bg-accent-soft disabled:opacity-60",
              colorClass,
            )}
          >
            {token.text}
          </button>
        );
      })}
    </span>
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
  const interaction = useContext(HomeworkInteractionContext);
  const status = homeworkStatus(state, item.id);
  const reviewed = Boolean(homeworkReviewedAt(state));
  const showAsText = interaction.reviewTools || reviewed;
  const blankAt = item.prompt.indexOf("___");
  const before = blankAt >= 0 ? item.prompt.slice(0, blankAt) : item.prompt;
  const after = blankAt >= 0 ? item.prompt.slice(blankAt + 3) : "";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold leading-relaxed text-content">
      {before && (
        <HomeworkHighlightableText
          item={item}
          source="prompt-before"
          text={before}
          state={state}
        />
      )}
      <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
        {showAsText ? (
          <span className={cn(
            "min-h-9 w-56 max-w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm font-bold",
            status === "correct"
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : status === "locked"
                ? "border-rose-500 bg-rose-50 text-rose-800"
                : "border-line text-content",
          )}>
            {value ? (
              <HomeworkHighlightableText
                item={item}
                source="answer"
                text={value}
                state={state}
              />
            ) : (
              <span className="text-faint">{placeholder}</span>
            )}
          </span>
        ) : (
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
        )}
        <AttemptDots item={item} state={state} />
      </span>
      {after && (
        <HomeworkHighlightableText
          item={item}
          source="prompt-after"
          text={after}
          state={state}
        />
      )}
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

const HOMEWORK_REACTIONS: HomeworkReaction[] = [
  "thumbs-up",
  "happy",
  "angry",
  "check",
  "warning",
  "cross",
];

function HomeworkReactionControl({
  target,
  targetId,
  session,
  state,
  setState,
}: {
  target: HomeworkReactionTarget;
  targetId: string;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
  const [open, setOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = homeworkReaction(state, target, targetId);
  const editable = session.teacher && interaction.reviewTools;
  const label = (reaction: HomeworkReaction) => {
    if (reaction === "thumbs-up") return t.interactiveHomework.reactionThumbsUp;
    if (reaction === "happy") return t.interactiveHomework.reactionHappy;
    if (reaction === "angry") return t.interactiveHomework.reactionAngry;
    if (reaction === "check") return t.interactiveHomework.reactionCheck;
    if (reaction === "warning") return t.interactiveHomework.reactionWarning;
    return t.interactiveHomework.reactionCross;
  };

  if (!editable && !current) return null;

  return (
    <div className="relative shrink-0">
      {editable ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
          title={current ? label(current) : t.interactiveHomework.addReaction}
          aria-label={current ? label(current) : t.interactiveHomework.addReaction}
          aria-expanded={open}
          className={cn(
            "flex h-8 min-w-8 items-center justify-center rounded-lg transition hover:bg-accent-soft disabled:opacity-50",
            current ? "bg-surface-2 ring-1 ring-line" : "text-faint",
          )}
        >
          {current
            ? <HomeworkReactionBadge reaction={current} label={label(current)} compact />
            : <span className="text-base leading-none">🙂</span>}
        </button>
      ) : (
        <HomeworkReactionBadge reaction={current!} label={label(current!)} />
      )}

      {editable && open && (
        <div className="absolute right-0 top-10 z-40 w-56 rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-line">
          <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-wide text-faint">
            {t.interactiveHomework.chooseReaction}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {HOMEWORK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  startBusy(async () => {
                    const result = await setHomeworkReactionAction(
                      session.assignmentId,
                      target,
                      targetId,
                      reaction,
                    );
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    const nextReaction = result.reaction ?? null;
                    setState((value) =>
                      setHomeworkReaction(value, target, targetId, nextReaction));
                    setOpen(false);
                  });
                }}
                aria-label={label(reaction)}
                aria-pressed={current === reaction}
                title={current === reaction
                  ? t.interactiveHomework.removeReaction
                  : label(reaction)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl transition hover:bg-surface-2 disabled:opacity-50",
                  current === reaction && "bg-accent-soft ring-1 ring-accent/30",
                )}
              >
                <HomeworkReactionBadge reaction={reaction} label={label(reaction)} />
              </button>
            ))}
          </div>
          {error && (
            <p className="px-2 pt-2 text-[10px] font-bold text-rose-600">
              {t.interactiveHomework.reactionFailed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HomeworkReactionBadge({
  reaction,
  label,
  compact = false,
}: {
  reaction: HomeworkReaction;
  label: string;
  compact?: boolean;
}) {
  const symbol = reaction === "thumbs-up"
    ? "👍"
    : reaction === "happy"
      ? "😊"
      : reaction === "angry"
        ? "😠"
        : reaction === "check"
          ? "✓"
          : reaction === "warning"
            ? "!"
            : "✕";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center font-black leading-none",
        compact ? "h-6 w-6 text-base" : "h-8 w-8 text-lg",
        reaction === "thumbs-up" && "rounded-full bg-sky-100",
        reaction === "happy" && "rounded-full bg-amber-100",
        reaction === "angry" && "rounded-full bg-orange-100",
        reaction === "check" && "rounded-full bg-emerald-500 text-white",
        reaction === "warning" && "rounded-full bg-yellow-300 text-yellow-950",
        reaction === "cross" && "rounded-full bg-rose-500 text-white",
      )}
    >
      {symbol}
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
  focusId,
  onFocus,
  children,
}: {
  item: HomeworkItem;
  index: number;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
  showAnswers: boolean;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
  const status = homeworkStatus(state, item.id);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(state[homeworkNoteKey(item.id)] ?? "");
  const [visible, setVisible] = useState(state[homeworkNoteVisibleKey(item.id)] === "1");
  const [busy, startBusy] = useTransition();
  const note = state[homeworkNoteKey(item.id)] ?? "";
  const noteVisible = state[homeworkNoteVisibleKey(item.id)] === "1";
  const itemFocusId = homeworkItemFocusId(item.id);

  return (
    <article
      data-homework-focus={itemFocusId}
      className={cn(
        "rounded-2xl border bg-surface p-3 transition sm:p-4",
        status === "correct"
          ? "border-emerald-400"
          : status === "locked"
            ? "border-rose-500"
            : "border-line",
        focusId === itemFocusId && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-black text-faint">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
        <HomeworkReactionControl
          target="item"
          targetId={item.id}
          session={session}
          state={state}
          setState={setState}
        />
        {session.teacher && onFocus && !interaction.highlightMode && (
          <button
            type="button"
            disabled={interaction.busy}
            onClick={() => onFocus(itemFocusId)}
            title={t.lessonUnits.focusElement}
            aria-label={t.lessonUnits.focusElement}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft disabled:opacity-45"
          >
            <IconEye className="h-4 w-4" />
          </button>
        )}
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
