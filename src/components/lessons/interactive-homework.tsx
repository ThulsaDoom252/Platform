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
  clearHomeworkReactionsAction,
  highlightHomeworkTextRangeAction,
  homeworkReviewStateAction,
  removeHomeworkQuestionAction,
  returnInteractiveHomeworkForRevisionAction,
  reviewInteractiveHomeworkAction,
  resetHomeworkExerciseAnswersAction,
  shuffleHomeworkExerciseItemsAction,
  saveStudentHomeworkPlanAction,
  saveHomeworkResponseAction,
  saveHomeworkExerciseGradeAction,
  saveHomeworkTeacherNoteAction,
  setHomeworkReactionAction,
  setHomeworkExerciseHiddenAction,
  submitInteractiveHomeworkForReviewAction,
  submitHomeworkAutoAnswerAction,
  translateHomeworkExerciseLanguageAction,
} from "@/lib/actions/lesson-homework";
import {
  clearHomeworkTextHighlights,
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkAssignedAt,
  homeworkAssignedAtKey,
  homeworkAssignedExerciseIds,
  homeworkAssignedExercisesKey,
  homeworkExerciseHidden,
  homeworkExerciseComment,
  homeworkExerciseNeedsTeacherScore,
  homeworkExerciseScore,
  homeworkExerciseTeacherScore,
  homeworkGradeLabel,
  homeworkExerciseProgress,
  homeworkExerciseHiddenKey,
  homeworkExerciseFocusId,
  homeworkItemFocusId,
  homeworkNoteKey,
  homeworkNoteVisibleKey,
  homeworkReaction,
  homeworkReactionColor,
  homeworkHasReactions,
  mergeHomeworkReactions,
  homeworkRemainingWordBank,
  homeworkStatus,
  homeworkStatusKey,
  homeworkOverallScore,
  homeworkStateAfterTeacherAutoAnswerEdit,
  homeworkSubmittedAt,
  homeworkSubmittedAtKey,
  homeworkReviewedAt,
  homeworkReviewedAtKey,
  homeworkRevisionRequestedAt,
  homeworkRevisionRequestedAtKey,
  homeworkTextHighlight,
  homeworkTextHighlightRanges,
  homeworkTextTokens,
  homeworkTranslationLanguage,
  homeworkValueKey,
  homeworkVisibleExercises,
  homeworkVoiceRecordingTarget,
  setHomeworkReaction,
  withoutHomeworkReactions,
  toggleHomeworkTextHighlightRange,
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
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconPlus,
  IconReset,
  IconShuffle,
  IconTrash,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { StudentHomeworkExerciseEditor } from "@/components/lessons/student-homework-editor";
import { RegularVoiceRecorder } from "@/components/lessons/regular-voice-recorder";
import { HomeworkTeacherVoiceMessages } from "@/components/lessons/homework-teacher-voice-messages";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { focusHomeworkElementAction } from "@/lib/actions/lessons";
import { revealHomeworkFocusTarget } from "@/lib/homework-focus";

export type InteractiveHomeworkSession = {
  assignmentId: string;
  unitId: string;
  teacher: boolean;
  state: HomeworkStoredState;
  canAssign?: boolean;
  canEdit?: boolean;
  liveClass?: boolean;
  studentId?: string;
};

type HomeworkInteractionContextValue = {
  reviewTools: boolean;
  highlightMode: boolean;
  highlightColor: HomeworkHighlightColor;
  busy: boolean;
  onHighlightText?: (
    item: HomeworkItem,
    source: HomeworkTextHighlightSource,
    start: number,
    end: number,
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
  focusAt,
  onFocus,
  teacherReviewTools = false,
}: {
  plan: InteractiveHomeworkPlan;
  session: InteractiveHomeworkSession;
  onStateChange?: (state: HomeworkStoredState) => void;
  focusId?: string | null;
  /** A new timestamp makes a repeated focus on the same exercise scroll again. */
  focusAt?: string | null;
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
  const [reactionResetBusy, startReactionReset] = useTransition();
  const [teacherFocusId, setTeacherFocusId] = useState<string | null>(null);
  const activeFocusId = session.teacher ? teacherFocusId ?? focusId : focusId;
  const rootRef = useRef<HTMLDivElement>(null);
  const progress = homeworkExerciseProgress(currentPlan, state);
  const submittedAt = homeworkSubmittedAt(state);
  const reviewedAt = homeworkReviewedAt(state);
  const revisionRequestedAt = homeworkRevisionRequestedAt(state);
  const assignedAt = homeworkAssignedAt(state);
  const exercises = homeworkVisibleExercises(currentPlan, state, session.teacher, activeFocusId);

  const clearAllReactions = () => {
    setInteractionError(null);
    startReactionReset(async () => {
      try {
        const result = await clearHomeworkReactionsAction(session.assignmentId);
        if (result.error || !result.cleared) {
          setInteractionError(t.interactiveHomework.clearReactionsFailed);
          return;
        }
        setState((current) => withoutHomeworkReactions(current));
      } catch {
        setInteractionError(t.interactiveHomework.clearReactionsFailed);
      }
    });
  };

  // Focus is an explicit teacher control in both the lesson and homework review.
  // It never edits a student's answer, review status or saved highlighting.
  const interactWithElement = session.teacher ? (elementId: string) => {
    setInteractionError(null);
    const previousFocus = teacherFocusId;
    setTeacherFocusId(elementId);
    startInteraction(async () => {
      try {
        if (onFocus) {
          await onFocus(elementId);
          return;
        }
        const result = await focusHomeworkElementAction(session.assignmentId, elementId);
        if (result.error) {
          setInteractionError(result.error);
          setTeacherFocusId(previousFocus);
        }
      } catch {
        setTeacherFocusId(previousFocus);
        setInteractionError(t.interactiveHomework.focusFailed);
      }
    });
  } : undefined;

  const highlightText = teacherReviewTools && highlightMode
    ? (item: HomeworkItem, source: HomeworkTextHighlightSource, start: number, end: number) => {
        setInteractionError(null);
        startInteraction(async () => {
          const result = await highlightHomeworkTextRangeAction(
            session.assignmentId,
            item.id,
            source,
            start,
            end,
            highlightColor,
          );
          if (result.error) {
            setInteractionError(result.error);
            return;
          }
          setState(result.state ?? ((current) =>
            toggleHomeworkTextHighlightRange(current, item, source, start, end, highlightColor)));
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

  // The class already refreshes the assignment. Apply its feedback without
  // extra requests or replacing an answer the student is currently typing.
  useEffect(() => {
    if (session.teacher || !session.liveClass) return;
    const frame = requestAnimationFrame(() => {
      setState((current) => mergeHomeworkReactions(current, session.state));
    });
    return () => cancelAnimationFrame(frame);
  }, [session.liveClass, session.state, session.teacher]);

  const pullReviewState = async () => {
    const next = await homeworkReviewStateAction(session.assignmentId);
    if (next) setState(next);
  };

  useRealtimeSubscription({
    channel: !session.teacher && session.studentId
      ? `${session.liveClass ? "class" : "user"}:${session.studentId}`
      : null,
    events: "homework-review",
    onMessage: pullReviewState,
    onFallback: pullReviewState,
    fallbackMs: 30_000,
    enabled: !session.teacher && Boolean(session.studentId),
  });

  useEffect(() => {
    if (!activeFocusId || !rootRef.current || session.teacher) return;
    const target = revealHomeworkFocusTarget(rootRef.current, activeFocusId);
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeFocusId, focusAt, session.teacher]);

  return (
    <HomeworkInteractionContext.Provider value={{
      reviewTools: teacherReviewTools,
      highlightMode,
      highlightColor,
      busy: interactionBusy || reactionResetBusy,
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
            {session.teacher && (
              <button
                type="button"
                disabled={reactionResetBusy || !homeworkHasReactions(state)}
                onClick={clearAllReactions}
                title={t.interactiveHomework.clearAllReactionsHint}
                className="flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-3 text-xs font-black text-accent ring-1 ring-accent/25 transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconReset className={cn("h-4 w-4", reactionResetBusy && "animate-spin")} />
                {t.interactiveHomework.clearAllReactions}
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
        </div>
      )}

      {session.teacher && interactionError && (
        <p role="alert" className="text-xs font-semibold text-rose-500">{interactionError}</p>
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
          focusId={activeFocusId}
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

      {(teacherReviewTools || reviewedAt || exercises.some(
        (exercise) => homeworkExerciseTeacherScore(state, exercise.id) !== null,
      )) && (
        <HomeworkOverallGrade exercises={exercises} state={state} />
      )}

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

function HomeworkWordBank({
  words,
  total,
  collapsed,
  detached,
  side,
  onToggleCollapsed,
  onToggleDetached,
  onToggleSide,
}: {
  words: string[];
  total: number;
  collapsed: boolean;
  detached: boolean;
  side: "left" | "right";
  onToggleCollapsed: () => void;
  onToggleDetached: () => void;
  onToggleSide: () => void;
}) {
  const { t } = useT();
  const used = Math.max(0, total - words.length);

  return (
    <aside
      className={cn(
        "overflow-hidden rounded-xl bg-accent-soft/80 ring-1 ring-accent/20 shadow-sm transition-all",
        detached && "shadow-lg ring-accent/35",
      )}
    >
      <div className="flex min-h-10 items-center gap-1.5 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-black uppercase tracking-wide text-accent">
            {t.interactiveHomework.useWords}
          </p>
          <p className="text-[10px] font-bold text-muted">
            {t.interactiveHomework.wordsRemaining.replace("{remaining}", String(words.length)).replace("{total}", String(total))}
          </p>
        </div>
        {detached && (
          <button
            type="button"
            onClick={onToggleSide}
            title={side === "left" ? t.interactiveHomework.moveWordBankRight : t.interactiveHomework.moveWordBankLeft}
            aria-label={side === "left" ? t.interactiveHomework.moveWordBankRight : t.interactiveHomework.moveWordBankLeft}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-surface/80 lg:flex"
          >
            {side === "left"
              ? <IconChevronRight className="h-3.5 w-3.5" />
              : <IconChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleDetached}
          title={detached ? t.interactiveHomework.attachWordBank : t.interactiveHomework.detachWordBank}
          aria-label={detached ? t.interactiveHomework.attachWordBank : t.interactiveHomework.detachWordBank}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-black transition",
            detached ? "bg-accent text-white" : "bg-surface/80 text-accent hover:bg-surface",
          )}
        >
          <span aria-hidden="true">{detached ? "↙" : "↗"}</span>
          <span className="hidden sm:inline">
            {detached ? t.interactiveHomework.attach : t.interactiveHomework.detach}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? t.interactiveHomework.expandWordBank : t.interactiveHomework.collapseWordBank}
          aria-label={collapsed ? t.interactiveHomework.expandWordBank : t.interactiveHomework.collapseWordBank}
          aria-expanded={!collapsed}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface/80 text-accent transition hover:bg-surface"
        >
          <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")} />
        </button>
      </div>

      {!collapsed && (
        <div className={cn("border-t border-accent/15 px-3 py-2", detached && "max-h-72 overflow-y-auto overscroll-contain")}>
          {words.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {words.map((word, index) => (
                <li
                  key={`${normalizeWordBankKey(word)}-${index}`}
                  className="rounded-lg bg-surface/55 px-2 py-1 text-[13px] font-semibold leading-snug text-content"
                >
                  {word}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700">
              <IconCheck className="h-4 w-4 shrink-0" />
              {t.interactiveHomework.allWordsUsed}
            </div>
          )}
          {used > 0 && words.length > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface/70" aria-hidden="true">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round((used / Math.max(total, 1)) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function normalizeWordBankKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, "-");
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
  const [wordBankCollapsed, setWordBankCollapsed] = useState(false);
  const [wordBankDetached, setWordBankDetached] = useState(false);
  const [wordBankSide, setWordBankSide] = useState<"left" | "right">("right");
  const [busy, startAction] = useTransition();
  const hidden = homeworkExerciseHidden(state, exercise.id);
  const reactionColor = homeworkReactionColor(
    homeworkReaction(state, "exercise", exercise.id),
  );
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
  const hasWordBank = Boolean(
    exercise.wordBank?.length && exercise.kind !== "drag" && exercise.kind !== "describe",
  );
  const remainingWords = useMemo(
    () => exercise.kind === "fill" || exercise.kind === "definition"
      ? homeworkRemainingWordBank(exercise, state)
      : [...(exercise.wordBank ?? [])],
    [exercise, state],
  );
  const wordBank = hasWordBank ? (
    <HomeworkWordBank
      words={remainingWords}
      total={exercise.wordBank?.length ?? 0}
      collapsed={wordBankCollapsed}
      detached={wordBankDetached}
      side={wordBankSide}
      onToggleCollapsed={() => setWordBankCollapsed((current) => !current)}
      onToggleDetached={() => setWordBankDetached((current) => !current)}
      onToggleSide={() => setWordBankSide((current) => current === "left" ? "right" : "left")}
    />
  ) : null;
  const exerciseItems = (
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
  );
  const body = (
    <div className="mt-4">
      {actionError && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
          {actionError}
        </p>
      )}
      {wordBankDetached && wordBank ? (
        <div className={cn(
          "grid items-start gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]",
          wordBankSide === "right" && "lg:grid-cols-[minmax(0,1fr)_15rem]",
        )}>
          <div className={cn(
            "relative ml-auto w-full max-w-xs self-start lg:sticky lg:top-20 lg:z-10 lg:ml-0 lg:max-w-none",
            wordBankSide === "right" && "lg:col-start-2",
          )}>
            {wordBank}
          </div>
          <div className={cn(
            "min-w-0",
            wordBankSide === "left" ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1",
          )}>
            {exerciseItems}
          </div>
        </div>
      ) : (
        <>
          {wordBank && <div className="mb-3">{wordBank}</div>}
          {exerciseItems}
        </>
      )}
      {(interaction.reviewTools || Boolean(homeworkReviewedAt(state)) ||
        homeworkExerciseTeacherScore(state, exercise.id) !== null) && (
        <HomeworkExerciseGrade
          exercise={exercise}
          session={session}
          state={state}
          setState={setState}
        />
      )}
    </div>
  );

  const reset = () => startAction(async () => {
    const result = await resetHomeworkExerciseAnswersAction(session.assignmentId, exercise.id);
    if (result.error) return;
    setState((current) => clearExerciseAnswers(current, exercise, !session.teacher));
    setResetKey((key) => key + 1);
  });

  const clearReactions = () => {
    setActionError(null);
    startAction(async () => {
      try {
        const result = await clearHomeworkReactionsAction(session.assignmentId, exercise.id);
        if (result.error || !result.cleared) {
          setActionError(t.interactiveHomework.clearReactionsFailed);
          return;
        }
        setState((current) => withoutHomeworkReactions(current, exercise));
      } catch {
        setActionError(t.interactiveHomework.clearReactionsFailed);
      }
    });
  };

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
      <section data-homework-reaction={reactionColor ?? undefined} className={cn(
        "homework-reaction-block flex items-start gap-2 rounded-2xl border border-dashed border-accent/35 bg-surface p-4 shadow-sm",
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
        {session.teacher && onFocus && (
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
          onClearReactions={clearReactions}
          hasReactions={homeworkHasReactions(state, exercise)}
          onToggleHidden={toggleHidden}
          onDelete={onDelete}
        />
      </section>
    );
  }

  return (
    <section data-homework-reaction={reactionColor ?? undefined} className={cn(
      "homework-reaction-block rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5",
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
        {session.teacher && onFocus && (
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
          onClearReactions={clearReactions}
          hasReactions={homeworkHasReactions(state, exercise)}
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

function gradePresentation(score: number) {
  const label = homeworkGradeLabel(score);
  return {
    label,
    className: label === "great"
      ? "text-emerald-600 dark:text-emerald-300"
      : label === "good"
        ? "text-lime-600 dark:text-lime-300"
        : label === "not-bad"
          ? "text-amber-500 dark:text-amber-300"
          : label === "could-be-better"
            ? "text-orange-500 dark:text-orange-300"
            : "text-rose-600 dark:text-rose-300",
    panelClassName: label === "great"
      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/30"
      : label === "good"
        ? "border-lime-300 bg-lime-50/70 dark:border-lime-700 dark:bg-lime-950/30"
        : label === "not-bad"
          ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30"
          : label === "could-be-better"
            ? "border-orange-300 bg-orange-50/70 dark:border-orange-700 dark:bg-orange-950/30"
            : "border-rose-300 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/30",
  };
}

function gradeLabelText(
  label: ReturnType<typeof homeworkGradeLabel>,
  labels: {
    gradeGreat: string;
    gradeGood: string;
    gradeNotBad: string;
    gradeCouldBeBetter: string;
    gradeBad: string;
  },
) {
  if (label === "great") return labels.gradeGreat;
  if (label === "good") return labels.gradeGood;
  if (label === "not-bad") return labels.gradeNotBad;
  if (label === "could-be-better") return labels.gradeCouldBeBetter;
  return labels.gradeBad;
}

function HomeworkExerciseGrade({
  exercise,
  session,
  state,
  setState,
}: {
  exercise: HomeworkExercise;
  session: InteractiveHomeworkSession;
  state: HomeworkStoredState;
  setState: React.Dispatch<React.SetStateAction<HomeworkStoredState>>;
}) {
  const { t } = useT();
  const interaction = useContext(HomeworkInteractionContext);
  const storedScore = homeworkExerciseTeacherScore(state, exercise.id);
  const [scoreDraft, setScoreDraft] = useState(String(storedScore ?? 100));
  const [commentDraft, setCommentDraft] = useState(
    homeworkExerciseComment(state, exercise.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const needsTeacherScore = homeworkExerciseNeedsTeacherScore(exercise);
  const score = homeworkExerciseScore(exercise, state);
  const comment = homeworkExerciseComment(state, exercise.id);

  const presentation = score === null ? null : gradePresentation(score);
  return (
    <div className="mt-4 border-t border-line pt-4">
      {session.teacher && interaction.reviewTools && needsTeacherScore && (
        <div className="mb-4 grid gap-3 rounded-2xl bg-surface-2 p-3 ring-1 ring-line sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end">
          <label className="text-[11px] font-black uppercase tracking-wide text-muted">
            {t.interactiveHomework.exerciseScore}
            <span className="mt-1 flex h-10 items-center overflow-hidden rounded-xl bg-surface ring-1 ring-line">
              <input
                type="number"
                min={0}
                max={100}
                value={scoreDraft}
                onChange={(event) => setScoreDraft(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-black text-content outline-none"
              />
              <span className="pr-3 text-sm text-faint">%</span>
            </span>
          </label>
          <label className="text-[11px] font-black uppercase tracking-wide text-muted">
            {t.interactiveHomework.scoreComment}
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={t.interactiveHomework.scoreCommentPlaceholder}
              className="mt-1 h-10 w-full rounded-xl bg-surface px-3 text-sm font-semibold normal-case tracking-normal text-content outline-none ring-1 ring-line focus:ring-accent"
            />
          </label>
          <button
            type="button"
            disabled={busy || !Number.isFinite(Number(scoreDraft))}
            onClick={() => startBusy(async () => {
              setError(null);
              const result = await saveHomeworkExerciseGradeAction(
                session.assignmentId,
                exercise.id,
                Number(scoreDraft),
                commentDraft,
              );
              if (result.error || !result.state) {
                setError(result.error ?? t.interactiveHomework.scoreSaveFailed);
                return;
              }
              setState(result.state);
            })}
            className="h-10 rounded-xl bg-accent px-4 text-xs font-black text-white disabled:opacity-45"
          >
            {busy ? t.interactiveHomework.scoreSaving : t.interactiveHomework.scoreSave}
          </button>
          {error && <p className="text-xs font-bold text-rose-600 sm:col-span-3">{error}</p>}
        </div>
      )}

      {score !== null && presentation && (
        <div className={cn("rounded-2xl border px-4 py-3 text-center", presentation.panelClassName)}>
          <p className={cn("text-2xl font-black sm:text-3xl", presentation.className)}>
            {score}% · {gradeLabelText(presentation.label, t.interactiveHomework)}
          </p>
          {comment && (
            <p className="mx-auto mt-2 max-w-3xl whitespace-pre-wrap text-sm font-semibold leading-relaxed text-content">
              {comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HomeworkOverallGrade({
  exercises,
  state,
}: {
  exercises: HomeworkExercise[];
  state: HomeworkStoredState;
}) {
  const { t } = useT();
  const overall = homeworkOverallScore(exercises, state);
  if (overall.score === null) return null;
  const presentation = gradePresentation(overall.score);
  return (
    <section className={cn(
      "rounded-2xl border-2 px-5 py-5 text-center shadow-sm",
      presentation.panelClassName,
    )}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">
        {t.interactiveHomework.overallScore}
      </p>
      <p className={cn("mt-1 text-3xl font-black sm:text-4xl", presentation.className)}>
        {overall.score}% · {gradeLabelText(presentation.label, t.interactiveHomework)}
      </p>
      {overall.graded < overall.total && (
        <p className="mt-2 text-xs font-bold text-muted">
          {t.interactiveHomework.exercisesGraded
            .replace("{graded}", String(overall.graded))
            .replace("{total}", String(overall.total))}
        </p>
      )}
    </section>
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
  onClearReactions,
  hasReactions,
  onToggleHidden,
  onDelete,
}: {
  busy: boolean;
  teacher: boolean;
  hidden: boolean;
  onReset: () => void;
  onClearReactions: () => void;
  hasReactions: boolean;
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
            disabled={busy || !hasReactions}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              onClearReactions();
            }}
            title={t.interactiveHomework.clearExerciseReactionsHint}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            <IconReset className="h-3.5 w-3.5 shrink-0" />
            {t.interactiveHomework.clearExerciseReactions}
          </button>
        )}
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
    if (busy || value.trim() === savedValue.trim() || (!session.teacher && !value.trim())) return;
    startBusy(async () => {
      const result = await submitHomeworkAutoAnswerAction(session.assignmentId, item.id, value);
      if ("error" in result && result.error) return;
      const next = result as { value: string; status: "correct" | "locked" | null; attempts: string[] };
      setState((current) => {
        if (session.teacher) {
          return homeworkStateAfterTeacherAutoAnswerEdit(current, item, next.value);
        }
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
      if (session.teacher) {
        setFeedback((current) => ({ ...current, [item.id]: undefined }));
        return;
      }
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
    <div className="flex flex-col gap-2">
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
              disabled={busy || (!session.teacher && Boolean(status))}
              editable={session.teacher}
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
    if (!answer || (!session.teacher && homeworkStatus(state, item.id))) return;
    startBusy(async () => {
      const result = await submitHomeworkAutoAnswerAction(session.assignmentId, item.id, answer);
      if ("error" in result && result.error) return;
      const next = result as { value: string; status: "correct" | "locked" | null; attempts: string[] };
      setState((current) => {
        if (session.teacher) {
          return homeworkStateAfterTeacherAutoAnswerEdit(current, item, next.value);
        }
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
      if (session.teacher) {
        setFeedback((current) => ({ ...current, [item.id]: undefined }));
        return;
      }
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
          const answerHighlighted = hasHomeworkTextHighlight(state, item, "answer", value);
          const showAsText = interaction.highlightMode || (
            !session.teacher && (
              interaction.reviewTools || Boolean(homeworkReviewedAt(state)) || answerHighlighted
            )
          );
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
                      disabled={busy || (!session.teacher && Boolean(status))}
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
                {session.teacher && !showAsText && answerHighlighted && value && (
                  <span className="basis-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
                    <HomeworkHighlightableText item={item} source="answer" text={value} state={state} />
                  </span>
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
        const updated = clearHomeworkTextHighlights({
          ...current,
          [homeworkValueKey(item.id)]: value.trim(),
        }, item.id, "answer");
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
        const answer = drafts[item.id] ?? "";
        const answerHighlighted = hasHomeworkTextHighlight(state, item, "answer", answer);
        const showHighlightedAnswer = interaction.highlightMode || (
          !session.teacher && (
            interaction.reviewTools || Boolean(homeworkReviewedAt(state)) || answerHighlighted
          )
        );
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
                {showHighlightedAnswer ? (
                  <div className="min-h-24 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-content">
                    {answer ? (
                      <HomeworkHighlightableText
                        item={item}
                        source="answer"
                        text={answer}
                        state={state}
                      />
                    ) : (
                      <span className="text-faint">{t.interactiveHomework.noAnswer}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <textarea
                      value={answer}
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
                    {session.teacher && answerHighlighted && answer && (
                      <div className="mt-2 min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-content">
                        <HomeworkHighlightableText item={item} source="answer" text={answer} state={state} />
                      </div>
                    )}
                  </>
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
  const interaction = useContext(HomeworkInteractionContext);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tokens = homeworkTextTokens(text);
  const canHighlight = interaction.reviewTools && interaction.highlightMode && interaction.onHighlightText;
  const colors: Array<HomeworkHighlightColor | null> = Array.from(
    { length: text.length },
    () => null,
  );
  let offset = 0;
  tokens.forEach((token, tokenIndex) => {
    const tokenColor = homeworkTextHighlight(state, item.id, source, tokenIndex);
    if (tokenColor) {
      for (let at = offset; at < offset + token.text.length; at += 1) colors[at] = tokenColor;
    }
    offset += token.text.length;
  });
  for (const range of homeworkTextHighlightRanges(state, item.id, source, text.length)) {
    for (let at = range.start; at < range.end; at += 1) colors[at] = range.color;
  }
  const segments: Array<{ text: string; color: HomeworkHighlightColor | null }> = [];
  for (let at = 0; at < text.length; at += 1) {
    const color = colors[at];
    const current = segments.at(-1);
    if (current?.color === color) current.text += text[at];
    else segments.push({ text: text[at], color });
  }

  const highlightSelection = () => {
    if (!canHighlight || !rootRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (
      !rootRef.current.contains(range.startContainer) ||
      !rootRef.current.contains(range.endContainer)
    ) return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(rootRef.current);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    const end = start + range.toString().length;
    if (end <= start || !text.slice(start, end).trim()) return;
    interaction.onHighlightText?.(item, source, start, end);
    selection.removeAllRanges();
  };

  return (
    <span
      ref={rootRef}
      onMouseUp={highlightSelection}
      className={cn(
        "whitespace-pre-wrap",
        canHighlight && "cursor-text select-text rounded-sm outline-offset-2 hover:outline hover:outline-1 hover:outline-accent/30",
        className,
      )}
    >
      {segments.map((segment, index) => {
        const colorClass = segment.color === "yellow"
          ? "bg-yellow-300 text-slate-950"
          : segment.color === "green"
            ? "bg-emerald-300 text-emerald-950"
            : segment.color === "red"
              ? "bg-rose-400 text-white"
              : "";
        return (
          <span
            key={`${source}-${index}`}
            className={cn("rounded-sm", colorClass)}
          >
            {segment.text}
          </span>
        );
      })}
    </span>
  );
}

function hasHomeworkTextHighlight(
  state: HomeworkStoredState,
  item: HomeworkItem,
  source: HomeworkTextHighlightSource,
  text: string,
) {
  if (homeworkTextHighlightRanges(state, item.id, source, text.length).length > 0) return true;
  return homeworkTextTokens(text).some((_, index) =>
    Boolean(homeworkTextHighlight(state, item.id, source, index)));
}

function InlineHomeworkAnswer({
  item,
  value,
  state,
  feedback,
  disabled,
  editable,
  placeholder,
  onChange,
  onCommit,
}: {
  item: HomeworkItem;
  value: string;
  state: HomeworkStoredState;
  feedback?: "wrong" | "right";
  disabled: boolean;
  editable: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const interaction = useContext(HomeworkInteractionContext);
  const status = homeworkStatus(state, item.id);
  const reviewed = Boolean(homeworkReviewedAt(state));
  const hasHighlight = hasHomeworkTextHighlight(state, item, "answer", value);
  const showAsText = interaction.highlightMode || (
    !editable && (interaction.reviewTools || reviewed || hasHighlight)
  );
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
      {editable && !showAsText && hasHighlight && value && (
        <span className="basis-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-bold ring-1 ring-line">
          <HomeworkHighlightableText item={item} source="answer" text={value} state={state} />
        </span>
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
  const editable = session.teacher;
  const label = (reaction: HomeworkReaction) => {
    if (reaction === "thumbs-up") return t.interactiveHomework.reactionThumbsUp;
    if (reaction === "happy") return t.interactiveHomework.reactionHappy;
    if (reaction === "angry") return t.interactiveHomework.reactionAngry;
    if (reaction === "check") return t.interactiveHomework.reactionCheck;
    if (reaction === "warning") return t.interactiveHomework.reactionWarning;
    return t.interactiveHomework.reactionCross;
  };

  const sendReaction = (reaction: HomeworkReaction | null) => {
    setError(null);
    startBusy(async () => {
      try {
        const result = await setHomeworkReactionAction(
          session.assignmentId, target, targetId, reaction,
        );
        if (result.error) {
          setError(result.error);
          return;
        }
        setState((value) =>
          setHomeworkReaction(value, target, targetId, result.reaction ?? null));
        setOpen(false);
      } catch {
        setError(t.interactiveHomework.reactionFailed);
      }
    });
  };

  if (!editable && !current) return null;

  return (
    <div className="relative shrink-0">
      {editable ? (
        <button
          type="button"
          disabled={busy || interaction.busy}
          onClick={() => setOpen((value) => !value)}
          title={current ? label(current) : t.interactiveHomework.addReaction}
          aria-label={current ? label(current) : t.interactiveHomework.addReaction}
          aria-expanded={open}
          className={cn(
            "flex min-w-8 items-center justify-center transition hover:bg-accent-soft disabled:opacity-50",
            current ? "rounded-xl" : "h-8 rounded-lg text-faint",
          )}
        >
          {current
            ? <HomeworkReactionBadge key={current} reaction={current} label={label(current)} variant={target} />
            : <span className="text-base leading-none">🙂</span>}
        </button>
      ) : (
        <HomeworkReactionBadge key={current} reaction={current!} label={label(current!)} variant={target} />
      )}

      {editable && open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-line">
          <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-wide text-faint">
            {t.interactiveHomework.chooseReaction}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {HOMEWORK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                disabled={busy || interaction.busy}
                onClick={() => sendReaction(reaction)}
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
                <HomeworkReactionBadge reaction={reaction} label={label(reaction)} variant="picker" />
              </button>
            ))}
          </div>
          {current && (
            <button
              type="button"
              disabled={busy || interaction.busy}
              onClick={() => sendReaction(null)}
              className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-accent-soft px-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
            >
              <IconX className="h-3.5 w-3.5" />
              {t.interactiveHomework.clearReaction}
            </button>
          )}
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
  variant = "item",
}: {
  reaction: HomeworkReaction;
  label: string;
  variant?: HomeworkReactionTarget | "picker";
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
      data-homework-reaction={homeworkReactionColor(reaction) ?? undefined}
      className={cn(
        "homework-reaction-badge inline-flex shrink-0 items-center justify-center rounded-xl border-2 font-black leading-none",
        variant !== "picker" && "homework-reaction-visible",
        variant === "exercise" ? "h-12 w-12 text-[30px] sm:h-14 sm:w-14 sm:text-[34px]"
          : variant === "picker" ? "h-9 w-9 text-[23px]"
            : "h-10 w-10 text-[26px] sm:h-11 sm:w-11 sm:text-[28px]",
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
  const reactionColor = homeworkReactionColor(homeworkReaction(state, "item", item.id));

  return (
    <article
      data-homework-focus={itemFocusId}
      data-homework-reaction={reactionColor ?? undefined}
      className={cn(
        "homework-reaction-block rounded-2xl border bg-surface p-2.5 transition sm:p-3",
        status === "correct"
          ? "border-emerald-400"
          : status === "locked"
            ? "border-rose-500"
            : "border-line",
        focusId === itemFocusId && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-black text-faint">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
        {session.teacher && (
          <button
            type="button"
            onClick={() => setNoteOpen((open) => !open)}
            title={note ? t.interactiveHomework.editNote : t.interactiveHomework.addNote}
            aria-label={note ? t.interactiveHomework.editNote : t.interactiveHomework.addNote}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-accent transition hover:bg-accent-soft",
              noteOpen && "bg-accent-soft",
            )}
          >
            <IconPencil className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">
              {note ? t.interactiveHomework.editNote : t.interactiveHomework.addNote}
            </span>
          </button>
        )}
        <HomeworkReactionControl
          target="item"
          targetId={item.id}
          session={session}
          state={state}
          setState={setState}
        />
        {session.teacher && onFocus && (
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

      {session.teacher && noteOpen && (
        <div className="ml-9 mt-2 rounded-xl bg-accent-soft/50 p-3 ring-1 ring-accent/20">
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
