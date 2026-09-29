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
import {
  pairOrder,
  scrambleParts,
  type RevisionStep,
  type ScrambledPart,
} from "@/lib/revision-build";
import type { RevisionAnswer } from "@/lib/revision-score";
import type { RevisionShow, RevisionWord } from "@/lib/revision-modes";
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
  /** Что учитель разрешил показывать рядом с заданием. */
  show: RevisionShow;
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
  /** Номер попытки: меняется — отсчёт начинается заново. */
  round: number,
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
  }, [seconds, stopped, round]);

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
  show,
  onDone,
}: {
  words: RevisionWord[];
  show: RevisionShow;
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();
  const speech = useSpeech();
  const [at, setAt] = useState(0);

  const spent = useRef<number[]>(words.map(() => 0));
  const watch = useStopwatch();

  const word = words[at];

  /*
   * Карточка сама произносит слово один раз при появлении: ученик
   * должен услышать его, даже если не догадался нажать на динамик.
   * Ссылка на speak живёт в ref — сам объект речи пересобирается на
   * каждый рендер и в зависимостях гонял бы озвучку по кругу.
   */
  const say = useRef(speech.speak);
  useEffect(() => {
    say.current = speech.speak;
  });
  useEffect(() => {
    say.current(`card-${word.phraseId}`, word.word, "en-US");
  }, [word.phraseId, word.word]);

  /** Записать время на текущую карточку и начать отсчёт заново. */
  const charge = () => {
    spent.current[at] += watch.lap();
  };

  const go = (to: number) => {
    charge();
    setAt(to);
  };

  const finish = () => {
    charge();
    onDone(
      words.map((word, i) =>
        entry("flashcards", word, true, spent.current[i] ?? 0),
      ),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-[12px] font-semibold text-faint">
        {fmt(t.revision.stepOf, { n: at + 1, total: words.length })}
      </p>

      {/*
       * На карточке только английское слово. Перевод, картинка и
       * описание появляются, если учитель их включил: иначе карточка
       * отвечает сама за себя и повторять нечего.
       */}
      <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-surface p-6 text-center ring-1 ring-line shadow-sm">
        {show.cardImage && word.imageUrl && (
          <div className="w-full max-w-[220px]">
            <WordImage url={word.imageUrl} alt={word.word} />
          </div>
        )}

        <span className="flex flex-wrap items-center justify-center gap-2 text-3xl font-black leading-tight text-content sm:text-4xl">
          {word.word}
          <SpeakPair text={word.word} id={word.phraseId} speech={speech} />
        </span>

        {show.cardTranslation && word.translation && (
          <span className="text-xl font-bold text-accent">{word.translation}</span>
        )}
        {show.cardDescription && word.description && (
          <span className="text-sm text-muted">{word.description}</span>
        )}
      </div>

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

/** Сколько раз можно промахнуться, прежде чем ответ покажут. */
export const CHOICE_TRIES = 2;

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
  const { t } = useT();
  const [missed, setMissed] = useState<string[]>([]);
  const [solved, setSolved] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shakeOn, setShakeOn] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const watch = useStopwatch();
  const took = useRef(0);
  const sent = useRef(false);

  const over = solved !== null || revealed;

  /*
   * На вторую попытку отсчёт начинается заново: иначе промах на
   * четырнадцатой секунде оставляет секунду на всё про всё.
   */
  const left = useStepTimer(seconds, over, missed.length, () => {
    took.current = (seconds ?? 0) * 1000;
    setTimedOut(true);
    setRevealed(true);
    close(false, "timeout", missed.length);
  });

  /** Отдать ответ наверх — один раз, чем бы шаг ни кончился. */
  function close(right: boolean, reason: RevisionAnswer["reason"], tries: number) {
    if (sent.current) return;
    sent.current = true;
    setTimeout(
      () =>
        onDone([
          { ...entry(mode, word, right, took.current, reason), tries },
        ]),
      right ? 1000 : 1600,
    );
  }

  const pick = (option: string) => {
    if (over || missed.includes(option)) return;

    if (same(option, correct)) {
      took.current = watch.ms();
      setSolved(option);
      // Верно со второго раза — это всё-таки заминка, и учитель её увидит.
      close(missed.length === 0, missed.length === 0 ? undefined : "wrong", missed.length + 1);
      return;
    }

    const used = [...missed, option];
    setMissed(used);
    setShakeOn(true);
    setTimeout(() => setShakeOn(false), 450);

    if (used.length >= CHOICE_TRIES) {
      took.current = watch.ms();
      setRevealed(true);
      close(false, "wrong", used.length);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", shakeOn && "shake")}>
      <TimerBar left={left} total={seconds} />

      <div className="flex min-h-[22vh] items-center justify-center rounded-3xl bg-surface px-5 py-8 text-center ring-1 ring-line shadow-sm">
        {prompt}
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isRight = same(option, correct);
          const wrong = missed.includes(option);
          // Верный вариант зеленеет сам: когда его нашли или когда показали.
          const green = solved === option || (revealed && isRight);

          return (
            <button
              key={option}
              type="button"
              onClick={() => pick(option)}
              disabled={over || wrong}
              className={cn(
                "relative min-h-12 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition",
                green && "tint-green ring-transparent",
                !green && wrong && "tint-rose ring-transparent",
                !green && !wrong && over && "bg-surface-2 text-faint ring-transparent",
                !green && !wrong && !over && "bg-surface text-content ring-line hover:ring-accent",
              )}
            >
              {option}

              {/* Счастливый смайлик вылетает из угаданного варианта. */}
              {solved === option && (
                <span className="pop-emoji pointer-events-none absolute -top-1 right-3 text-2xl">
                  🎉
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Две попытки — про это надо знать заранее, а не после промаха. */}
      {!over && !timedOut && (
        <p className="text-center text-[11px] text-faint">
          {fmt(t.revision.triesLeft, { n: CHOICE_TRIES - missed.length })}
        </p>
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
  const left = useMemo(() => shuffle(words).map((w) => w.phraseId), [words]);
  const right = useMemo(() => shuffle(words).map((w) => w.phraseId), [words]);
  const wordOf = useMemo(
    () => new Map(words.map((w) => [w.phraseId, w])),
    [words],
  );

  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [out, setOut] = useState(false);

  const spent = useRef<Record<string, number>>({});
  const watch = useStopwatch();

  const full = matched.length === words.length;
  const done = out || full;
  const sent = useRef(false);
  // На группу из четырёх времени дают вчетверо: это один шаг, но четыре ответа.
  const total = seconds ? seconds * words.length : null;
  const leftMs = useStepTimer(total, done, 0, () => setOut(true));

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

  /*
   * Набор собран — значит собран. Показывать после этого «неверно» за
   * промахи по дороге незачем: ошибки уже записаны, а ученик видит
   * ровно то, что сделал.
   */
  const finish = () => {
    if (sent.current) return;
    sent.current = true;
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
  };

  const end = useRef(finish);
  useEffect(() => {
    end.current = finish;
  });
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => end.current(), full ? 650 : 1200);
    return () => clearTimeout(id);
  }, [done, full]);

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

      {/* Собранные пары поднимаются наверх в порядке, в каком их нашли. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {pairOrder(left, matched).map((id) =>
            cell(id, wordOf.get(id)!.word, "left"),
          )}
        </div>
        <div className="flex flex-col gap-2">
          {pairOrder(right, matched).map((id) =>
            cell(id, faceOf(wordOf.get(id)!), "right"),
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Собери слово                                                        */
/* ------------------------------------------------------------------ */

const UNSCRAMBLE_TRIES = 3;

/**
 * Собери слово.
 *
 * На каждое слово фразы — своя коробка с его буквами вперемешку и своя
 * строка сверху, куда они складываются. Буквы из второго слова в первую
 * строку не попадают: иначе на длинной фразе ученик собирает кашу из
 * общей кучи, а не слова.
 */
function Unscramble({
  word,
  parts: given,
  seconds,
  show,
  onDone,
}: {
  word: RevisionWord;
  /** Приходят из плана. У попыток, начатых до появления букв, их нет. */
  parts?: ScrambledPart[];
  seconds: number | null;
  show: RevisionShow;
  onDone: StepProps["onDone"];
}) {
  const { t } = useT();

  /*
   * Старый план букв не нёс: рассыпаем на месте, иначе начатая до
   * обновления попытка падает на ровном месте.
   */
  const [parts] = useState(() => given ?? scrambleParts(word.word));

  /** Что уже положено в каждую строку — индексами букв своей коробки. */
  const [placed, setPlaced] = useState<number[][]>(() => parts.map(() => []));
  const [tries, setTries] = useState(0);
  const [shakeOn, setShakeOn] = useState(false);
  const [result, setResult] = useState<"ok" | "fail" | "timeout" | null>(null);

  const watch = useStopwatch();
  const took = useRef(0);

  const left = useStepTimer(seconds, result !== null, 0, () => {
    took.current = (seconds ?? 0) * 1000;
    setResult("timeout");
  });

  const textOf = (rows: number[][]) =>
    rows.map((row, i) => row.map((at) => parts[i].letters[at]).join("")).join(" ");

  const full = (rows: number[][]) =>
    rows.every((row, i) => row.length === parts[i].letters.length);

  const add = (part: number, at: number) => {
    if (result) return;
    const next = placed.map((row, i) => (i === part ? [...row, at] : row));
    setPlaced(next);
    if (!full(next)) return;

    if (same(textOf(next), word.word)) {
      took.current = watch.ms();
      setResult("ok");
      return;
    }

    const used = tries + 1;
    setTries(used);
    setShakeOn(true);
    setTimeout(() => setShakeOn(false), 450);
    setPlaced(parts.map(() => []));
    if (used >= UNSCRAMBLE_TRIES) {
      took.current = watch.ms();
      setResult("fail");
    }
  };

  const drop = (part: number, index: number) => {
    if (result) return;
    setPlaced((prev) =>
      prev.map((row, i) => (i === part ? row.filter((_, k) => k !== index) : row)),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={seconds} />

      {/* Подсказки — только если учитель их включил. */}
      {((show.scrambleTranslation && word.translation) ||
        (show.scrambleImage && word.imageUrl)) && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-5 py-5 text-center ring-1 ring-line shadow-sm">
          {show.scrambleTranslation && word.translation && (
            <p className="text-lg font-bold text-accent">{word.translation}</p>
          )}
          {show.scrambleImage && word.imageUrl && (
            <div className="w-full max-w-[200px]">
              <WordImage url={word.imageUrl} alt="" />
            </div>
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-4", shakeOn && "shake")}>
        {parts.map((part, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            {/* Строка слова: сюда падают его буквы. */}
            <div className="flex min-h-12 flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 py-2">
              {placed[i].length === 0 ? (
                <span className="text-[11px] text-faint">
                  {fmt(t.revision.wordNo, { n: i + 1 })}
                </span>
              ) : (
                placed[i].map((at, k) => (
                  <button
                    key={`${at}-${k}`}
                    type="button"
                    onClick={() => drop(i, k)}
                    className="h-9 w-9 rounded-lg bg-accent text-sm font-bold text-white"
                  >
                    {part.letters[at]}
                  </button>
                ))
              )}
            </div>

            {/* Коробка букв этого слова. */}
            <div className="flex flex-wrap justify-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-2">
              {part.letters.map((letter, at) => (
                <button
                  key={at}
                  type="button"
                  onClick={() => add(i, at)}
                  disabled={placed[i].includes(at) || result !== null}
                  className="h-9 w-9 rounded-lg bg-surface text-sm font-bold text-content ring-1 ring-line transition hover:ring-accent disabled:opacity-20"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
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
          right={word.word}
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

/**
 * Угадай по картинке.
 *
 * Вводить нечего: ученик смотрит на картинку, вспоминает слово и
 * переворачивает карту. Написание здесь не спрашивают — это делает
 * «собери слово», а тут проверяется, всплывает ли слово вообще.
 *
 * Кто прав, решает сам ученик: машине сравнивать не с чем. Поэтому
 * после переворота он честно отвечает, знал или нет, — иначе в разборе
 * у учителя всегда стояло бы двадцать пять из двадцати пяти.
 */
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
  const [flipped, setFlipped] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const watch = useStopwatch();
  const took = useRef(0);

  const left = useStepTimer(seconds, flipped || timedOut, 0, () => {
    took.current = (seconds ?? 0) * 1000;
    setTimedOut(true);
    setFlipped(true);
  });

  const flip = () => {
    if (flipped) return;
    took.current = watch.ms();
    setFlipped(true);
  };

  const answer = (knew: boolean) =>
    onDone([
      entry(
        "picture",
        word,
        knew && !timedOut,
        took.current,
        knew && !timedOut ? undefined : timedOut ? "timeout" : "wrong",
      ),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <TimerBar left={left} total={seconds} />

      {word.imageUrl && (
        <button
          type="button"
          onClick={flip}
          disabled={flipped}
          className="w-full rounded-2xl transition disabled:cursor-default"
        >
          <WordImage url={word.imageUrl} alt="" />
        </button>
      )}

      {!flipped ? (
        <button
          type="button"
          onClick={flip}
          className="h-12 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
        >
          {t.revision.reveal}
        </button>
      ) : (
        <>
          {/* Обратная сторона: слово, звук и перевод. */}
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface px-4 py-4 text-center ring-1 ring-line">
            <span className="flex flex-wrap items-center justify-center gap-1.5 text-2xl font-black text-content">
              {word.word}
              <SpeakPair text={word.word} id={word.phraseId} speech={speech} />
            </span>
            {word.translation && (
              <span className="text-sm font-semibold text-accent">
                {word.translation}
              </span>
            )}
          </div>

          {timedOut ? (
            <>
              <p className="text-center text-sm font-bold text-rose-500">
                {t.revision.timeUp}
              </p>
              <button
                type="button"
                onClick={() => answer(false)}
                autoFocus
                className="h-12 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
              >
                {t.revision.next}
              </button>
            </>
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => answer(false)}
                className="h-12 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:border-rose-500 hover:text-rose-500"
              >
                {t.revision.didntKnow}
              </button>
              <button
                type="button"
                onClick={() => answer(true)}
                autoFocus
                className="h-12 flex-1 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90"
              >
                {t.revision.knew}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Диспетчер                                                           */
/* ------------------------------------------------------------------ */

export function RevisionStepScreen({ step, seconds, show, onDone }: StepProps) {
  const speech = useSpeech();

  switch (step.mode) {
    case "flashcards":
      return <Flashcards words={step.words} show={show} onDone={onDone} />;

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
      return (
        <Unscramble
          word={step.word}
          parts={step.parts}
          seconds={seconds}
          show={show}
          onDone={onDone}
        />
      );

    case "picture":
      return <Picture word={step.word} seconds={seconds} onDone={onDone} />;
  }
}
