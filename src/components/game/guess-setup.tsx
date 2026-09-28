"use client";

/**
 * Настройка партии «Угадай по картинке».
 *
 * Словники запоминаются в том порядке, в каком их отметили: от этого
 * зависит, что пойдёт первым, если не перемешивать их между собой.
 * Поэтому выбор хранится списком, а не множеством.
 */
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  listVocabNodesAction,
  type VocabNode,
} from "@/lib/actions/phrase-images";
import {
  listGameWordsAction,
  startGameAction,
  type GameWord,
} from "@/lib/actions/guess-picture";
import { IconCheck, IconChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

export function GuessSetup({
  studentId,
  onStarted,
}: {
  studentId: string;
  onStarted: () => void;
}) {
  const { t } = useT();
  const [nodes, setNodes] = useState<VocabNode[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [openWords, setOpenWords] = useState<string | null>(null);
  const [words, setWords] = useState<Record<string, GameWord[]>>({});
  // Пусто для словника — значит все его слова. Так по умолчанию и есть.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [shuffleWords, setShuffleWords] = useState(true);
  const [shuffleDecks, setShuffleDecks] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    listVocabNodesAction()
      .then((list) => alive && setNodes(list))
      .catch(() => alive && setNodes([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!openWords || words[openWords]) return;
    let alive = true;
    listGameWordsAction(openWords)
      .then((list) => alive && setWords((prev) => ({ ...prev, [openWords]: list })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [openWords, words]);

  const toggleNode = (id: string) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));

  const toggleWord = (nodeId: string, phraseId: string) =>
    setPicked((prev) => {
      const all = (words[nodeId] ?? []).filter((w) => w.hasImage).map((w) => w.phraseId);
      // Пока ничего не трогали, считается, что выбраны все.
      const current = prev[nodeId] ?? all;
      const next = current.includes(phraseId)
        ? current.filter((id) => id !== phraseId)
        : [...current, phraseId];
      return { ...prev, [nodeId]: next };
    });

  function start() {
    setError(null);
    startBusy(async () => {
      const phraseIds = chosen.flatMap((nodeId) => picked[nodeId] ?? []);
      const result = await startGameAction({
        studentId,
        nodeIds: chosen,
        // Ничего не отбирали — значит играем всем, что есть.
        phraseIds: phraseIds.length > 0 ? phraseIds : undefined,
        shuffleWords,
        shuffleDecks,
        seconds,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onStarted();
    });
  }

  const toggle = (on: boolean, onChange: (v: boolean) => void, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-2.5">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
      />
      <span>
        <span className="block text-sm font-medium text-content">{label}</span>
        <span className="block text-[12px] text-faint">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-bold text-content">{t.game.chooseVocab}</p>
        <p className="text-[12px] text-faint">{t.game.chooseVocabHint}</p>

        {nodes === null && <p className="mt-2 text-sm text-faint">{t.common.loading}</p>}
        {nodes?.length === 0 && <p className="mt-2 text-sm text-faint">{t.game.noVocab}</p>}

        <div className="mt-2 flex flex-col gap-1.5">
          {(nodes ?? []).map((node) => {
            const at = chosen.indexOf(node.id);
            const on = at >= 0;
            const list = words[node.id] ?? [];
            const usable = list.filter((w) => w.hasImage);
            const selected = picked[node.id] ?? usable.map((w) => w.phraseId);

            return (
              <div key={node.id} className="rounded-xl bg-surface-2">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleNode(node.id)}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 transition",
                      on ? "bg-accent text-white ring-accent" : "ring-line hover:ring-accent",
                    )}
                    aria-pressed={on}
                  >
                    {on ? <IconCheck className="h-3.5 w-3.5" /> : null}
                  </button>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-content">
                      {node.icon ? `${node.icon} ` : ""}
                      {node.name}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {fmt(t.pictures.ready, { ready: node.ready, words: node.words })}
                    </span>
                  </span>

                  {/* Порядковый номер: он и определяет, что пойдёт раньше. */}
                  {on && !shuffleDecks && chosen.length > 1 && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                      {at + 1}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenWords(openWords === node.id ? null : node.id)}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-muted transition hover:bg-surface hover:text-content"
                  >
                    {picked[node.id] ? fmt(t.game.selected, { n: selected.length }) : t.game.allWords}
                    <IconChevronDown
                      className={cn("h-3 w-3 transition", openWords === node.id && "rotate-180")}
                    />
                  </button>
                </div>

                {openWords === node.id && (
                  <div className="grid gap-1 border-t border-line p-2 sm:grid-cols-2">
                    {list.length === 0 && (
                      <p className="p-1 text-[12px] text-faint">{t.common.loading}</p>
                    )}
                    {list.map((word) => {
                      const active = word.hasImage && selected.includes(word.phraseId);
                      return (
                        <label
                          key={word.phraseId}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-2 py-1",
                            word.hasImage ? "cursor-pointer hover:bg-surface" : "opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={!word.hasImage}
                            checked={active}
                            onChange={() => toggleWord(node.id, word.phraseId)}
                            className="h-3.5 w-3.5 accent-[var(--accent)]"
                          />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-content">
                            {word.word}
                          </span>
                          {!word.hasImage && (
                            <span className="shrink-0 text-[10px] text-faint">
                              {t.game.noPicture}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {toggle(shuffleWords, setShuffleWords, t.game.shuffleWords, t.game.shuffleWordsHint)}
        {toggle(shuffleDecks, setShuffleDecks, t.game.shuffleDecks, t.game.shuffleDecksHint)}
      </div>

      <label className="flex items-center gap-3">
        <span className="text-sm font-medium text-content">{t.game.seconds}</span>
        <input
          type="number"
          min={3}
          max={120}
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value) || 10)}
          className="h-9 w-20 rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:border-accent"
        />
      </label>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <button
        type="button"
        onClick={start}
        disabled={busy || chosen.length === 0}
        className="h-11 self-start rounded-xl bg-accent px-6 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t.game.starting : t.game.start}
      </button>
    </div>
  );
}
