"use client";

/**
 * Прохождение повторения слов.
 *
 * Задание не стартует само: ученик видит, что ему дали и откуда, и
 * начинает, когда готов. Остановить начатое нельзя, поэтому решение
 * начать должно быть его собственным.
 *
 * Ответы уходят на сервер после каждого шага. Закрытая вкладка не повод
 * проходить всё заново — попытка продолжится с того же места, а план
 * шагов зафиксирован при старте и под учеником не меняется.
 */
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  attemptAction,
  saveAnswersAction,
  saveRevisionStrugglingWordsAction,
  startRevisionAction,
  type AttemptView,
  type RevisionCard,
  type RevisionState,
} from "@/lib/actions/revision";
import {
  nextSection,
  planProgress,
  testSectionsComplete,
  timeoutRest,
} from "@/lib/revision-build";
import { scoreRevision, type RevisionAnswer } from "@/lib/revision-score";
import type { RevisionMode } from "@/lib/revision-modes";
import { RevisionStepScreen } from "@/components/revision/revision-steps";
import { IconCheck, IconChevronLeft, IconClock } from "@/components/icons";
import { cn } from "@/lib/utils";
import { HomeworkFeedbackPanel } from "@/components/homework-feedback-panel";
import { uniqueRevisionWords, revisionStrugglingWords } from "@/lib/revision-struggling";
import { RevisionStrugglingPanel, RevisionStrugglingSummary } from "@/components/revision/revision-struggling-panel";

type Phase = "intro" | "play" | "between" | "done";

export function RevisionRunner({
  card,
  embedded = false,
  preview,
}: {
  card: RevisionCard;
  embedded?: boolean;
  /** Одноразовый прогон учителя: ответы и статистика никуда не сохраняются. */
  preview?: AttemptView | null;
}) {
  const { t } = useT();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<RevisionAnswer[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Какая секция открыта. Шаг внутри неё считается по ответам. */
  const [section, setSection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [busy, startBusy] = useTransition();
  const [strugglingIds, setStrugglingIds] = useState<string[]>([]);
  const strugglingRef = useRef<string[]>([]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const words = useMemo(() => uniqueRevisionWords(attempt?.plan ?? []), [attempt?.plan]);

  useEffect(() => {
    if (preview || (!saving && !saveError)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [preview, saving, saveError]);

  /** Keep marks and answers ordered, including the last click immediately before completion. */
  function queueSave(job: () => Promise<RevisionState>, fullSnapshot = false) {
    pendingSaves.current += 1;
    setSaving(true);
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const result = await job();
        if (result.error) setSaveError(true);
        else if (fullSnapshot) setSaveError(false);
      } catch {
        setSaveError(true);
      } finally {
        pendingSaves.current -= 1;
        if (pendingSaves.current === 0) setSaving(false);
      }
    });
  }

  function persistAnswers(next: RevisionAnswer[], finished: boolean) {
    if (!attempt || preview) return;
    const ids = attempt.show.strugglingWith ? [...strugglingRef.current] : undefined;
    queueSave(() => saveAnswersAction(attempt.id, next, finished, ids), true);
  }

  function toggleStruggling(phraseId: string) {
    if (!attempt?.show.strugglingWith || phase === "done") return;
    const next = strugglingRef.current.includes(phraseId)
      ? strugglingRef.current.filter((id) => id !== phraseId)
      : [...strugglingRef.current, phraseId];
    strugglingRef.current = next;
    setStrugglingIds(next);
    if (!preview) queueSave(() => saveRevisionStrugglingWordsAction(attempt.id, next));
  }

  const saveNotice = !preview && saveError ? <div className="rounded-xl bg-surface-2 px-3 py-2 text-left text-xs" role="status" aria-live="polite">
    <p className="font-semibold text-rose-500">{t.revision.strugglingSaveFailed}</p>
    <button type="button" disabled={saving}
      onClick={() => persistAnswers(answers, phase === "done")}
      className="mt-2 min-h-9 rounded-lg bg-accent px-3 font-bold text-white transition hover:opacity-90 disabled:opacity-50">
      {t.revision.strugglingRetry}
    </button>
  </div> : null;

  const MODE_LABEL: Record<RevisionMode, string> = {
    flashcards: t.revision.modeFlashcards,
    choose: t.revision.modeChoose,
    pairs: t.revision.modePairs,
    unscramble: t.revision.modeUnscramble,
    picture: t.revision.modePicture,
    definition: t.revision.modeDefinition,
    definitionPairs: t.revision.modeDefinitionPairs,
  };

  function begin() {
    setError(null);
    if (preview) {
      setAttempt({
        ...preview,
        answers: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });
      setAnswers([]);
      strugglingRef.current = [];
      setStrugglingIds([]);
      setSection(0);
      setTimeUp(false);
      setPhase("play");
      return;
    }
    startBusy(async () => {
      const started = await startRevisionAction(card.id);
      if (started.error || !started.attemptId) {
        setError(started.error ?? t.revision.failed);
        return;
      }

      const view = await attemptAction(started.attemptId);
      if (!view) {
        setError(t.revision.failed);
        return;
      }

      // Прерванная попытка продолжается с места остановки, без поздравлений.
      const done = view.answers ?? [];
      const where = nextSection(planProgress(view.plan, done));
      setAttempt(view);
      setAnswers(done);
      strugglingRef.current = view.strugglingWords ?? [];
      setStrugglingIds(strugglingRef.current);
      setSection(where < 0 ? 0 : where);
      setPhase("play");
    });
  }

  /** Закрыть попытку: добитая временем или пройденная до конца. */
  function close(final: RevisionAnswer[]) {
    setAnswers(final);
    setPhase("done");
    persistAnswers(final, true);
  }

  function stepDone(entries: RevisionAnswer[]) {
    if (!attempt) return;

    const next = [...answers, ...entries];
    const after = planProgress(attempt.plan, next);
    // Flashcards — необязательная разминка. Они не блокируют сдачу:
    // игра заканчивается после всех проверочных режимов.
    const finished = testSectionsComplete(after);

    setAnswers(next);
    persistAnswers(next, finished);

    if (finished) setPhase("done");
    // Секция кончилась — поздравляем; иначе просто следующий шаг.
    else if (after[section].done) setPhase("between");
  }

  if (phase === "done" || (attempt && attempt.finishedAt)) {
    return (
      <Result
        title={card.title}
        answers={answers}
        timeUp={timeUp}
        labels={MODE_LABEL}
        embedded={embedded}
        homeworkCard={!preview && card.placement === "HOMEWORK" ? card : undefined}
        strugglingWords={revisionStrugglingWords(attempt?.plan ?? [], strugglingIds)}
        strugglingEnabled={attempt?.show.strugglingWith ?? false}
        saveNotice={saveNotice ?? (!preview && saving ? <p role="status" className="text-xs text-muted">{t.revision.strugglingSaving}</p> : null)}
      />
    );
  }

  if (phase === "intro" || !attempt) {
    return (
      <div className="revision-game-theme mx-auto flex w-full max-w-xl flex-col gap-5">
        {!embedded && <Back />}

        <div className="relative overflow-hidden rounded-[1.75rem] bg-surface p-5 ring-1 ring-line shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl text-white shadow-lg shadow-emerald-500/20">🧠</span>
          <h1 className="text-xl font-black text-content sm:text-2xl">{card.title}</h1>

          <p className="mt-1 text-sm text-muted">
            {fmt(t.revision.selected, { n: card.words })}
            {card.dueAt &&
              ` · ${t.revision.due} ${new Date(card.dueAt).toLocaleString()}`}
          </p>

          {card.nodeName && (
            <p className="mt-2 text-[12px] text-faint">
              {t.revision.fromVocab}:{" "}
              <Link
                href="/student/materials"
                className="font-semibold text-accent hover:opacity-80"
              >
                {card.nodeName}
              </Link>{" "}
              · {new Date(card.createdAt).toLocaleDateString()}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1">
            {card.modes.map((mode) => (
              <span
                key={mode}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted"
              >
                {MODE_LABEL[mode as RevisionMode] ?? mode}
              </span>
            ))}
          </div>

          <p className="mt-4 text-[13px] text-muted">{t.revision.startHint}</p>

          {!card.open ? (
            <p className="mt-4 text-sm font-semibold text-rose-500">
              {t.revision.alreadyDone}
            </p>
          ) : (
            <button
              type="button"
              onClick={begin}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50"
            >
              {!busy && <span aria-hidden>▶</span>}
              {busy ? t.common.loading : t.revision.start}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
          {!preview && card.placement === "HOMEWORK" && <HomeworkFeedbackPanel
            kind="REVISION" id={card.id} settings={card.homeworkFeedback} score={card.lastCompletedScore}
            canAuto={card.modes.some((mode) => mode !== "flashcards")} studentId={card.studentId} />}
          </div>
        </div>
      </div>
    );
  }

  const progress = planProgress(attempt.plan, answers);
  const here = attempt.plan[section];
  const step = progress[section].step;

  return (
    <div className="revision-game-theme mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-content">{card.title}</p>
          <p className="text-[11px] text-faint">
            {fmt(t.revision.sectionOf, {
              n: section + 1,
              total: attempt.plan.length,
            })}{" "}
            · {MODE_LABEL[here.mode]} · {progress[section].answered}/
            {progress[section].total}
          </p>
        </div>

        {attempt.totalSeconds && (
          <WholeTimer
            startedAt={attempt.startedAt}
            seconds={attempt.totalSeconds}
            onOut={() => {
              if (timeUp) return;
              setTimeUp(true);
              close([...answers, ...timeoutRest(attempt.plan, answers.length)]);
            }}
          />
        )}
      </div>

      {/*
       * Переключатель секций. Застрять на режиме, который сегодня не
       * идёт, нельзя: ученик уходит на другой и возвращается — секция
       * ждёт его на том же шаге.
       */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {attempt.plan.map((s, i) => {
          const p = progress[i];
          return (
            <button
              key={s.mode}
              type="button"
              onClick={() => {
                setSection(i);
                setPhase("play");
              }}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition",
                i === section
                  ? "bg-accent text-white"
                  : p.done
                    ? "tint-green"
                    : "bg-surface-2 text-muted hover:text-content",
              )}
            >
              {p.done && <IconCheck className="h-3 w-3" />}
              {MODE_LABEL[s.mode]}
              <span className="opacity-70">
                {p.answered}/{p.total}
              </span>
            </button>
          );
        })}
      </div>

      {attempt.show.strugglingWith && <RevisionStrugglingPanel words={words} selected={strugglingIds} onToggle={toggleStruggling} saving={!preview && saving} />}
      {saveNotice}

      {phase === "between" ? (
        <Between
          answers={answers}
          mode={here.mode}
          label={MODE_LABEL}
          last={testSectionsComplete(progress)}
          onNext={() => {
            const to = nextSection(progress, section + 1);
            if (to >= 0) setSection(to);
            setPhase("play");
          }}
        />
      ) : progress[section].done ? (
        /* Секцию уже прошли — здесь больше нечего спрашивать. */
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-3xl bg-surface p-8 text-center ring-1 ring-line shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full tint-green">
            <IconCheck className="h-7 w-7" />
          </span>
          <p className="text-sm font-bold text-content">{t.revision.sectionDone}</p>
          {nextSection(progress, section + 1) >= 0 && (
            <button
              type="button"
              onClick={() => setSection(nextSection(progress, section + 1))}
              className="h-11 w-full max-w-xs rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
            >
              {t.revision.nextSection}
            </button>
          )}
        </div>
      ) : (
        <RevisionStepScreen
          key={`${section}-${step}`}
          step={here.steps[step]}
          seconds={attempt.answerSeconds}
          show={attempt.show}
          onDone={stepDone}
          strugglingIds={strugglingIds}
          onStrugglingToggle={toggleStruggling}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Back() {
  const { t } = useT();
  return (
    <Link
      href="/student/homework"
      className="flex w-fit items-center gap-1 text-[13px] font-semibold text-muted transition hover:text-accent"
    >
      <IconChevronLeft className="h-4 w-4" />
      {t.revision.backToHomework}
    </Link>
  );
}

/** Общий срок на всю работу: он тикает поверх задания и обрывает его. */
function WholeTimer({
  startedAt,
  seconds,
  onOut,
}: {
  startedAt: string;
  seconds: number;
  onOut: () => void;
}) {
  const { t } = useT();
  const deadline = new Date(startedAt).getTime() + seconds * 1000;
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const fire = useRef(onOut);

  useEffect(() => {
    fire.current = onOut;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const ms = deadline - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) {
        clearInterval(id);
        fire.current();
      }
    }, 500);
    return () => clearInterval(id);
  }, [deadline]);

  const low = left < 60_000;

  return (
    <span
      title={t.revision.timeLeft}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[12px] font-bold tabular-nums",
        low ? "tint-rose" : "bg-surface-2 text-muted",
      )}
    >
      <IconClock className="h-3.5 w-3.5" />
      {clock(left)}
    </span>
  );
}

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Поздравление между секциями: без него они сливаются в одну ленту. */
function Between({
  answers,
  mode,
  label,
  last,
  onNext,
}: {
  answers: RevisionAnswer[];
  mode: RevisionMode;
  label: Record<RevisionMode, string>;
  /** Секций больше нет — значит это уже конец задания. */
  last: boolean;
  onNext: () => void;
}) {
  const { t } = useT();
  const done = scoreRevision(answers).sections.find((s) => s.mode === mode);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl bg-surface p-8 text-center ring-1 ring-line shadow-sm">
      <span className="flex h-16 w-16 items-center justify-center rounded-full tint-green text-3xl">
        🎉
      </span>

      <div>
        <p className="text-lg font-black text-content">{t.revision.sectionDone}</p>
        <p className="mt-0.5 text-sm text-muted">{label[mode]}</p>
      </div>

      {done && (
        <p className="text-sm font-semibold text-accent">
          {fmt(t.revision.sectionScore, { right: done.right, total: done.total })}
        </p>
      )}

      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="h-12 w-full max-w-xs rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
      >
        {last ? t.revision.finish : t.revision.nextSection}
      </button>
    </div>
  );
}

/** Итог для ученика: коротко и без разбора — разбор смотрит учитель. */
function Result({
  title,
  answers,
  timeUp,
  labels,
  embedded,
  homeworkCard,
  strugglingWords,
  strugglingEnabled,
  saveNotice,
}: {
  title: string;
  answers: RevisionAnswer[];
  timeUp: boolean;
  labels: Record<RevisionMode, string>;
  embedded: boolean;
  homeworkCard?: RevisionCard;
  strugglingWords: ReturnType<typeof revisionStrugglingWords>;
  strugglingEnabled: boolean;
  saveNotice: ReactNode;
}) {
  const { t } = useT();
  const result = scoreRevision(answers);

  return (
    <div className="revision-game-theme mx-auto flex w-full max-w-xl flex-col gap-5">
      {!embedded && <Back />}

      <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full tint-green">
          <IconCheck className="h-8 w-8" />
        </span>

        <h1 className="mt-3 text-xl font-bold text-content">
          {t.revision.taskDone}
        </h1>
        <p className="text-sm text-muted">{title}</p>
        {saveNotice && <div className="mt-3">{saveNotice}</div>}

        {timeUp && (
          <p className="mt-2 text-sm font-semibold text-rose-500">
            {t.revision.timeUp}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Tile
            label={t.revision.accuracy}
            value={`${result.accuracy}%`}
            tone="tint-accent"
          />
          <Tile
            label={t.revision.yourResult}
            value={`${result.right}/${result.total}`}
            tone="tint-green"
          />
        </div>

        <p className="mt-3 text-[12px] text-faint">
          {t.revision.timeSpent}: {clock(result.totalMs)}
        </p>

        {homeworkCard && <HomeworkFeedbackPanel kind="REVISION" id={homeworkCard.id}
          settings={homeworkCard.homeworkFeedback} score={result}
          canAuto={result.total > 0} studentId={homeworkCard.studentId} />}
        {(strugglingEnabled || strugglingWords.length > 0) && <RevisionStrugglingSummary words={strugglingWords} />}

        <div className="mt-4 flex flex-col gap-1.5 text-left">
          {result.sections.map((s) => (
            <div
              key={s.mode}
              className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 truncate text-[12px] font-semibold text-content">
                {labels[s.mode]}
              </span>
              <span className="shrink-0 text-[12px] font-bold text-muted">
                {s.right}/{s.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={cn("rounded-2xl px-3 py-4", tone)}>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold opacity-80">{label}</p>
    </div>
  );
}
