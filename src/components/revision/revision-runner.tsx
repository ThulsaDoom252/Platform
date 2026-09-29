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
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  attemptAction,
  saveAnswersAction,
  startRevisionAction,
  type AttemptView,
  type RevisionCard,
} from "@/lib/actions/revision";
import {
  nextSection,
  planProgress,
  timeoutRest,
} from "@/lib/revision-build";
import { scoreRevision, type RevisionAnswer } from "@/lib/revision-score";
import type { RevisionMode } from "@/lib/revision-modes";
import { RevisionStepScreen } from "@/components/revision/revision-steps";
import { IconCheck, IconChevronLeft, IconClock } from "@/components/icons";
import { cn } from "@/lib/utils";

type Phase = "intro" | "play" | "between" | "done";

export function RevisionRunner({ card }: { card: RevisionCard }) {
  const { t } = useT();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<RevisionAnswer[]>([]);
  const [phase, setPhase] = useState<Phase>("intro");
  /** Какая секция открыта. Шаг внутри неё считается по ответам. */
  const [section, setSection] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [busy, startBusy] = useTransition();

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
      setSection(where < 0 ? 0 : where);
      setPhase("play");
    });
  }

  /** Закрыть попытку: добитая временем или пройденная до конца. */
  function close(final: RevisionAnswer[]) {
    setAnswers(final);
    setPhase("done");
    if (attempt) void saveAnswersAction(attempt.id, final, true);
  }

  function stepDone(entries: RevisionAnswer[]) {
    if (!attempt) return;

    const next = [...answers, ...entries];
    const after = planProgress(attempt.plan, next);
    const finished = after.every((p) => p.done);

    setAnswers(next);
    void saveAnswersAction(attempt.id, next, finished);

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
      />
    );
  }

  if (phase === "intro" || !attempt) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <Back />

        <div className="rounded-3xl bg-surface p-6 ring-1 ring-line shadow-sm">
          <h1 className="text-xl font-bold text-content">{card.title}</h1>

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
              className="mt-4 h-12 w-full rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t.common.loading : t.revision.start}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        </div>
      </div>
    );
  }

  const progress = planProgress(attempt.plan, answers);
  const here = attempt.plan[section];
  const step = progress[section].step;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
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
      <div className="flex flex-wrap gap-1">
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
                "flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition",
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

      {phase === "between" ? (
        <Between
          answers={answers}
          mode={here.mode}
          label={MODE_LABEL}
          last={progress.every((p) => p.done)}
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
}: {
  title: string;
  answers: RevisionAnswer[];
  timeUp: boolean;
  labels: Record<RevisionMode, string>;
}) {
  const { t } = useT();
  const result = scoreRevision(answers);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Back />

      <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full tint-green">
          <IconCheck className="h-8 w-8" />
        </span>

        <h1 className="mt-3 text-xl font-bold text-content">
          {t.revision.taskDone}
        </h1>
        <p className="text-sm text-muted">{title}</p>

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
