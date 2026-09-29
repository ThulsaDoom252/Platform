"use client";

/**
 * Экраны повторения слов.
 *
 * Каждый режим — отдельный экран со своим правилом «что считать
 * ответом». Наружу все отдают одно и то же: список ответов по словам.
 * Поэтому оболочка ничего не знает про режимы и просто листает шаги.
 *
 * Таймер живёт внутри экрана, а не снаружи: только сам экран знает, на
 * что время ещё не потрачено. В паре из четырёх слов истёкшее время
 * закрывает лишь несобранные пары, а не всю группу.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { SpeakPair, useSpeech } from "@/components/materials/speech";
import { shuffle } from "@/lib/game-deck";
import { stopwatch } from "@/lib/stopwatch";
import type { RevisionStep } from "@/lib/revision-build";
import type { RevisionAnswer } from "@/lib/revision-score";
import type { RevisionWord } from "@/lib/revision-modes";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type StepProps = {
  step: RevisionStep;
  /** Секунд на шаг; null — без ограничения. */
  seconds: number | null;
  onDone: (entries: RevisionAnswer[]) => void;
};

/* ------------------------------------------------------------------ */
/* Общее                                                               */
/* ------------------------------------------------------------------ */

/**
 * Отсчёт на шаг.
 *
 * Остановленный отсчёт не просто прячется, а снимается: иначе он добьёт
 * уже отвеченный шаг через секунду после ответа.
 */
function useStepTimer(
  seconds: number | null,
  stopped: boolean,
  onOut: () => void,
) {
  const [left, setLeft] = useState(seconds ?? 0);
  const fire = useRef(onOut);

  useEffect(() => {
    fire.current = onOut;
  });

  useEffect(() => {
    if (!seconds || stopped) return;
    const deadline = Date.now() + seconds * 1000;

    const id = setInterval(() => {
      const ms = deadline - Date.now();
      setLeft(Math.max(0, ms / 1000));
      if (ms <= 0) {
        clearInterval(id);
        fire.current();
      }
    }, 100);

    return () => clearInterval(id);
  }, [seconds, stopped]);

  return seconds ? left : null;
}

/**
 * Часы шага. Заводятся эффектом: вызов Date.now() в рендере даёт время,
 * которое меняется само по себе при каждом лишнем рендере.
 */
function useStopwatch() {
  // Состояние, а не ref: объект часов нужен уже в рендере, ref читать там нельзя.
  const [watch] = useState(() => stopwatch());

  useEffect(() => {
    watch.start();
  }, [watch]);

  return watch;
}

function TimerBar({ left, total }: { left: number | null; total: number | null }) {
  if (left === null || !total) return null;
  const part = Math.max(0, Math.min(1, left / total));

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100 ease-linear",
            part > 0.33 ? "bg-accent" : "bg-rose-500",
          )}
          style={{ width: `${part * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "w-7 shrink-0 text-right font-mono text-base font-bold tabular-nums",
          part > 0.33 ? "text-content" : "text-rose-500",
        )}
      >
        {Math.ceil(left)}
      </span>
    </div>
  );
}

/** Вердикт во весь экран: ученик должен увидеть его, не вчитываясь. */
function Verdict({
  ok,
  right,
  onNext,
}: {
  ok: boolean;
  /** Что было верным ответом — показывается только при ошибке. */
  right?: string;
  onNext: () => void;
}) {
  const { t } = useT();

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-lg font-black tracking-wide",
          ok ? "tint-green" : "tint-rose",
        )}
      >
        {ok ? (
          <>
            <IconCheck className="h-5 w-5" /> {t.revision.correct} 🎉
          </>
        ) : (
          <>
            <IconX className="h-5 w-5" /> {t.revision.wrong}
          </>
        )}
      </div>

      {!ok && right && (
        <p className="text-center text-sm text-muted">
          {t.revision.rightAnswer}:{" "}
          <span className="font-bold text-content">{right}</span>
        </p>
      )}

      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="h-12 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
      >
        {t.revision.next}
      </button>
    </div>
  );
}

/** Картинка слова в общей рамке. */
function WordImage({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-2">
      <Image src={url} alt={alt} fill unoptimized className="object-contain" />
    </div>
  );
}

/** Сравнение набранного с правильным: регистр и лишние пробелы не в счёт. */
function same(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:"'’]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

function entry(
  mode: RevisionAnswer["mode"],
  word: RevisionWord,
  correct: boolean,
  ms: number,
  reason?: RevisionAnswer["reason"],
): RevisionAnswer {
  return { mode, phraseId: word.phraseId, word: word.word, correct, ms, reason };
}

/* ------------------------------------------------------------------ */
/* Карточки                                                            */
/* ------------------------------------------------------------------ */

function Flashcards({
  words,
  onDone,
}: {
  words: RevisionWord[];
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();
  const speech = useSpeech();
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const spent = useRef<number[]>(words.map(() => 0));
  const watch = useStopwatch();

  /** Записать время на текущую карточку и начать отсчёт заново. */
  const charge = () => {
    spent.current[at] += watch.lap();
  };

  const go = (to: number) => {
    charge();
    setAt(to);
    setFlipped(false);
  };

  const finish = () => {
    charge();
    onDone(
      words.map((word, i) =>
        entry("flashcards", word, true, spent.current[i] ?? 0),
      ),
    );
  };

  const word = words[at];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-[12px] font-semibold text-faint">
        {fmt(t.revision.stepOf, { n: at + 1, total: words.length })}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-4 rounded-3xl bg-surface p-6 text-center ring-1 ring-line shadow-sm transition hover:ring-accent"
      >
        {!flipped ? (
          <>
            <span className="text-3xl font-black leading-tight text-content sm:text-4xl">
              {word.word}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <SpeakPair text={word.word} id={word.phraseId} speech={speech} />
            </span>
          </>
        ) : (
          <>
            {word.imageUrl && (
              <div className="w-full max-w-xs">
                <WordImage url={word.imageUrl} alt={word.word} />
              </div>
            )}
            {word.translation && (
              <span className="text-2xl font-bold text-accent">
                {word.translation}
              </span>
            )}
            {word.description && (
              <span className="text-sm text-muted">{word.description}</span>
            )}
          </>
        )}
      </button>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2 disabled:opacity-40"
        >
          <IconChevronLeft className="h-4 w-4" />
          {t.revision.back}
        </button>

        {at + 1 < words.length ? (
          <button
            type="button"
            onClick={() => go(at + 1)}
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
          >
            {t.revision.next}
            <IconChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="h-12 flex-1 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
          >
            {t.revision.finish}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Выбор из вариантов                                                  */
/* ------------------------------------------------------------------ */

function ChoiceScreen({
  mode,
  word,
  prompt,
  options,
  correct,
  seconds,
  onDone,
}: {
  mode: "choose" | "definition";
  word: RevisionWord;
  prompt: React.ReactNode;
  options: string[];
  correct: string;
  seconds: number | null;
  onDone: StepProps["onDone"];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const watch = useStopwatch();
  const took = useRef(0);

  const answered = picked !== null || timedOut;
  const left = useStepTimer(seconds, answered, () => {
    took.current = (seconds ?? 0) * 1000;
    setTimedOut(true);
  });

  const ok = picked !== null && same(picked, correct);

  const pick = (option: string) => {
    if (answered) return;
    took.current = watch.ms();
    setPicked(option);
  };

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={seconds} />

      <div className="flex min-h-[22vh] items-center justify-center rounded-3xl bg-surface px-5 py-8 text-center ring-1 ring-line shadow-sm">
        {prompt}
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isRight = same(option, correct);
          const chosen = picked === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => pick(option)}
              disabled={answered}
              className={cn(
                "min-h-12 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition",
                !answered && "bg-surface text-content ring-line hover:ring-accent",
                answered && isRight && "tint-green ring-transparent",
                answered && chosen && !isRight && "tint-rose ring-transparent",
                answered && !chosen && !isRight && "bg-surface-2 text-faint ring-transparent",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <Verdict
          ok={ok}
          right={correct}
          onNext={() =>
            onDone([
              entry(
                mode,
                word,
                ok,
                took.current,
                ok ? undefined : timedOut ? "timeout" : "wrong",
              ),
            ])
          }
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Пары                                                                */
/* ------------------------------------------------------------------ */

function Pairs({
  mode,
  words,
  seconds,
  onDone,
}: {
  mode: "pairs" | "definitionPairs";
  words: RevisionWord[];
  seconds: number | null;
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();

  // Перемешано один раз: иначе колонки прыгали бы на каждый клик.
  const left = useMemo(() => shuffle(words), [words]);
  const right = useMemo(() => shuffle(words), [words]);

  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [out, setOut] = useState(false);

  const spent = useRef<Record<string, number>>({});
  const watch = useStopwatch();

  const done = out || matched.length === words.length;
  // На группу из четырёх времени дают вчетверо: это один шаг, но четыре ответа.
  const total = seconds ? seconds * words.length : null;
  const leftMs = useStepTimer(total, done, () => setOut(true));

  const faceOf = (w: RevisionWord) =>
    mode === "pairs" ? (w.translation ?? "") : (w.description ?? "");

  const tap = (side: "left" | "right", id: string) => {
    if (done || matched.includes(id)) return;

    if (side === "left") {
      setPicked(id);
      return;
    }
    if (!picked) return;

    if (picked === id) {
      spent.current[id] = watch.lap();
      setMatched((prev) => [...prev, id]);
      setPicked(null);
      return;
    }

    // Промах помечает именно то слово, за которое взялись.
    setMissed((prev) => (prev.includes(picked) ? prev : [...prev, picked]));
    setFlash(id);
    setTimeout(() => setFlash(null), 450);
    setPicked(null);
  };

  const finish = () =>
    onDone(
      words.map((w) => {
        const solved = matched.includes(w.phraseId);
        return entry(
          mode,
          w,
          solved && !missed.includes(w.phraseId),
          spent.current[w.phraseId] ?? 0,
          solved
            ? missed.includes(w.phraseId)
              ? "wrong"
              : undefined
            : "timeout",
        );
      }),
    );

  const cell = (id: string, text: string, side: "left" | "right") => {
    const solved = matched.includes(id);
    const active = side === "left" && picked === id;
    const bad = side === "right" && flash === id;

    return (
      <button
        key={`${side}-${id}`}
        type="button"
        onClick={() => tap(side, id)}
        disabled={solved || done}
        className={cn(
          "min-h-14 rounded-xl px-3 py-2 text-left text-[13px] font-semibold ring-1 transition",
          solved && "tint-green ring-transparent opacity-70",
          !solved && active && "bg-accent text-white ring-accent",
          !solved && bad && "tint-rose ring-transparent shake",
          !solved && !active && !bad && "bg-surface text-content ring-line hover:ring-accent",
        )}
      >
        {text}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={leftMs} total={total} />
      <p className="text-center text-[12px] text-faint">{t.revision.matchHint}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {left.map((w) => cell(w.phraseId, w.word, "left"))}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((w) => cell(w.phraseId, faceOf(w), "right"))}
        </div>
      </div>

      {done && (
        <Verdict
          ok={matched.length === words.length && missed.length === 0}
          onNext={finish}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Собери слово                                                        */
/* ------------------------------------------------------------------ */

const UNSCRAMBLE_TRIES = 3;

function Unscramble({
  word,
  seconds,
  onDone,
}: {
  word: RevisionWord;
  seconds: number | null;
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();

  /*
   * Фразу собираем из слов, одиночное слово — из букв. Рассыпать фразу
   * на буквы — это уже не повторение, а головоломка.
   */
  const target = word.word.trim();
  const byWords = /\s/.test(target);
  const parts = useMemo(
    () => (byWords ? target.split(/\s+/) : [...target]),
    [target, byWords],
  );
  const tiles = useMemo(
    () => shuffle(parts.map((text, i) => ({ id: i, text }))),
    [parts],
  );

  const [placed, setPlaced] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const [shakeOn, setShakeOn] = useState(false);
  const [result, setResult] = useState<"ok" | "fail" | "timeout" | null>(null);

  const watch = useStopwatch();
  const took = useRef(0);

  const left = useStepTimer(seconds, result !== null, () => {
    took.current = (seconds ?? 0) * 1000;
    setResult("timeout");
  });

  const textOf = (ids: number[]) =>
    ids.map((id) => tiles.find((tile) => tile.id === id)!.text).join(byWords ? " " : "");

  const add = (id: number) => {
    if (result) return;
    const next = [...placed, id];
    setPlaced(next);
    if (next.length < parts.length) return;

    if (same(textOf(next), target)) {
      took.current = watch.ms();
      setResult("ok");
      return;
    }

    const used = tries + 1;
    setTries(used);
    setShakeOn(true);
    setTimeout(() => setShakeOn(false), 450);
    setPlaced([]);
    if (used >= UNSCRAMBLE_TRIES) {
      took.current = watch.ms();
      setResult("fail");
    }
  };

  const drop = (at: number) => {
    if (result) return;
    setPlaced((prev) => prev.filter((_, i) => i !== at));
  };

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={seconds} />

      <div className="flex min-h-[18vh] flex-col items-center justify-center gap-3 rounded-3xl bg-surface px-5 py-6 text-center ring-1 ring-line shadow-sm">
        {word.translation && (
          <p className="text-lg font-bold text-accent">{word.translation}</p>
        )}
        {word.imageUrl && (
          <div className="w-full max-w-[200px]">
            <WordImage url={word.imageUrl} alt="" />
          </div>
        )}
      </div>

      {/* Собранное */}
      <div
        className={cn(
          "flex min-h-14 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-2.5",
          shakeOn && "shake",
        )}
      >
        {placed.length === 0 ? (
          <span className="text-[12px] text-faint">{t.revision.typeWord}</span>
        ) : (
          placed.map((id, at) => (
            <button
              key={`${id}-${at}`}
              type="button"
              onClick={() => drop(at)}
              className="min-w-9 rounded-lg bg-accent px-2.5 py-1.5 text-sm font-bold text-white"
            >
              {tiles.find((tile) => tile.id === id)!.text}
            </button>
          ))
        )}
      </div>

      {/* Рассыпанное */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => add(tile.id)}
            disabled={placed.includes(tile.id) || result !== null}
            className="min-w-9 rounded-lg bg-surface px-2.5 py-1.5 text-sm font-bold text-content ring-1 ring-line transition hover:ring-accent disabled:opacity-25"
          >
            {tile.text}
          </button>
        ))}
      </div>

      {result === null && tries > 0 && (
        <p className="text-center text-[12px] font-semibold text-rose-500">
          {fmt(t.revision.triesLeft, { n: UNSCRAMBLE_TRIES - tries })}
        </p>
      )}

      {result && (
        <Verdict
          ok={result === "ok"}
          right={target}
          onNext={() =>
            onDone([
              entry(
                "unscramble",
                word,
                result === "ok",
                took.current,
                result === "ok" ? undefined : result === "timeout" ? "timeout" : "wrong",
              ),
            ])
          }
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Угадай по картинке                                                  */
/* ------------------------------------------------------------------ */

function Picture({
  word,
  seconds,
  onDone,
}: {
  word: RevisionWord;
  seconds: number | null;
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();
  const speech = useSpeech();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<"ok" | "wrong" | "timeout" | null>(null);

  const watch = useStopwatch();
  const took = useRef(0);

  const left = useStepTimer(seconds, result !== null, () => {
    took.current = (seconds ?? 0) * 1000;
    setResult("timeout");
  });

  const check = () => {
    if (result || !typed.trim()) return;
    took.current = watch.ms();
    setResult(same(typed, word.word) ? "ok" : "wrong");
  };

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={seconds} />

      {word.imageUrl && <WordImage url={word.imageUrl} alt="" />}

      {result === null ? (
        <div className="flex gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder={t.revision.typeWord}
            autoFocus
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 text-base text-content outline-none transition placeholder:text-faint focus:border-accent"
          />
          <button
            type="button"
            onClick={check}
            disabled={!typed.trim()}
            className="h-12 shrink-0 rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {t.revision.check}
          </button>
        </div>
      ) : (
        <>
          {/* Карточка переворачивается: сначала догадка, потом ответ. */}
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface px-4 py-4 text-center ring-1 ring-line">
            <span className="flex items-center gap-1.5 text-2xl font-black text-content">
              {word.word}
              <SpeakPair text={word.word} id={word.phraseId} speech={speech} />
            </span>
            {word.translation && (
              <span className="text-sm font-semibold text-accent">
                {word.translation}
              </span>
            )}
          </div>

          <Verdict
            ok={result === "ok"}
            right={word.word}
            onNext={() =>
              onDone([
                entry(
                  "picture",
                  word,
                  result === "ok",
                  took.current,
                  result === "ok" ? undefined : result === "timeout" ? "timeout" : "wrong",
                ),
              ])
            }
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Диспетчер                                                           */
/* ------------------------------------------------------------------ */

export function RevisionStepScreen({ step, seconds, onDone }: StepProps) {
  const speech = useSpeech();

  switch (step.mode) {
    case "flashcards":
      return <Flashcards words={step.words} onDone={onDone} />;

    case "choose":
      return (
        <ChoiceScreen
          mode="choose"
          word={step.word}
          options={step.options}
          correct={step.word.translation!.trim()}
          seconds={seconds}
          onDone={onDone}
          prompt={
            <span className="flex flex-wrap items-center justify-center gap-2 text-3xl font-black text-content sm:text-4xl">
              {step.word.word}
              <SpeakPair
                text={step.word.word}
                id={step.word.phraseId}
                speech={speech}
              />
            </span>
          }
        />
      );

    case "definition":
      return (
        <ChoiceScreen
          mode="definition"
          word={step.word}
          options={step.options}
          correct={step.word.word.trim()}
          seconds={seconds}
          onDone={onDone}
          prompt={
            <span className="text-lg font-semibold leading-snug text-content sm:text-xl">
              {step.word.description}
            </span>
          }
        />
      );

    case "pairs":
    case "definitionPairs":
      return (
        <Pairs
          mode={step.mode}
          words={step.words}
          seconds={seconds}
          onDone={onDone}
        />
      );

    case "unscramble":
      return <Unscramble word={step.word} seconds={seconds} onDone={onDone} />;

    case "picture":
      return <Picture word={step.word} seconds={seconds} onDone={onDone} />;
  }
}
