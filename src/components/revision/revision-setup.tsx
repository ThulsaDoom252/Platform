"use client";

/**
 * Выдача повторения слов.
 *
 * Учитель видит слова словника и готовность каждого режима на них:
 * «по картинке — 20 из 25». Молча выбросить пять слов посреди задания
 * нельзя, поэтому счёт показан до выдачи.
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
  canStart,
  isTestMode,
  readiness,
  REVISION_MODES,
  type RevisionMode,
  type RevisionWord,
} from "@/lib/revision-modes";
import { IconCheck, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

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
  const [picked, setPicked] = useState<string[]>([]);
  const [modes, setModes] = useState<RevisionMode[]>([]);
  const [title, setTitle] = useState(nodeName);
  const [due, setDue] = useState("");
  const [perAnswer, setPerAnswer] = useState<number | null>(null);
  const [wholeMinutes, setWholeMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    revisionWordsAction(nodeId)
      .then((list) => {
        if (!alive) return;
        setWords(list);
        // По умолчанию отмечены все: снять проще, чем набрать заново.
        setPicked(list.map((w) => w.phraseId));
      })
      .catch(() => alive && setWords([]));
    return () => {
      alive = false;
    };
  }, [nodeId]);

  const chosen = useMemo(
    () => (words ?? []).filter((w) => picked.includes(w.phraseId)),
    [words, picked],
  );

  const state = useMemo(() => new Map(readiness(chosen).map((r) => [r.mode, r])), [chosen]);

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

  const ready = chosen.length > 0 && title.trim() && canStart(chosen, modes);

  function give() {
    setError(null);
    if (!canStart(chosen, modes)) {
      setError(t.revision.needTest);
      return;
    }

    startBusy(async () => {
      const minutes = Number(wholeMinutes) || 0;
      const result = await createRevisionAction({
        studentId,
        nodeId,
        title: title.trim(),
        phraseIds: picked,
        modes,
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

        {/* Слова */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-content">{t.revision.words}</span>
            <span className="text-[12px] text-faint">
              {fmt(t.revision.selected, { n: picked.length })}
            </span>
            <button
              type="button"
              onClick={() => setPicked((words ?? []).map((w) => w.phraseId))}
              className="ml-auto h-7 rounded-lg px-2 text-[11px] font-semibold text-accent transition hover:bg-surface-2"
            >
              {t.revision.allWords}
            </button>
            <button
              type="button"
              onClick={() => setPicked([])}
              className="h-7 rounded-lg px-2 text-[11px] font-semibold text-muted transition hover:bg-surface-2"
            >
              {t.revision.none}
            </button>
          </div>

          {words === null ? (
            <p className="mt-2 text-sm text-faint">{t.common.loading}</p>
          ) : (
            <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-xl bg-surface-2 p-2 sm:grid-cols-2">
              {words.map((w) => {
                const on = picked.includes(w.phraseId);
                return (
                  <label
                    key={w.phraseId}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked((prev) =>
                          on
                            ? prev.filter((id) => id !== w.phraseId)
                            : [...prev, w.phraseId],
                        )
                      }
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-content">
                      {w.word}
                    </span>
                    {/* Что у слова есть — по этому видно, каким режимам оно годится. */}
                    <span className="shrink-0 text-[10px] text-faint">
                      {w.imageUrl ? "🖼" : ""}
                      {w.description ? "📝" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Режимы */}
        <div>
          <span className="text-sm font-bold text-content">{t.revision.modes}</span>
          <p className="text-[12px] text-faint">{t.revision.modesHint}</p>

          <div className="mt-2 flex flex-col gap-1.5">
            {REVISION_MODES.map((mode) => {
              const info = state.get(mode);
              const on = modes.includes(mode);
              const at = modes.indexOf(mode);

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleMode(mode)}
                  disabled={!info?.ready}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-left ring-1 transition disabled:opacity-40",
                    on ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-transparent",
                  )}
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
                          ({t.revision.hintFlashcards.toLowerCase()})
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {MODE_HINT[mode]}
                    </span>
                  </span>

                  <span className="shrink-0 text-[11px] text-faint">
                    {info?.ready
                      ? fmt(t.revision.ready, {
                          n: info.usable,
                          total: chosen.length,
                        })
                      : t.revision.notReady}
                  </span>

                  {on && modes.length > 1 && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                      {at + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
