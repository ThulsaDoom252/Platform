"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { GuessPicturePresetForm } from "@/components/game/guess-picture-studio";
import { WordDeckForm } from "@/components/game/word-deck-studio";
import { RevisionSetup, type RevisionVocabularySource } from "@/components/revision/revision-setup";
import {
  copyGuessPictureBetweenClassAndHomeworkAction,
  type GuessPicturePreset,
} from "@/lib/actions/guess-picture";
import {
  copyWordDeckBetweenClassAndHomeworkAction,
  uploadTransferredWordDeckBackgroundAction,
  type TeacherWordDeckHomeworkDetail,
  type WordDeckActivity,
} from "@/lib/actions/word-deck";
import {
  revisionSourcesForPhrasesAction,
  type TeacherRevisionHomeworkDetail,
} from "@/lib/actions/revision";

type Props =
  | { kind: "GAME"; activity: TeacherWordDeckHomeworkDetail }
  | { kind: "REVISION"; activity: TeacherRevisionHomeworkDetail };

export function HomeworkActivityTransfer(props: Props) {
  const { t } = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [revisionSources, setRevisionSources] = useState<RevisionVocabularySource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, startBusy] = useTransition();

  const open = () => {
    setError(null);
    setDone(false);
    if (props.kind === "GAME") {
      setEditing(true);
      return;
    }
    startBusy(async () => {
      const found = await revisionSourcesForPhrasesAction(props.activity.phraseIds);
      const fallback = props.activity.nodeId
        ? [{
            id: props.activity.nodeId,
            name: props.activity.nodeName ?? props.activity.title,
            path: props.activity.nodeName ?? props.activity.title,
          }]
        : [];
      const sources = found.length > 0 ? found : fallback;
      if (sources.length === 0) {
        setError(t.wordDeck.saveFailed);
        return;
      }
      setRevisionSources(sources);
      setEditing(true);
    });
  };

  const finished = () => {
    setEditing(false);
    setDone(true);
    router.refresh();
  };

  if (editing && props.kind === "REVISION" && revisionSources.length > 0) {
    const source = props.activity;
    return (
      <RevisionSetup
        purpose="COPY"
        copySourceId={source.id}
        copyDestination="CLASS"
        initial={{
          id: source.id,
          title: source.title,
          phraseIds: source.phraseIds,
          modes: source.modes,
          modeWords: source.modeWords,
          show: source.show,
          answerSeconds: source.answerSeconds,
          totalSeconds: source.totalSeconds,
        }}
        studentId={source.studentId}
        studentName={source.studentName}
        nodeId={revisionSources[0].id}
        nodeName={revisionSources[0].name}
        sources={revisionSources}
        onClose={() => { setEditing(false); setRevisionSources([]); }}
        onDone={() => { setRevisionSources([]); finished(); }}
      />
    );
  }

  if (editing && props.kind === "GAME") {
    const source = props.activity;
    const isPicture = source.settings.gameType === "GUESS_PICTURE";
    const editor = isPicture ? (
      <GuessPicturePresetForm
        preset={guessPresetFromHomework(source)}
        busy={busy}
        externalError={error}
        heading={t.activityTransfer.toClassTitle}
        submitLabel={t.activityTransfer.copyToClass}
        footerHint={t.activityTransfer.editCopyHint}
        onCancel={() => { setEditing(false); setError(null); }}
        onSave={(payload) => startBusy(async () => {
          setError(null);
          const result = await copyGuessPictureBetweenClassAndHomeworkAction(source.id, "CLASS", payload);
          if (result.error) return setError(result.error);
          finished();
        })}
      />
    ) : (
      <WordDeckForm
        activity={wordDeckFromHomework(source)}
        busy={busy}
        externalError={error}
        heading={t.activityTransfer.toClassTitle}
        submitLabel={t.activityTransfer.copyToClass}
        footerHint={t.activityTransfer.editCopyHint}
        forcedGameType={source.settings.gameType === "SPELLING" ? "SPELLING" : undefined}
        onCancel={() => { setEditing(false); setError(null); }}
        onSave={(payload, image) => startBusy(async () => {
          setError(null);
          const result = await copyWordDeckBetweenClassAndHomeworkAction(source.id, "CLASS", payload);
          if (result.error || !result.id) return setError(result.error ?? t.wordDeck.saveFailed);
          if (image) {
            const form = new FormData();
            form.set("activityId", result.id);
            form.set("image", image);
            const uploaded = await uploadTransferredWordDeckBackgroundAction(form);
            if (uploaded.error || uploaded.reason) return setError(uploaded.error ?? t.wordDeck.saveFailed);
          }
          finished();
        })}
      />
    );
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6">
        <div className="mx-auto w-full max-w-7xl">{editor}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={open}
        className="flex h-10 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-xs font-black text-white shadow-sm transition hover:bg-cyan-400 disabled:opacity-50"
      >
        🎓 {t.activityTransfer.copyToClass}
      </button>
      {done && <span className="text-[11px] font-bold text-emerald-500">✓ {t.activityTransfer.copiedToClass}</span>}
      {error && <span className="max-w-72 text-right text-[11px] font-bold text-rose-500">{error}</span>}
    </div>
  );
}

function wordDeckFromHomework(source: TeacherWordDeckHomeworkDetail): WordDeckActivity {
  return {
    id: source.id,
    title: source.title,
    nodeId: source.cards.find((card) => card.nodeId)?.nodeId ?? null,
    cards: source.cards,
    settings: source.settings,
    backgroundImageUrl: source.backgroundImageUrl,
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}

function guessPresetFromHomework(source: TeacherWordDeckHomeworkDetail): GuessPicturePreset {
  const seen = new Set<string>();
  const cards = source.cards.flatMap((card) => {
    const phraseId = card.phraseId.replace(/:(?:picture|translation)$/i, "");
    if (seen.has(phraseId)) return [];
    seen.add(phraseId);
    return [{ ...card, phraseId, promptFace: undefined }];
  });
  return {
    id: source.id,
    title: source.title,
    cards,
    mode: source.settings.guessMode,
    shuffleWords: source.settings.shuffleWords,
    shuffleDecks: source.settings.shuffleDecks,
    seconds: source.settings.cardSeconds,
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}
