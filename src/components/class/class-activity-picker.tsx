"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import {
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconGrid,
  IconPlus,
} from "@/components/icons";
import {
  GuessPicturePresetForm,
} from "@/components/game/guess-picture-studio";
import { WordDeckForm } from "@/components/game/word-deck-studio";
import {
  addGuessPicturePresetToClassAction,
  deleteGuessPicturePresetAction,
  listGuessPicturePresetsAction,
  saveGuessPicturePresetAction,
  type GuessPicturePreset,
} from "@/lib/actions/guess-picture";
import {
  addWordDeckToClassAction,
  deleteWordDeckActivityAction,
  listWordDeckActivitiesAction,
  saveWordDeckActivityAction,
  uploadWordDeckBackgroundAction,
  type WordDeckActivity,
} from "@/lib/actions/word-deck";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type GameKind = "WORD_DECK" | "GUESS_PICTURE";
type PickerStage = "CATALOG" | "WORD_PRESETS" | "GUESS_PRESETS" | "WORD_CREATE" | "GUESS_CREATE" | "SAVE_OFFER";

type PendingPreset = {
  kind: GameKind;
  id: string;
  title: string;
};

export function ClassActivityPicker({
  studentId,
  onCancel,
  onAdded,
}: {
  studentId: string;
  onCancel: () => void;
  onAdded: () => void | Promise<void>;
}) {
  const { t } = useT();
  const [stage, setStage] = useState<PickerStage>("CATALOG");
  const [wordPresets, setWordPresets] = useState<WordDeckActivity[] | null>(null);
  const [guessPresets, setGuessPresets] = useState<GuessPicturePreset[] | null>(null);
  const [pendingPreset, setPendingPreset] = useState<PendingPreset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    Promise.all([
      listWordDeckActivitiesAction(),
      listGuessPicturePresetsAction(),
    ])
      .then(([wordDecks, guesses]) => {
        if (!alive) return;
        setWordPresets(wordDecks);
        setGuessPresets(guesses);
      })
      .catch(() => {
        if (!alive) return;
        setWordPresets([]);
        setGuessPresets([]);
        setError(t.activityPicker.loadFailed);
      });
    return () => { alive = false; };
  }, [t.activityPicker.loadFailed]);

  const sortedWords = useMemo(
    () => [...(wordPresets ?? [])].sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
    [wordPresets],
  );
  const sortedGuesses = useMemo(
    () => [...(guessPresets ?? [])].sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
    [guessPresets],
  );

  const go = (next: PickerStage) => {
    setError(null);
    setStage(next);
  };

  const addExisting = (kind: GameKind, id: string) => {
    setError(null);
    startBusy(async () => {
      const result = kind === "WORD_DECK"
        ? await addWordDeckToClassAction(id, studentId)
        : await addGuessPicturePresetToClassAction(id, studentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      await onAdded();
    });
  };

  const createWordDeck = (
    payload: Parameters<typeof saveWordDeckActivityAction>[0],
    image: File | null,
  ) => {
    setError(null);
    startBusy(async () => {
      const saved = await saveWordDeckActivityAction(payload);
      if (!saved.id || saved.error) {
        setError(saved.error ?? t.wordDeck.saveFailed);
        return;
      }
      if (image) {
        const data = new FormData();
        data.set("activityId", saved.id);
        data.set("image", image);
        const uploaded = await uploadWordDeckBackgroundAction(data);
        if (uploaded.error || uploaded.reason) {
          await deleteWordDeckActivityAction(saved.id);
          setError(uploaded.error ?? t.activityPicker.backgroundFailed);
          return;
        }
      }
      const added = await addWordDeckToClassAction(saved.id, studentId);
      if (added.error) {
        await deleteWordDeckActivityAction(saved.id);
        setError(added.error);
        return;
      }
      setPendingPreset({ kind: "WORD_DECK", id: saved.id, title: payload.title });
      setStage("SAVE_OFFER");
    });
  };

  const createGuessPicture = (
    payload: Parameters<typeof saveGuessPicturePresetAction>[0],
  ) => {
    setError(null);
    startBusy(async () => {
      const saved = await saveGuessPicturePresetAction(payload);
      if (!saved.id || saved.error) {
        setError(saved.error ?? t.activityPicker.createFailed);
        return;
      }
      const added = await addGuessPicturePresetToClassAction(saved.id, studentId);
      if (added.error) {
        await deleteGuessPicturePresetAction(saved.id);
        setError(added.error);
        return;
      }
      setPendingPreset({ kind: "GUESS_PICTURE", id: saved.id, title: payload.title });
      setStage("SAVE_OFFER");
    });
  };

  const finishCreated = (keepPreset: boolean) => {
    if (!pendingPreset) return;
    setError(null);
    startBusy(async () => {
      if (!keepPreset) {
        const result = pendingPreset.kind === "WORD_DECK"
          ? await deleteWordDeckActivityAction(pendingPreset.id)
          : await deleteGuessPicturePresetAction(pendingPreset.id);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      await onAdded();
    });
  };

  if (stage === "WORD_CREATE") {
    return (
      <WordDeckForm
        activity={null}
        busy={busy}
        externalError={error}
        onCancel={() => go("WORD_PRESETS")}
        onSave={createWordDeck}
        heading={t.activityPicker.createWordDeck}
        submitLabel={t.activityPicker.createAndAdd}
        footerHint={t.activityPicker.createHint}
        includeSpellingType
      />
    );
  }

  if (stage === "GUESS_CREATE") {
    return (
      <GuessPicturePresetForm
        preset={null}
        busy={busy}
        externalError={error}
        onCancel={() => go("GUESS_PRESETS")}
        onSave={createGuessPicture}
        heading={t.activityPicker.createGuessPicture}
        submitLabel={t.activityPicker.createAndAdd}
        footerHint={t.activityPicker.createHint}
      />
    );
  }

  if (stage === "SAVE_OFFER" && pendingPreset) {
    return (
      <section className="activity-panel-in relative overflow-hidden rounded-3xl bg-surface p-5 text-center ring-1 ring-line shadow-sm sm:p-8">
        <div className="pointer-events-none absolute left-1/2 top-0 h-36 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-500 ring-1 ring-emerald-500/25">
          <IconCheckCircle className="h-8 w-8" />
        </span>
        <h2 className="relative mt-4 text-xl font-black text-content">{t.activityPicker.addedTitle}</h2>
        <p className="relative mx-auto mt-2 max-w-lg text-sm text-muted">
          {fmt(t.activityPicker.saveOffer, { title: pendingPreset.title })}
        </p>
        {error && <p className="relative mt-3 text-sm font-semibold text-rose-500">{error}</p>}
        <div className="relative mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => finishCreated(true)}
            className="rounded-2xl bg-accent px-4 py-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 motion-reduce:transition-none"
          >
            <span className="block text-sm font-black">{t.activityPicker.keepPreset}</span>
            <span className="mt-1 block text-xs text-white/75">{t.activityPicker.keepPresetHint}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finishCreated(false)}
            className="rounded-2xl bg-surface-2 px-4 py-4 text-left text-content ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent disabled:opacity-50 motion-reduce:transition-none"
          >
            <span className="block text-sm font-black">{t.activityPicker.classOnly}</span>
            <span className="mt-1 block text-xs text-faint">{t.activityPicker.classOnlyHint}</span>
          </button>
        </div>
      </section>
    );
  }

  if (stage === "WORD_PRESETS" || stage === "GUESS_PRESETS") {
    const wordDeck = stage === "WORD_PRESETS";
    const presets = wordDeck ? sortedWords : sortedGuesses;
    const loading = wordDeck ? wordPresets === null : guessPresets === null;
    return (
      <section className="activity-panel-in relative overflow-hidden rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
        <div className={cn("pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full blur-3xl", wordDeck ? "bg-violet-500/10" : "bg-cyan-500/10")} />
        <div className="relative flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => go("CATALOG")} className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent">
            <IconChevronLeft className="h-4 w-4" /> {t.wordDeck.back}
          </button>
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm", wordDeck ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-xl" : "bg-gradient-to-br from-sky-500 to-cyan-500")}>
            {wordDeck ? "♠" : <IconGrid className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-content">{wordDeck ? t.wordDeck.title : t.game.title}</h2>
            <p className="text-xs text-faint">{t.activityPicker.choosePreset}</p>
          </div>
          <button type="button" onClick={() => go(wordDeck ? "WORD_CREATE" : "GUESS_CREATE")} className={cn("flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 motion-reduce:transition-none", wordDeck ? "bg-gradient-to-r from-violet-500 to-indigo-600" : "bg-gradient-to-r from-sky-500 to-cyan-500")}>
            <IconPlus className="h-4 w-4" /> {t.activityPicker.createNew}
          </button>
        </div>

        {error && <p className="relative mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-500">{error}</p>}
        {loading ? (
          <p className="relative mt-5 text-sm text-faint">{t.common.loading}</p>
        ) : presets.length === 0 ? (
          <div className="relative mt-5 rounded-2xl border border-dashed border-line bg-surface-2/60 p-8 text-center text-sm text-faint">{t.activityPicker.noPresets}</div>
        ) : (
          <div className="relative mt-5 grid gap-3 lg:grid-cols-2">
            {presets.map((preset) => {
              const isWord = "settings" in preset;
              const cards = isWord ? preset.cards.length * preset.settings.repeats : preset.cards.length * (preset.mode === "MIXED" ? 2 : 1);
              const meta = isWord
                ? preset.settings.gameType === "GUESS_DESCRIPTION" ? t.wordDeck.guessByDescription : preset.settings.gameType === "SPELLING" ? t.wordDeck.spellingTitle : t.wordDeck.wordsGame
                : preset.mode === "PICTURE" ? t.game.modePicture : preset.mode === "TRANSLATION" ? t.game.modeTranslation : t.game.modeMixed;
              return (
                <article key={preset.id} className="rounded-2xl bg-surface-2/70 p-4 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", wordDeck ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-xl" : "bg-gradient-to-br from-sky-500 to-cyan-500")}>
                      {wordDeck ? "♠" : <IconGrid className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-content">{preset.title}</span>
                      <span className="block text-xs text-faint">{meta} · {fmt(t.wordDeck.cardCount, { n: cards })}</span>
                    </span>
                    <button type="button" disabled={busy} onClick={() => addExisting(wordDeck ? "WORD_DECK" : "GUESS_PICTURE", preset.id)} className="h-9 rounded-xl bg-accent px-3 text-xs font-black text-white transition hover:opacity-90 disabled:opacity-50">
                      {t.activityPicker.addPreset}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="activity-panel-in rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onCancel} className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent">
          <IconChevronLeft className="h-4 w-4" /> {t.wordDeck.back}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-content">{t.activityPicker.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.activityPicker.subtitle}</p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-500">{error}</p>}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <GameCard
          title={t.wordDeck.title}
          description={t.wordDeck.subtitle}
          count={wordPresets?.length}
          color="violet"
          icon={<span className="text-3xl">♠</span>}
          onClick={() => go("WORD_PRESETS")}
          presetLabel={t.activityPicker.presetsAvailable}
        />
        <GameCard
          title={t.game.title}
          description={t.game.subtitle}
          count={guessPresets?.length}
          color="cyan"
          icon={<IconGrid className="h-6 w-6" />}
          onClick={() => go("GUESS_PRESETS")}
          presetLabel={t.activityPicker.presetsAvailable}
        />
      </div>
    </section>
  );
}

function GameCard({
  title,
  description,
  count,
  color,
  icon,
  onClick,
  presetLabel,
}: {
  title: string;
  description: string;
  count: number | undefined;
  color: "violet" | "cyan";
  icon: React.ReactNode;
  onClick: () => void;
  presetLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative min-h-48 overflow-hidden rounded-3xl bg-surface-2/70 p-5 text-left ring-1 ring-line transition-all duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none",
        color === "violet" ? "hover:ring-violet-400" : "hover:ring-sky-400",
      )}
    >
      <span className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl", color === "violet" ? "bg-violet-500/15" : "bg-cyan-500/15")} />
      <span className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-200 group-hover:rotate-0 motion-reduce:transition-none", color === "violet" ? "-rotate-3 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20" : "rotate-2 bg-gradient-to-br from-sky-500 to-cyan-500 shadow-cyan-500/20")}>
        {icon}
      </span>
      <span className="relative mt-4 block text-lg font-black text-content">{title}</span>
      <span className="relative mt-1 block max-w-lg text-sm leading-relaxed text-muted">{description}</span>
      <span className="relative mt-4 flex items-center gap-2 text-xs font-black text-accent">
        {count === undefined ? "…" : `${count} · ${presetLabel}`}
        <IconChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
      </span>
    </button>
  );
}
