"use client";

/**
 * Активности на урок.
 *
 * Это очередь, а не одна игра: их выставляют заранее, одну за другой, и
 * они никуда не пропадают — приготовленные ждут своего часа,
 * законченные остаются с итогом, пока учитель их не уберёт.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { showGameToStudentAction } from "@/lib/actions/class";
import {
  clearClassActivitiesAction,
  duplicateClassActivitiesAction,
  listGamesAction,
  pauseGameAction,
  playGameAction,
  removeGameAction,
  updateClassGuessPictureGameAction,
  type GameMode,
  type GuessPicturePreset,
  type QueuedGame,
} from "@/lib/actions/guess-picture";
import {
  twisterStudentsAction,
  type TwisterStudent,
} from "@/lib/actions/tongue-twisters";
import { GuessPlay } from "@/components/game/guess-play";
import { GuessPicturePresetForm } from "@/components/game/guess-picture-studio";
import { GameStatsCard } from "@/components/game/game-stats";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import { WordDeckForm } from "@/components/game/word-deck-studio";
import { ClassActivityPicker } from "@/components/class/class-activity-picker";
import {
  listClassWordDeckActivitiesAction,
  removeWordDeckFromClassAction,
  updateClassWordDeckActivityAction,
  uploadClassWordDeckBackgroundAction,
  type ClassWordDeckActivity,
  type WordDeckActivity,
} from "@/lib/actions/word-deck";
import {
  deleteRevisionAction,
  listClassRevisionsAction,
  reopenRevisionAction,
  revisionSourcesForPhrasesAction,
  showRevisionToStudentAction,
  type RevisionCard,
} from "@/lib/actions/revision";
import { RevisionAttempts } from "@/components/revision/revision-teacher-list";
import { RevisionSetup, type RevisionVocabularySource } from "@/components/revision/revision-setup";
import { IconGrip, IconPencil, IconPlus, IconTrash, IconUser, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  listClassActivityMetaAction,
  saveClassActivityOrderAction,
  setClassGameAnswerVisibilityAction,
} from "@/lib/actions/class-games";
import { classActivityKey, type ClassActivityMeta, type ClassGameReview } from "@/lib/class-game-meta";
import {
  ClassGameReviewBadge,
  ClassGameReviewEditor,
} from "@/components/class/class-game-review";

type ActivityItem =
  | { key: string; kind: "REVISION"; revision: RevisionCard; createdAt: string }
  | { key: string; kind: "DECK"; deck: ClassWordDeckActivity; createdAt: string }
  | { key: string; kind: "PICTURE"; game: QueuedGame; createdAt: string };

export function ClassActivities({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [queue, setQueue] = useState<QueuedGame[] | null>(null);
  const [decks, setDecks] = useState<ClassWordDeckActivity[] | null>(null);
  const [revisions, setRevisions] = useState<RevisionCard[] | null>(null);
  const [meta, setMeta] = useState<ClassActivityMeta>({ order: [], settings: {}, reviews: {} });
  const [dragging, setDragging] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ key: string; title: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDeck, setOpenDeck] = useState<ClassWordDeckActivity | null>(null);
  const [editingDeck, setEditingDeck] = useState<ClassWordDeckActivity | null>(null);
  const [editingGame, setEditingGame] = useState<QueuedGame | null>(null);
  const [editingRevision, setEditingRevision] = useState<RevisionCard | null>(null);
  const [revisionSources, setRevisionSources] = useState<RevisionVocabularySource[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [focusedDeckId, setFocusedDeckId] = useState<string | null>(null);
  const [focusedRevisionId, setFocusedRevisionId] = useState<string | null>(null);
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [students, setStudents] = useState<TwisterStudent[]>([]);
  const [copyTarget, setCopyTarget] = useState("");
  const [busy, startBusy] = useTransition();
  /** Не удалось позвать ученика — говорим об этом на месте. */
  const [showError, setShowError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [rows, wordDecks, wordRevisions, activityMeta] = await Promise.all([
      listGamesAction(studentId),
      listClassWordDeckActivitiesAction(studentId),
      listClassRevisionsAction(studentId),
      listClassActivityMetaAction(studentId),
    ]);
    setQueue(rows);
    setDecks(wordDecks);
    setRevisions(wordRevisions);
    setMeta(activityMeta);
    return rows;
  }, [studentId]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listGamesAction(studentId),
      listClassWordDeckActivitiesAction(studentId),
      listClassRevisionsAction(studentId),
      listClassActivityMetaAction(studentId),
    ])
      .then(([rows, wordDecks, wordRevisions, activityMeta]) => {
        if (!alive) return;
        setQueue(rows);
        setDecks(wordDecks);
        setRevisions(wordRevisions);
        setMeta(activityMeta);
      })
      .catch(() => {
        if (!alive) return;
        setQueue([]);
        setDecks([]);
        setRevisions([]);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  const modeLabel: Record<GameMode, string> = {
    PICTURE: t.game.modePicture,
    TRANSLATION: t.game.modeTranslation,
    MIXED: t.game.modeMixed,
  };
  const hasActivities = (queue?.length ?? 0) + (decks?.length ?? 0) + (revisions?.length ?? 0) > 0;
  const activityItems = useMemo(() => {
    const items: ActivityItem[] = [
      ...(revisions ?? []).map((revision): ActivityItem => ({
        key: classActivityKey("revision", revision.id),
        kind: "REVISION",
        revision,
        createdAt: revision.createdAt,
      })),
      ...(decks ?? []).map((deck): ActivityItem => ({
        key: classActivityKey("game", deck.id),
        kind: "DECK",
        deck,
        createdAt: deck.createdAt,
      })),
      ...(queue ?? []).map((game): ActivityItem => ({
        key: classActivityKey("game", game.id),
        kind: "PICTURE",
        game,
        createdAt: game.createdAt,
      })),
    ];
    const order = new Map(meta.order.map((key, index) => [key, index]));
    return items.sort((a, b) =>
      (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [decks, meta.order, queue, revisions]);

  const saveOrder = (order: string[]) => {
    setMeta((current) => ({ ...current, order }));
    startBusy(async () => {
      const saved = await saveClassActivityOrderAction(studentId, order);
      setMeta((current) => ({ ...current, order: saved.order }));
    });
  };

  const moveActivity = (from: string, to: string) => {
    if (from === to) return;
    const order = activityItems.map((item) => item.key);
    const fromIndex = order.indexOf(from);
    const toIndex = order.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, from);
    setMeta((current) => ({ ...current, order }));
  };

  const moveActivityBy = (key: string, delta: number) => {
    const order = activityItems.map((item) => item.key);
    const index = order.indexOf(key);
    const target = Math.max(0, Math.min(order.length - 1, index + delta));
    if (index < 0 || index === target) return;
    order.splice(index, 1);
    order.splice(target, 0, key);
    saveOrder(order);
  };

  const updateReview = (review: ClassGameReview) => {
    setMeta((current) => ({
      ...current,
      reviews: { ...current.reviews, [review.activityKey]: review },
    }));
  };

  const openCopy = () => {
    setCopying(true);
    setCopyTarget("");
    setShowError(null);
    if (students.length === 0) {
      void twisterStudentsAction().then((rows) => setStudents(rows.filter((row) => row.id !== studentId)));
    }
  };

  if (adding) {
    return (
      <ClassActivityPicker
        studentId={studentId}
        onCancel={() => setAdding(false)}
        onAdded={async () => {
          setAdding(false);
          await reload();
        }}
      />
    );
  }

  if (editingDeck) {
    const editable: WordDeckActivity = {
      id: editingDeck.id,
      title: editingDeck.title,
      nodeId: editingDeck.cards.find((card) => card.nodeId)?.nodeId ?? null,
      cards: editingDeck.cards,
      settings: editingDeck.settings,
      backgroundImageUrl: editingDeck.backgroundImageUrl,
      createdAt: editingDeck.createdAt,
      updatedAt: editingDeck.createdAt,
    };
    return (
      <WordDeckForm
        activity={editable}
        busy={busy}
        externalError={editError}
        heading={t.wordDeck.edit}
        submitLabel={t.wordDeck.save}
        footerHint={t.game.snapshotHint}
        forcedGameType={editingDeck.settings.gameType === "SPELLING" ? "SPELLING" : undefined}
        onCancel={() => { setEditingDeck(null); setEditError(null); }}
        onSave={(payload, image) => startBusy(async () => {
          setEditError(null);
          const result = await updateClassWordDeckActivityAction(editingDeck.id, payload);
          if (result.error) return setEditError(result.error);
          if (image) {
            const form = new FormData();
            form.set("activityId", editingDeck.id);
            form.set("image", image);
            const uploaded = await uploadClassWordDeckBackgroundAction(form);
            if (uploaded.error || uploaded.reason) {
              return setEditError(uploaded.error ?? t.wordDeck.saveFailed);
            }
          }
          setEditingDeck(null);
          await reload();
        })}
      />
    );
  }

  if (editingGame) {
    const preset: GuessPicturePreset = {
      id: editingGame.id,
      title: editingGame.title ?? t.game.title,
      cards: editingGame.cards,
      mode: editingGame.mode,
      shuffleWords: editingGame.shuffleWords,
      shuffleDecks: editingGame.shuffleDecks,
      seconds: editingGame.seconds,
      createdAt: editingGame.createdAt,
      updatedAt: editingGame.createdAt,
    };
    return (
      <GuessPicturePresetForm
        preset={preset}
        busy={busy}
        externalError={editError}
        heading={t.wordDeck.edit}
        submitLabel={t.wordDeck.save}
        footerHint={t.game.snapshotHint}
        onCancel={() => { setEditingGame(null); setEditError(null); }}
        onSave={(payload) => startBusy(async () => {
          setEditError(null);
          const result = await updateClassGuessPictureGameAction(editingGame.id, payload);
          if (result.error) return setEditError(result.error);
          setEditingGame(null);
          await reload();
        })}
      />
    );
  }

  if (editingRevision && revisionSources.length > 0) {
    return (
      <RevisionSetup
        purpose="CLASS_EDIT"
        initial={{
          id: editingRevision.id,
          title: editingRevision.title,
          phraseIds: editingRevision.phraseIds,
          modes: editingRevision.modes,
          modeWords: editingRevision.modeWords,
          show: editingRevision.show,
          answerSeconds: editingRevision.answerSeconds,
          totalSeconds: editingRevision.totalSeconds,
        }}
        studentId={studentId}
        studentName=""
        nodeId={revisionSources[0].id}
        nodeName={revisionSources[0].name}
        sources={revisionSources}
        onClose={() => { setEditingRevision(null); setRevisionSources([]); }}
        onDone={async () => {
          setEditingRevision(null);
          setRevisionSources([]);
          await reload();
        }}
      />
    );
  }

  if (openId) {
    const key = classActivityKey("game", openId);
    const game = queue?.find((item) => item.id === openId);
    const title = game?.title || t.game.title;
    return (
      <>
        <GuessPlay
          gameId={openId}
          studentId={studentId}
          onBack={() => {
            setOpenId(null);
            void reload();
          }}
          onChanged={() => void reload()}
          teacherSeesAnswers={meta.settings[key]?.teacherSeesAnswers === true}
          reviewEditor={(
            <button type="button" onClick={() => setReviewing({ key, title })} className="h-11 w-full rounded-2xl bg-accent text-sm font-black text-white shadow-lg transition hover:brightness-110">
              {meta.reviews[key] ? t.classRoom.editGameGrade : t.classRoom.gradeGame}
            </button>
          )}
        />
        {reviewing && (
          <ClassGameReviewEditor
            studentId={studentId}
            activityKey={reviewing.key}
            title={reviewing.title}
            initial={meta.reviews[reviewing.key]}
            onSaved={updateReview}
            onClose={() => setReviewing(null)}
          />
        )}
      </>
    );
  }

  if (openDeck) {
    const key = classActivityKey("game", openDeck.id);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpenDeck(null)} className="text-[12px] font-semibold text-muted transition hover:text-content">
            ← {t.wordDeck.back}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => startBusy(async () => {
              const result = await showGameToStudentAction(openDeck.id);
              setShowError(result.error ?? null);
              if (!result.error) setFocusedDeckId(openDeck.id);
            })}
            className={cn(
              "ml-auto flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50",
              focusedDeckId === openDeck.id
                ? "bg-amber-400 text-slate-950"
                : "bg-accent text-white hover:opacity-90",
            )}
          >
            <IconUser className="h-4 w-4" />
            {focusedDeckId === openDeck.id
              ? t.classRoom.studentFocusedOnGame
              : t.classRoom.sendStudentToGame}
          </button>
        </div>
        {showError && <p className="text-sm font-semibold text-rose-500">{showError}</p>}
        <WordDeckBoard
          key={openDeck.id}
          activity={openDeck}
          compact
          live
          teacherSeesAnswers={meta.settings[key]?.teacherSeesAnswers === true}
          reviewEditor={(
            <button type="button" onClick={() => setReviewing({ key, title: openDeck.title })} className="h-11 w-full rounded-2xl bg-white text-sm font-black text-slate-950 shadow-lg transition hover:scale-[1.01]">
              {meta.reviews[key] ? t.classRoom.editGameGrade : t.classRoom.gradeGame}
            </button>
          )}
        />
        {reviewing && (
          <ClassGameReviewEditor
            studentId={studentId}
            activityKey={reviewing.key}
            title={reviewing.title}
            initial={meta.reviews[reviewing.key]}
            onSaved={updateReview}
            onClose={() => setReviewing(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-content">{t.game.queue}</span>
        {hasActivities && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => startBusy(async () => {
                const result = await clearClassActivitiesAction(studentId);
                setShowError(result.error ?? null);
                await reload();
              })}
              className="h-9 rounded-xl px-3 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
            >
              {t.classRoom.clearSection}
            </button>
            <button
              type="button"
              onClick={openCopy}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-bold text-content ring-1 ring-line transition hover:ring-accent"
            >
              <IconUser className="h-4 w-4" /> {t.classRoom.duplicateForStudent}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> {t.game.add}
        </button>
      </div>

      {(queue === null || decks === null || revisions === null) && <p className="text-sm text-faint">{t.common.loading}</p>}

      {queue?.length === 0 && decks?.length === 0 && revisions?.length === 0 && (
        <div className="rounded-2xl bg-surface-2 p-6 text-center">
          <p className="text-sm font-semibold text-content">{t.game.queueEmpty}</p>
          <p className="mt-1 text-[12px] text-faint">{t.game.subtitle}</p>
        </div>
      )}

      {hasActivities && <p className="flex items-center gap-2 text-[11px] font-semibold text-faint"><IconGrip className="h-3.5 w-3.5" /> {t.classRoom.activityDragHint}</p>}
      {showError && <p className="text-sm text-rose-500">{showError}</p>}

      <div className="flex flex-col gap-2">
        {activityItems.map((item, itemIndex) => {
          const review = meta.reviews[item.key];
          const answerEligible = item.kind === "PICTURE" || (
            item.kind === "DECK" && ["WORDS", "GUESS_DESCRIPTION", "GUESS_PICTURE"].includes(item.deck.settings.gameType)
          );
          const finished = item.kind === "PICTURE"
            ? item.game.status === "DONE"
            : item.kind === "REVISION"
              ? item.revision.attempts > 0
              : Boolean(item.deck.liveState && item.deck.liveState.at >= item.deck.liveState.deck.length - 1 && (
                  !["GUESS_DESCRIPTION", "GUESS_PICTURE"].includes(item.deck.settings.gameType) || item.deck.liveState.faceUp
                ));

          return (
            <div
              key={item.key}
              draggable
              onDragStart={() => setDragging(item.key)}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragging) moveActivity(dragging, item.key);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const order = activityItems.map((activity) => activity.key);
                setDragging(null);
                saveOrder(order);
              }}
              onDragEnd={() => setDragging(null)}
              className={cn(
                "rounded-2xl bg-surface p-3 ring-1 transition duration-200",
                dragging === item.key ? "scale-[.985] opacity-55 ring-accent" : "ring-line",
                item.kind === "PICTURE" && item.game.status === "RUNNING" && !item.game.paused && "ring-accent",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-content active:cursor-grabbing" title={t.classRoom.activityDragHint}>
                  <IconGrip className="h-4 w-4" />
                </span>
                <span className="flex flex-col gap-0.5 sm:hidden">
                  <button type="button" disabled={itemIndex === 0} onClick={() => moveActivityBy(item.key, -1)} className="h-4 px-1 text-[10px] text-faint disabled:opacity-20">▲</button>
                  <button type="button" disabled={itemIndex === activityItems.length - 1} onClick={() => moveActivityBy(item.key, 1)} className="h-4 px-1 text-[10px] text-faint disabled:opacity-20">▼</button>
                </span>

                {item.kind === "REVISION" ? (
                  <>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">🧠</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-content">{item.revision.title}</span>
                      <span className="block text-[11px] text-faint">{fmt(t.revision.selected, { n: item.revision.words })} · {item.revision.attempts > 0 ? fmt(t.revision.attemptsDone, { n: item.revision.attempts }) : t.revision.notDone}</span>
                    </span>
                    {item.revision.attempts > 0 && <button type="button" onClick={() => setOpenRevisionId(openRevisionId === item.revision.id ? null : item.revision.id)} className="h-9 rounded-xl bg-surface-2 px-3 text-xs font-bold text-content transition hover:text-accent">{t.revision.results}</button>}
                    {!item.revision.open && <button type="button" disabled={busy} onClick={() => startBusy(async () => { await reopenRevisionAction(item.revision.id, true); await reload(); })} className="h-9 rounded-xl border border-line px-3 text-xs font-bold text-content transition hover:border-accent hover:text-accent disabled:opacity-50">{t.revision.reopen}</button>}
                    <button type="button" disabled={busy} onClick={() => startBusy(async () => {
                      const found = await revisionSourcesForPhrasesAction(item.revision.phraseIds);
                      const fallback = item.revision.nodeId ? [{ id: item.revision.nodeId, name: item.revision.nodeName ?? item.revision.title, path: item.revision.nodeName ?? item.revision.title }] : [];
                      const nextSources = found.length > 0 ? found : fallback;
                      if (nextSources.length === 0) return setShowError(t.wordDeck.saveFailed);
                      setRevisionSources(nextSources); setEditingRevision(item.revision);
                    })} title={t.wordDeck.edit} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint transition hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-50"><IconPencil className="h-4 w-4" /></button>
                    <button type="button" disabled={busy || !item.revision.open} onClick={() => startBusy(async () => {
                      const result = await showRevisionToStudentAction(item.revision.id); setShowError(result.error ?? null); if (!result.error) setFocusedRevisionId(item.revision.id);
                    })} className={cn("flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50", focusedRevisionId === item.revision.id ? "bg-amber-400 text-slate-950" : "bg-emerald-500 text-white hover:bg-emerald-400")}>
                      <IconUser className="h-4 w-4" />{focusedRevisionId === item.revision.id ? t.classRoom.studentFocusedOnGame : t.classRoom.sendStudentToGame}
                    </button>
                    <button type="button" disabled={busy} onClick={() => { if (!confirm(t.revision.removeConfirm)) return; startBusy(async () => { await deleteRevisionAction(item.revision.id); await reload(); }); }} title={t.revision.remove} className="flex h-9 w-9 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>
                  </>
                ) : item.kind === "DECK" ? (
                  <>
                    <button type="button" onClick={() => setOpenDeck(item.deck)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-11 w-9 shrink-0 -rotate-3 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-violet-600 text-lg text-white shadow">♠</span>
                      <span className="min-w-0"><span className="block truncate text-[13px] font-bold text-content">{item.deck.title}</span><span className="block text-[11px] text-faint">{fmt(t.wordDeck.cardCount, { n: item.deck.cards.length * item.deck.settings.repeats })}</span></span>
                    </button>
                    <button type="button" onClick={() => setOpenDeck(item.deck)} className="h-9 rounded-xl bg-accent-soft px-3 text-xs font-bold text-accent">{t.wordDeck.play}</button>
                    <button type="button" disabled={busy} onClick={() => { setEditError(null); setEditingDeck(item.deck); }} title={t.wordDeck.edit} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint transition hover:border-accent hover:text-accent disabled:opacity-50"><IconPencil className="h-4 w-4" /></button>
                    <button type="button" disabled={busy} onClick={() => { if (!confirm(t.wordDeck.removeFromClassConfirm)) return; startBusy(async () => { await removeWordDeckFromClassAction(item.deck.id); await reload(); }); }} title={t.wordDeck.removeFromClass} className="flex h-9 w-9 items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setOpenId(item.game.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-bold text-content">{item.game.title || t.game.title}</span>
                      <span className="block text-[11px] text-faint">{modeLabel[item.game.mode]} · {fmt(t.game.cardOf, { at: item.game.status === "DONE" ? item.game.total : item.game.at + 1, total: item.game.total })}</span>
                    </button>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", item.game.status === "DONE" ? "bg-surface-2 text-faint" : item.game.status === "RUNNING" && !item.game.paused ? "tint-green" : "tint-amber")}>{item.game.status === "DONE" ? t.game.finished : item.game.status === "RUNNING" ? item.game.paused ? t.game.paused : t.game.running : t.game.ready}</span>
                    {item.game.status === "RUNNING" && <button type="button" disabled={busy} onClick={() => startBusy(async () => { const result = await showGameToStudentAction(); setShowError(result.error ?? null); })} title={t.classRoom.sendStudentToGame} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-accent disabled:opacity-50"><IconUser className="h-4 w-4" /></button>}
                    {item.game.status !== "DONE" && <button type="button" disabled={busy} onClick={() => startBusy(async () => {
                      await (item.game.status === "RUNNING" && !item.game.paused ? pauseGameAction(item.game.id) : playGameAction(item.game.id)); await reload(); if (item.game.paused || item.game.status !== "RUNNING") setOpenId(item.game.id);
                    })} title={item.game.status === "RUNNING" && !item.game.paused ? t.game.pause : t.game.play} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition hover:opacity-90 disabled:opacity-50">{item.game.status === "RUNNING" && !item.game.paused ? "❚❚" : "▶"}</button>}
                    <button type="button" disabled={busy} onClick={() => { setEditError(null); setEditingGame(item.game); }} title={t.wordDeck.edit} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-faint transition hover:border-accent hover:text-accent disabled:opacity-50"><IconPencil className="h-4 w-4" /></button>
                    <button type="button" disabled={busy} onClick={() => { if (!confirm(t.game.removeConfirm)) return; startBusy(async () => { await removeGameAction(item.game.id); await reload(); }); }} title={t.game.remove} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>
                  </>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/70 pt-2">
                {answerEligible && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[11px] font-bold text-content">
                    <input type="checkbox" checked={meta.settings[item.key]?.teacherSeesAnswers === true} onChange={(event) => {
                      const enabled = event.target.checked;
                      setMeta((current) => ({ ...current, settings: { ...current.settings, [item.key]: { teacherSeesAnswers: enabled } } }));
                      startBusy(async () => { const result = await setClassGameAnswerVisibilityAction(studentId, item.key, enabled); if (result.error) setShowError(result.error); });
                    }} className="h-4 w-4 accent-[var(--accent)]" />
                    👁 {t.classRoom.teacherSeesAnswers}
                  </label>
                )}
                {review && <ClassGameReviewBadge review={review} />}
                {(finished || review) && <button type="button" onClick={() => setReviewing({ key: item.key, title: item.kind === "REVISION" ? item.revision.title : item.kind === "DECK" ? item.deck.title : item.game.title || t.game.title })} className="ml-auto h-9 rounded-xl bg-accent px-3 text-xs font-black text-white transition hover:brightness-110">{review ? t.classRoom.editGameGrade : t.classRoom.gradeGame}</button>}
              </div>

              {item.kind === "REVISION" && openRevisionId === item.revision.id && <RevisionAttempts revisionId={item.revision.id} />}
              {item.kind === "PICTURE" && (item.game.status === "DONE" || item.game.stats.answered > 0) && <div className="mt-2"><GameStatsCard stats={item.game.stats} compact /></div>}
            </div>
          );
        })}
      </div>

      {reviewing && (
        <ClassGameReviewEditor
          studentId={studentId}
          activityKey={reviewing.key}
          title={reviewing.title}
          initial={meta.reviews[reviewing.key]}
          onSaved={updateReview}
          onClose={() => setReviewing(null)}
        />
      )}

      {copying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => event.target === event.currentTarget && setCopying(false)}>
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
            <div className="flex items-center gap-3">
              <h3 className="flex-1 font-black text-content">{t.classRoom.duplicateTitle}</h3>
              <button type="button" onClick={() => setCopying(false)}><IconX className="h-4 w-4 text-muted" /></button>
            </div>
            <select value={copyTarget} onChange={(event) => setCopyTarget(event.target.value)} className="mt-4 h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-content ring-1 ring-line outline-none focus:ring-accent">
              <option value="">{t.classRoom.chooseStudent}</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <button
              type="button"
              disabled={!copyTarget || busy}
              onClick={() => startBusy(async () => {
                const result = await duplicateClassActivitiesAction(studentId, copyTarget);
                if (result.error) {
                  setShowError(result.error);
                  return;
                }
                setCopying(false);
              })}
              className="mt-4 h-10 w-full rounded-xl bg-accent text-sm font-black text-white disabled:opacity-40"
            >
              {t.classRoom.duplicate}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
