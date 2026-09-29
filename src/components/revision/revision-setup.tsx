"use client";

/**
 * Выдача повторения слов.
 *
 * Секции набираются по отдельности: карточки можно дать на всём
 * словнике, а «собери слово» — на пяти трудных. Поэтому у каждого
 * режима свой список слов, а не один общий на всё задание.
 *
 * По умолчанию режим берёт всё, что ему подходит, и рядом честно
 * написано, сколько это — «по картинке: 20 из 25». Молча выбросить
 * пять слов посреди задания нельзя.
 *
 * Режимы идут в том порядке, в каком их отметили: порядок — это часть
 * задания, а не мелочь оформления.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  createRevisionAction,
  revisionWordsAction,
} from "@/lib/actions/revision";
import {
  canStartWith,
  DEFAULT_SHOW,
  isTestMode,
  modeReady,
  MIN_WORDS,
  REVISION_MODES,
  SHOW_KEYS,
  wordsFor,
  type RevisionMode,
  type RevisionShow,
  type RevisionWord,
} from "@/lib/revision-modes";
import { IconCheck, IconChevronDown, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Подписи настроек показа. Отдельно — их две группы на один словарь. */
const SHOW_LABEL = (t: ReturnType<typeof useT>["t"]): Record<keyof RevisionShow, string> => ({
  cardImage: t.revision.showImage,
  cardTranslation: t.revision.showTranslation,
  cardDescription: t.revision.showDescription,
  scrambleImage: t.revision.showImage,
  scrambleTranslation: t.revision.showTranslation,
});

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export function RevisionSetup({
  studentId,
  studentName,
  nodeId,
  nodeName,
  onClose,
  onDone,
}: {
  studentId: string;
  studentName: string;
  nodeId: string;
  nodeName: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t } = useT();
  const [words, setWords] = useState<RevisionWord[] | null>(null);
  const [modes, setModes] = useState<RevisionMode[]>([]);
  /** Снятые галочки по режимам: пусто — взяты все подходящие слова. */
  const [dropped, setDropped] = useState<Partial<Record<RevisionMode, string[]>>>({});
  const [open, setOpen] = useState<RevisionMode | null>(null);
  /** Что показывать рядом с заданием: по умолчанию ничего. */
  const [show, setShow] = useState<RevisionShow>(DEFAULT_SHOW);
  const [title, setTitle] = useState(nodeName);
  const [due, setDue] = useState("");
  const [perAnswer, setPerAnswer] = useState<number | null>(null);
  const [wholeMinutes, setWholeMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    revisionWordsAction(nodeId)
      .then((list) => alive && setWords(list))
      .catch(() => alive && setWords([]));
    return () => {
      alive = false;
    };
  }, [nodeId]);

  const all = useMemo(() => words ?? [], [words]);

  /** Что режим вообще может взять — без учёта галочек. */
  const fitting = useMemo(() => {
    const map = new Map<RevisionMode, RevisionWord[]>();
    for (const mode of REVISION_MODES) map.set(mode, wordsFor(all, mode));
    return map;
  }, [all]);

  /** Что режим возьмёт на самом деле. */
  const taken = (mode: RevisionMode): RevisionWord[] => {
    const off = new Set(dropped[mode] ?? []);
    return (fitting.get(mode) ?? []).filter((w) => !off.has(w.phraseId));
  };

  const MODE_LABEL: Record<RevisionMode, string> = {
    flashcards: t.revision.modeFlashcards,
    choose: t.revision.modeChoose,
    pairs: t.revision.modePairs,
    unscramble: t.revision.modeUnscramble,
    picture: t.revision.modePicture,
    definition: t.revision.modeDefinition,
    definitionPairs: t.revision.modeDefinitionPairs,
  };

  const MODE_HINT: Record<RevisionMode, string> = {
    flashcards: t.revision.hintFlashcards,
    choose: t.revision.hintChoose,
    pairs: t.revision.hintPairs,
    unscramble: t.revision.hintUnscramble,
    picture: t.revision.hintPicture,
    definition: t.revision.hintDefinition,
    definitionPairs: t.revision.hintDefinitionPairs,
  };

  const toggleMode = (mode: RevisionMode) =>
    setModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );

  const toggleWord = (mode: RevisionMode, phraseId: string) =>
    setDropped((prev) => {
      const off = prev[mode] ?? [];
      return {
        ...prev,
        [mode]: off.includes(phraseId)
          ? off.filter((id) => id !== phraseId)
          : [...off, phraseId],
      };
    });

  /** «Взять N» — оставить первые N по порядку словника, остальные снять. */
  const takeFirst = (mode: RevisionMode, n: number) => {
    const list = fitting.get(mode) ?? [];
    const keep = Math.max(0, Math.min(n, list.length));
    setDropped((prev) => ({
      ...prev,
      [mode]: list.slice(keep).map((w) => w.phraseId),
    }));
  };

  const ready =
    all.length > 0 && title.trim() && canStartWith((mode) => taken(mode), modes);

  function give() {
    setError(null);
    if (!canStartWith((mode) => taken(mode), modes)) {
      setError(t.revision.needTest);
      return;
    }

    startBusy(async () => {
      const modeWords: Record<string, string[]> = {};
      const union = new Set<string>();
      for (const mode of modes) {
        const ids = taken(mode).map((w) => w.phraseId);
        modeWords[mode] = ids;
        for (const id of ids) union.add(id);
      }

      const minutes = Number(wholeMinutes) || 0;
      const result = await createRevisionAction({
        studentId,
        nodeId,
        title: title.trim(),
        phraseIds: [...union],
        modes,
        modeWords,
        show,
        answerSeconds: perAnswer,
        totalSeconds: minutes > 0 ? minutes * 60 : null,
        dueAt: due ? new Date(due).toISOString() : null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      onClose();
    });
  }

  /*
   * Грубая прикидка длины задания. Пять минут на семь секций по
   * двадцать пять слов — это не строгий срок, а гарантированный обрыв
   * на середине, и увидеть это надо до выдачи, а не по результату.
   */
  const steps = modes.reduce((sum, mode) => sum + taken(mode).length, 0);
  const estimate = Math.max(1, Math.ceil((steps * (perAnswer ?? 8)) / 60));
  const whole = Number(wholeMinutes) || 0;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${t.revision.assign} — ${studentName}`}
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="text-sm font-medium text-content">{t.revision.name}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.revision.namePlaceholder}
            className={`${inputCls} mt-1.5`}
          />
        </label>

        <div>
          <span className="text-sm font-bold text-content">{t.revision.modes}</span>
          <p className="text-[12px] text-faint">{t.revision.modesHint}</p>

          {words === null ? (
            <p className="mt-2 text-sm text-faint">{t.common.loading}</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {REVISION_MODES.map((mode) => {
                const pool = fitting.get(mode) ?? [];
                const list = taken(mode);
                const on = modes.includes(mode);
                const at = modes.indexOf(mode);
                const works = modeReady(list, mode);
                const expanded = open === mode;

                return (
                  <div
                    key={mode}
                    className={cn(
                      "rounded-xl ring-1 transition",
                      on ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-transparent",
                      pool.length < MIN_WORDS[mode] && "opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleMode(mode)}
                        disabled={pool.length < MIN_WORDS[mode]}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1",
                            on ? "bg-accent text-white ring-accent" : "ring-line",
                          )}
                        >
                          {on && <IconCheck className="h-3 w-3" />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-[13px] font-semibold",
                              on ? "text-accent" : "text-content",
                            )}
                          >
                            {MODE_LABEL[mode]}
                            {!isTestMode(mode) && (
                              <span className="ml-1.5 text-[10px] font-normal text-faint">
                                ({t.revision.noScore})
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-faint">
                            {MODE_HINT[mode]}
                          </span>
                        </span>
                      </button>

                      {/* Сколько слов возьмёт режим — видно до выдачи. */}
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-semibold",
                          works ? "text-faint" : "text-rose-500",
                        )}
                      >
                        {works
                          ? fmt(t.revision.ready, { n: list.length, total: pool.length })
                          : t.revision.notReady}
                      </span>

                      {on && (
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : mode)}
                          className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-[11px] font-semibold text-accent transition hover:bg-surface"
                        >
                          {t.revision.pickWords}
                          <IconChevronDown
                            className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")}
                          />
                        </button>
                      )}

                      {on && modes.length > 1 && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                          {at + 1}
                        </span>
                      )}
                    </div>

                    {on && expanded && (
                      <div className="border-t border-line px-3 py-2.5">
                        {/* Подсказки режима: перевод рядом с заданием его обнуляет. */}
                        {SHOW_KEYS[mode] && (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-faint">
                              {t.revision.showAlso}
                            </span>
                            {SHOW_KEYS[mode]!.map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() =>
                                  setShow((prev) => ({ ...prev, [key]: !prev[key] }))
                                }
                                className={cn(
                                  "h-7 rounded-lg px-2 text-[11px] font-semibold transition",
                                  show[key]
                                    ? "bg-accent text-white"
                                    : "bg-surface text-muted hover:text-content",
                                )}
                              >
                                {SHOW_LABEL(t)[key]}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDropped((prev) => ({ ...prev, [mode]: [] }))}
                            className="h-7 rounded-lg bg-surface px-2 text-[11px] font-semibold text-accent transition hover:opacity-80"
                          >
                            {t.revision.allWords}
                          </button>
                          <label className="flex items-center gap-1.5">
                            <span className="text-[11px] text-faint">
                              {t.revision.takeFirst}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={pool.length}
                              value={list.length}
                              onChange={(e) => takeFirst(mode, Number(e.target.value))}
                              className="h-7 w-16 rounded-lg border border-line bg-surface px-2 text-[12px] text-content outline-none focus:border-accent"
                            />
                            <span className="text-[11px] text-faint">
                              {fmt(t.revision.outOf, { total: pool.length })}
                            </span>
                          </label>
                        </div>

                        <div className="mt-2 grid max-h-44 gap-0.5 overflow-y-auto rounded-lg bg-surface p-1.5 sm:grid-cols-2">
                          {pool.map((w) => {
                            const off = (dropped[mode] ?? []).includes(w.phraseId);
                            return (
                              <label
                                key={w.phraseId}
                                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={!off}
                                  onChange={() => toggleWord(mode, w.phraseId)}
                                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                                />
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-[12px]",
                                    off ? "text-faint line-through" : "text-content",
                                  )}
                                >
                                  {w.word}
                                </span>
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
          )}
        </div>

        {/* Время и срок */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-sm font-medium text-content">{t.revision.timing}</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(
                [
                  [null, t.revision.noLimit],
                  [15, t.revision.easy],
                  [10, t.revision.hard],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPerAnswer(value)}
                  className={cn(
                    "h-8 rounded-lg px-2.5 text-[12px] font-semibold transition",
                    perAnswer === value
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-muted hover:text-content",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={180}
              value={wholeMinutes}
              onChange={(e) => setWholeMinutes(e.target.value)}
              placeholder={t.revision.whole}
              className={`${inputCls} mt-2`}
            />
            {steps > 0 && (
              <p
                className={cn(
                  "mt-1.5 text-[11px]",
                  whole > 0 && whole < estimate
                    ? "font-semibold text-rose-500"
                    : "text-faint",
                )}
              >
                {fmt(t.revision.estimate, { minutes: estimate })}
                {whole > 0 && whole < estimate && ` — ${t.revision.tooShort}`}
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-content">{t.revision.due}</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={`${inputCls} mt-1.5`}
            />
          </label>
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            <IconX className="mr-1 inline h-4 w-4" />
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={give}
            disabled={busy || !ready}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t.revision.giving : t.revision.give}
          </button>
        </div>
      </div>
    </Modal>
  );
}
