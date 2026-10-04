"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  addWordDeckToClassAction,
  assignWordDeckHomeworkAction,
  deleteWordDeckActivityAction,
  listWordDeckActivitiesAction,
  listWordDeckStudentsAction,
  listWordDeckVocabGroupsAction,
  saveWordDeckActivityAction,
  uploadWordDeckBackgroundAction,
  type WordDeckActivity,
  type WordDeckStudent,
  type WordDeckVocabGroup,
} from "@/lib/actions/word-deck";
import {
  listCopyTargetsAction,
  type CopyNode,
  type CopyTree,
} from "@/lib/actions/materials";
import {
  DEFAULT_WORD_DECK_SETTINGS,
  MIN_WORD_DECK_WORDS,
  normalizeWordDeckSettings,
  randomWordDeckPercentage,
  suggestedWordDeckTitle,
  type WordDeckBackground,
  type WordDeckSettings,
} from "@/lib/word-deck";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
  IconX,
} from "@/components/icons";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import { StudentPresence } from "@/components/student-presence";
import { cn } from "@/lib/utils";

const input =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition focus:border-accent";

const backgroundChoices: { id: Exclude<WordDeckBackground, "CUSTOM">; swatch: string }[] = [
  { id: "MIDNIGHT", swatch: "from-slate-950 via-indigo-950 to-blue-950" },
  { id: "EMERALD", swatch: "from-emerald-950 via-emerald-700 to-teal-700" },
  { id: "VIOLET", swatch: "from-indigo-950 via-violet-700 to-fuchsia-900" },
  { id: "SUNSET", swatch: "from-orange-950 via-orange-600 to-rose-800" },
];

export function WordDeckStudio({ initialActivities, initialActivityId, mode = "WORD_DECK" }: {
  initialActivities: WordDeckActivity[];
  initialActivityId?: string;
  mode?: "WORD_DECK" | "SPELLING";
}) {
  const { t } = useT();
  const [activities, setActivities] = useState(initialActivities);
  const [editing, setEditing] = useState<WordDeckActivity | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<WordDeckActivity | null>(
    () => initialActivities.find((activity) => activity.id === initialActivityId) ?? null,
  );
  const [assigning, setAssigning] = useState<WordDeckActivity | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [sort, setSort] = useState<"NEWEST" | "TITLE">("NEWEST");
  const [notice, setNotice] = useState<string | null>(null);
  const portalReady = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [busy, startBusy] = useTransition();
  const spelling = mode === "SPELLING";
  const sortedActivities = useMemo(() => [...activities].sort((left, right) =>
    sort === "TITLE"
      ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
      : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [activities, sort]);

  const reload = async (openId?: string) => {
    const rows = await listWordDeckActivitiesAction();
    const filtered = rows.filter((row) => (row.settings.gameType === "SPELLING") === spelling);
    setActivities(filtered);
    if (openId) setPreview(filtered.find((row) => row.id === openId) ?? null);
  };

  if (creating || editing) {
    return (
      <WordDeckForm
        activity={editing}
        busy={busy}
        externalError={notice}
        forcedGameType={spelling ? "SPELLING" : undefined}
        heading={spelling ? (editing ? t.wordDeck.editSpellingPractice : t.wordDeck.newSpellingPractice) : undefined}
        submitLabel={spelling ? t.wordDeck.saveSpellingPractice : undefined}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={(payload, image) => startBusy(async () => {
          const result = await saveWordDeckActivityAction(payload);
          if (!result.id || result.error) {
            setNotice(result.error ?? t.wordDeck.saveFailed);
            return;
          }
          if (image) {
            const data = new FormData();
            data.set("activityId", result.id);
            data.set("image", image);
            await uploadWordDeckBackgroundAction(data);
          }
          await reload(result.id);
          setCreating(false);
          setEditing(null);
          setPresetsOpen(true);
        })}
      />
    );
  }

  return (
    <section className="activity-panel-in relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className={cn("flex h-14 w-14 shrink-0 -rotate-3 items-center justify-center rounded-2xl text-3xl text-white shadow-lg transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none", spelling ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20" : "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20")}>{spelling ? "🔤" : "♠"}</span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-black uppercase tracking-[.18em]", spelling ? "text-cyan-500" : "text-violet-500")}>{spelling ? t.wordDeck.spellingEyebrow : t.wordDeck.eyebrow}</p>
          <h2 className="mt-0.5 text-xl font-black text-content">{spelling ? t.wordDeck.spellingTitle : t.wordDeck.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{spelling ? t.wordDeck.spellingSubtitle : t.wordDeck.subtitle}</p>
        </div>
        <button type="button" onClick={() => { setNotice(null); setCreating(true); }} className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none">
          <IconPlus className="h-4 w-4" /> {spelling ? t.wordDeck.newSpellingPractice : t.wordDeck.newGame}
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.common.close}><IconX className="h-4 w-4" /></button>
        </div>
      )}

      <div className="relative">
      {!presetsOpen ? (
        <button
          type="button"
          onClick={() => setPresetsOpen(true)}
          className="activity-panel-in group flex w-full items-center gap-4 rounded-2xl bg-surface-2/80 p-4 text-left ring-1 ring-line transition-all duration-200 hover:-translate-y-0.5 hover:ring-violet-400 hover:shadow-md motion-reduce:transition-none"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 transition-colors duration-200 group-hover:bg-violet-500 group-hover:text-white motion-reduce:transition-none">
            <IconFolder className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-black text-content">
              {t.wordDeck.presets}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{activities.length}</span>
            </span>
          </span>
          <IconChevronRight className="h-5 w-5 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-violet-500 motion-reduce:transition-none" />
        </button>
      ) : (
        <div className="activity-panel-in flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line shadow-sm">
            <button type="button" onClick={() => setPresetsOpen(false)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent">
              <IconChevronLeft className="h-4 w-4" /> {t.wordDeck.back}
            </button>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-content">
              <IconFolder className="h-4 w-4 text-accent" /> {t.wordDeck.presets}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{activities.length}</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-faint">{t.wordDeck.sortBy}</span>
            <button type="button" onClick={() => setSort("TITLE")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "TITLE" ? "bg-accent text-white" : "bg-surface-2 text-muted")}>{t.wordDeck.sortTitle}</button>
            <button type="button" onClick={() => setSort("NEWEST")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "NEWEST" ? "bg-accent text-white" : "bg-surface-2 text-muted")}>{t.wordDeck.sortNewest}</button>
          </div>

          {activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-faint">
              {t.wordDeck.empty}
            </div>
          ) : <div className="grid gap-3 lg:grid-cols-2">
          {sortedActivities.map((activity) => (
            <article key={activity.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm">
              <button type="button" onClick={() => setPreview(activity)} className="group flex w-full items-center gap-3 text-left">
                <span className="flex h-14 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-600 text-2xl text-white shadow-lg transition group-hover:rotate-0">{spelling ? "🔤" : "♠"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-content">{activity.title}</span>
                  <span className="mt-0.5 block text-xs text-faint">
                    {activity.settings.gameType === "GUESS_DESCRIPTION"
                      ? `${t.wordDeck.guessByDescription} · `
                      : ""}
                    {fmt(t.wordDeck.cardCount, { n: activity.cards.length * activity.settings.repeats })}
                    {activity.settings.timerMode !== "NONE" ? ` · ${t.wordDeck.timerOn}` : ""}
                  </span>
                </span>
              </button>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" onClick={() => setPreview(activity)} className="h-9 flex-1 rounded-xl bg-accent-soft px-3 text-xs font-bold text-accent">{t.wordDeck.play}</button>
                <button type="button" onClick={() => setAssigning(activity)} className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white">
                  <IconUsers className="h-4 w-4" /> {t.wordDeck.addToClass}
                </button>
                <button type="button" onClick={() => { setNotice(null); setEditing(activity); }} title={t.wordDeck.edit} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted hover:text-accent"><IconPencil className="h-4 w-4" /></button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(t.wordDeck.removeConfirm)) return;
                    startBusy(async () => {
                      await deleteWordDeckActivityAction(activity.id);
                      await reload();
                      if (preview?.id === activity.id) setPreview(null);
                    });
                  }}
                  title={t.wordDeck.remove}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint hover:text-rose-500"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] font-semibold text-faint">{t.wordDeck.classCopiesStay}</p>
            </article>
          ))}
          </div>}
        </div>
      )}
      </div>

      {portalReady && preview && createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-7" onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => setPreview(null)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">× {t.wordDeck.close}</button>
            </div>
            <WordDeckBoard key={`${preview.id}:${preview.updatedAt}`} activity={preview} />
          </div>
        </div>,
        document.body,
      )}

      {assigning && (
        <AssignToClassDialog
          activity={assigning}
          onClose={() => setAssigning(null)}
          onDone={(message) => {
            setNotice(message);
            setAssigning(null);
          }}
        />
      )}
    </section>
  );
}

function AssignToClassDialog({ activity, onClose, onDone }: {
  activity: WordDeckActivity;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { t } = useT();
  const [students, setStudents] = useState<WordDeckStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    listWordDeckStudentsAction()
      .then((rows) => alive && setStudents(rows))
      .catch(() => alive && setError(t.wordDeck.studentsFailed));
    return () => { alive = false; };
  }, [t.wordDeck.studentsFailed]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-content">{t.wordDeck.addToClass}</h3>
            <p className="mt-1 text-sm text-muted">{activity.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-faint hover:text-content"><IconX className="h-5 w-5" /></button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-faint">{t.wordDeck.chooseStudent}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {students === null && <p className="text-sm text-faint">{t.common.loading}</p>}
          {students?.length === 0 && <p className="text-sm text-faint">{t.wordDeck.noStudents}</p>}
          {students?.map((student) => (
            <div key={student.id} className="rounded-xl bg-surface-2 p-2 ring-1 ring-line">
              <div className="flex items-center gap-2 px-1">
                <p className="min-w-0 truncate text-sm font-black text-content">{student.name}</p>
                <StudentPresence studentId={student.id} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    setError(null);
                    const result = await addWordDeckToClassAction(activity.id, student.id);
                    if (result.error) setError(result.error);
                    else onDone(result.existed
                      ? fmt(t.wordDeck.alreadyInClass, { name: student.name })
                      : fmt(t.wordDeck.addedToClass, { name: student.name }));
                  })}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent-soft px-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  <IconUsers className="h-3.5 w-3.5" /> {t.wordDeck.toActivities}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    setError(null);
                    const result = await assignWordDeckHomeworkAction(activity.id, student.id);
                    if (result.error) setError(result.error);
                    else onDone(fmt(t.wordDeck.addedToHomework, { name: student.name }));
                  })}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  ✓ {t.wordDeck.toHomework}
                </button>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

type Branch = CopyNode & { children: Branch[] };
function treeWithVocabulary(nodes: CopyNode[]): Branch[] {
  const needed = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.type !== "FILE" || node.pageKind !== "VOCAB") continue;
    for (let current: CopyNode | undefined = node; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
      if (needed.has(current.id)) break;
      needed.add(current.id);
    }
  }
  const branches = new Map<string, Branch>();
  nodes.filter((node) => needed.has(node.id)).forEach((node) => branches.set(node.id, { ...node, children: [] }));
  const roots: Branch[] = [];
  for (const branch of branches.values()) {
    const parent = branch.parentId ? branches.get(branch.parentId) : null;
    if (parent) parent.children.push(branch); else roots.push(branch);
  }
  return roots;
}

function initialNodeIds(activity: WordDeckActivity | null): string[] {
  const fromCards = activity?.cards.map((card) => card.nodeId).filter(Boolean) as string[] | undefined;
  return [...new Set(fromCards?.length ? fromCards : activity?.nodeId ? [activity.nodeId] : [])];
}

export function WordDeckForm({ activity, busy, externalError, onCancel, onSave, heading, submitLabel, footerHint, forcedGameType, includeSpellingType = false }: {
  activity: WordDeckActivity | null;
  busy: boolean;
  externalError: string | null;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof saveWordDeckActivityAction>[0], image: File | null) => void;
  heading?: string;
  submitLabel?: string;
  footerHint?: string;
  forcedGameType?: "SPELLING";
  includeSpellingType?: boolean;
}) {
  const { t, locale } = useT();
  const startingNodes = useMemo(() => initialNodeIds(activity), [activity]);
  const [customTitle, setCustomTitle] = useState<string | null>(activity?.title ?? null);
  const [trees, setTrees] = useState<CopyTree[] | null>(null);
  const [source, setSource] = useState<"MINE" | "STUDENTS">("MINE");
  const [studentTreeKey, setStudentTreeKey] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodeIds, setNodeIds] = useState<string[]>(startingNodes);
  const [groups, setGroups] = useState<WordDeckVocabGroup[]>([]);
  const [selected, setSelected] = useState(() => new Set((activity?.cards ?? []).map((card) => card.phraseId)));
  // Только новые клики выбирают все слова автоматически. При редактировании
  // уже сохранённой колоды оставляем ровно прежний набор галочек.
  const [autoSelectNodes] = useState(() => new Set<string>());
  const [activeGroup, setActiveGroup] = useState(0);
  const [loadingWords, setLoadingWords] = useState(startingNodes.length > 0);
  const [settings, setSettings] = useState<WordDeckSettings>(() => normalizeWordDeckSettings({
    ...(activity?.settings ?? DEFAULT_WORD_DECK_SETTINGS),
    ...(forcedGameType ? { gameType: forcedGameType } : {}),
  }));
  const [manualWords, setManualWords] = useState(() => (activity?.cards ?? [])
    .filter((card) => !card.nodeId)
    .map((card) => card.word)
    .join("\n"));
  const [repeatsInput, setRepeatsInput] = useState(() => String(settings.repeats));
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCopyTargetsAction()
      .then((rows) => {
        if (!alive) return;
        const usable = rows.filter((tree) => tree.scope === "PERSONAL" || tree.scope === "STUDENT");
        setTrees(usable);
        const initialTree = usable.find((tree) => startingNodes.some((id) => tree.nodes.some((node) => node.id === id)));
        if (initialTree?.scope === "STUDENT") {
          setSource("STUDENTS");
          setStudentTreeKey(initialTree.key);
        } else {
          setStudentTreeKey(usable.find((tree) => tree.scope === "STUDENT")?.key ?? "");
        }
      })
      .catch(() => alive && setError(t.wordDeck.materialsFailed));
    return () => { alive = false; };
  }, [startingNodes, t.wordDeck.materialsFailed]);

  const nodeKey = nodeIds.join("|");
  useEffect(() => {
    let alive = true;
    if (nodeIds.length === 0) {
      const frame = requestAnimationFrame(() => {
        setGroups([]);
        setLoadingWords(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => {
      if (!alive) return;
      setLoadingWords(true);
      listWordDeckVocabGroupsAction(nodeIds)
        .then((nextGroups) => {
          if (!alive) return;
          setGroups(nextGroups);
          // React в dev может вызвать updater дважды. Не меняем Set снаружи
          // внутри updater — заранее снимаем одноразовый список автогалочек.
          const autoIds = new Set(
            nextGroups
              .map((group) => group.id)
              .filter((id) => autoSelectNodes.has(id)),
          );
          autoIds.forEach((id) => autoSelectNodes.delete(id));
          setSelected((current) => {
            const valid = new Set(nextGroups.flatMap((group) => group.words.map((word) => word.phraseId)));
            const next = new Set([...current].filter((id) => valid.has(id)));
            for (const group of nextGroups) {
              if (!autoIds.has(group.id)) continue;
              group.words.forEach((word) => next.add(word.phraseId));
            }
            return next;
          });
          setActiveGroup((index) => Math.min(index, Math.max(0, nextGroups.length - 1)));
          setLoadingWords(false);
        })
        .catch(() => {
          if (!alive) return;
          setError(t.wordDeck.materialsFailed);
          setLoadingWords(false);
        });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
    // nodeKey is the stable identity of the ordered selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);

  const personalTree = trees?.find((tree) => tree.scope === "PERSONAL") ?? null;
  const studentTrees = trees?.filter((tree) => tree.scope === "STUDENT") ?? [];
  const tree = source === "MINE"
    ? personalTree
    : studentTrees.find((candidate) => candidate.key === studentTreeKey) ?? null;
  const roots = treeWithVocabulary(tree?.nodes ?? []);
  const currentGroup = groups[activeGroup] ?? null;
  const title = customTitle ?? suggestedWordDeckTitle(groups.map((group) => group.name));
  const parsedRepeats = Number(repeatsInput);
  const repeatsValid = /^\d+$/.test(repeatsInput.trim())
    && Number.isInteger(parsedRepeats)
    && parsedRepeats >= 1
    && parsedRepeats <= 20;
  const eligibleIds = new Set(
    groups
      .flatMap((group) => group.words)
      .filter((word) => settings.gameType !== "GUESS_DESCRIPTION" || word.description?.trim())
      .map((word) => word.phraseId),
  );
  const selectedEligible = [...selected].filter((id) => eligibleIds.has(id));
  const manualList = [...new Set(manualWords.split(/[\n,;]+/).map((word) => word.trim()).filter(Boolean))];
  const sourceCount = selectedEligible.length + (settings.gameType === "SPELLING" ? manualList.length : 0);
  const total = sourceCount * (repeatsValid ? parsedRepeats : 0);
  const minimum = settings.gameType === "SPELLING" ? 1 : MIN_WORD_DECK_WORDS;
  const enough = sourceCount >= minimum;

  const toggleNode = (id: string) => {
    if (nodeIds.includes(id)) autoSelectNodes.delete(id);
    else autoSelectNodes.add(id);
    setNodeIds((current) =>
      current.includes(id) ? current.filter((nodeId) => nodeId !== id) : [...current, id]);
  };

  const toggleWord = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectRandomPercentage = (percent: 25 | 50 | 75) => {
    if (!currentGroup) return;
    const available = currentGroup.words.filter(
      (word) => settings.gameType !== "GUESS_DESCRIPTION" || word.description?.trim(),
    );
    const picked = new Set(
      randomWordDeckPercentage(available, percent).map((word) => word.phraseId),
    );
    setSelected((current) => {
      const next = new Set(current);
      currentGroup.words.forEach((word) => next.delete(word.phraseId));
      picked.forEach((id) => next.add(id));
      return next;
    });
  };

  const renderBranch = (node: Branch, depth = 0): React.ReactNode => {
    const folder = node.type === "FOLDER";
    const open = !collapsed.has(node.id);
    const checked = nodeIds.includes(node.id);
    return (
      <div key={node.id}>
        <div style={{ paddingLeft: `${depth * 16 + 8}px` }} className={cn("flex items-center gap-2 rounded-lg pr-2 transition", checked ? "bg-accent-soft" : "hover:bg-surface")}>
          {!folder && (
            <input type="checkbox" checked={checked} onChange={() => toggleNode(node.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
          )}
          <button
            type="button"
            onClick={() => folder
              ? setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                  return next;
                })
              : toggleNode(node.id)}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
          >
            <span className="w-4 shrink-0 text-xs text-faint">{folder ? (open ? "▾" : "▸") : (node.icon ?? "📘")}</span>
            <span className={cn("truncate text-sm", folder ? "font-bold text-content" : checked ? "font-bold text-accent" : "font-semibold text-muted")}>{node.name}</span>
          </button>
        </div>
        {folder && open && node.children.map((child) => renderBranch(child, depth + 1))}
      </div>
    );
  };

  const ratioPresets = [
    { value: 10, label: t.wordDeck.muchMoreTeacher },
    { value: 30, label: t.wordDeck.moreTeacher },
    { value: 50, label: t.wordDeck.equal },
    { value: 70, label: t.wordDeck.moreStudent },
    { value: 90, label: t.wordDeck.muchMoreStudent },
  ];

  return (
    <section className="activity-panel-in rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted">← {t.wordDeck.back}</button>
        <h2 className="text-xl font-black text-content">{heading ?? (activity ? t.wordDeck.editGame : t.wordDeck.newGame)}</h2>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-5">
          {!forcedGameType && <div>
            <p className="text-xs font-bold text-muted">{t.wordDeck.gameType}</p>
            <div className={cn("mt-1.5 grid gap-2", includeSpellingType ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {(["WORDS", "GUESS_DESCRIPTION", ...(includeSpellingType ? ["SPELLING" as const] : [])] as const).map((gameType) => (
                <button
                  key={gameType}
                  type="button"
                  onClick={() => setSettings((value) => ({ ...value, gameType, ...(gameType === "SPELLING" ? { alternate: false } : {}) }))}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition",
                    settings.gameType === gameType
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface-2 text-muted hover:border-accent/50",
                  )}
                >
                  <span className="block text-sm font-black">
                    {gameType === "WORDS" ? t.wordDeck.wordsGame : gameType === "SPELLING" ? t.wordDeck.spellingTitle : t.wordDeck.guessByDescription}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed">
                    {gameType === "WORDS" ? t.wordDeck.wordsGameHint : gameType === "SPELLING" ? t.wordDeck.spellingSubtitle : t.wordDeck.guessByDescriptionHint}
                  </span>
                </button>
              ))}
            </div>
          </div>}

          <label>
            <span className="text-xs font-bold text-muted">{t.wordDeck.gameTitle}</span>
            <input value={title} onChange={(event) => {
              setCustomTitle(event.target.value);
            }} className={`${input} mt-1.5`} placeholder={t.wordDeck.titlePlaceholder} />
          </label>

          {settings.gameType === "SPELLING" && (
            <label className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
              <span className="text-sm font-black text-content">{t.wordDeck.manualWords}</span>
              <span className="mt-1 block text-xs text-faint">{t.wordDeck.manualWordsHint}</span>
              <textarea
                value={manualWords}
                onChange={(event) => setManualWords(event.target.value)}
                rows={4}
                className="mt-3 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-semibold text-content outline-none focus:border-accent"
                placeholder={t.wordDeck.manualWordsPlaceholder}
              />
              {manualList.length > 0 && <span className="mt-2 block text-xs font-bold text-cyan-600 dark:text-cyan-300">{fmt(t.wordDeck.manualWordsCount, { n: manualList.length })}</span>}
            </label>
          )}

          <div>
            <p className="text-xs font-bold text-muted">{t.wordDeck.chooseSource}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSource("MINE")} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1 transition", source === "MINE" ? "bg-accent text-white ring-accent" : "bg-surface-2 text-muted ring-line")}>
                <IconFolder className="h-4 w-4" /> {t.wordDeck.myMaterials}
              </button>
              <button type="button" onClick={() => setSource("STUDENTS")} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1 transition", source === "STUDENTS" ? "bg-accent text-white ring-accent" : "bg-surface-2 text-muted ring-line")}>
                <IconUsers className="h-4 w-4" /> {t.wordDeck.students}
              </button>
            </div>

            {source === "STUDENTS" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {studentTrees.map((student) => (
                  <button key={student.key} type="button" onClick={() => setStudentTreeKey(student.key)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", student.key === studentTreeKey ? "bg-accent-soft text-accent ring-1 ring-accent" : "bg-surface-2 text-muted")}>{student.short}</button>
                ))}
              </div>
            )}

            <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface-2 p-2">
              {trees === null && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}
              {trees !== null && !tree && <p className="p-3 text-sm text-faint">{source === "MINE" ? t.wordDeck.noVocab : t.wordDeck.noStudents}</p>}
              {tree && roots.length === 0 && <p className="p-3 text-sm text-faint">{t.wordDeck.noVocab}</p>}
              {roots.map((root) => renderBranch(root))}
            </div>
            <p className="mt-2 text-xs font-semibold text-faint">{fmt(t.wordDeck.vocabsSelected, { n: nodeIds.length })}</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <button type="button" disabled={groups.length < 2} onClick={() => setActiveGroup((index) => (index - 1 + groups.length) % groups.length)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted disabled:opacity-30"><IconChevronLeft className="h-4 w-4" /></button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-black text-content">{currentGroup ? `${currentGroup.icon ?? "📘"} ${currentGroup.name}` : t.wordDeck.pickVocabs}</p>
                {groups.length > 0 && <p className="text-[11px] font-bold text-faint">{activeGroup + 1} / {groups.length}</p>}
              </div>
              <button type="button" disabled={groups.length < 2} onClick={() => setActiveGroup((index) => (index + 1) % groups.length)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted disabled:opacity-30"><IconChevronRight className="h-4 w-4" /></button>
            </div>

            {loadingWords && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}
            {!loadingWords && currentGroup && (
              <>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs font-semibold text-faint">{fmt(t.wordDeck.selectedInVocab, {
                    selected: currentGroup.words.filter((word) => selected.has(word.phraseId) && (settings.gameType !== "GUESS_DESCRIPTION" || word.description?.trim())).length,
                    total: currentGroup.words.filter((word) => settings.gameType !== "GUESS_DESCRIPTION" || word.description?.trim()).length,
                  })}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelected((current) => {
                      const next = new Set(current);
                      currentGroup.words.forEach((word) => {
                        if (settings.gameType !== "GUESS_DESCRIPTION" || word.description?.trim()) next.add(word.phraseId);
                      });
                      return next;
                    })} className="text-xs font-bold text-accent">{t.wordDeck.selectAll}</button>
                    <button type="button" onClick={() => setSelected((current) => {
                      const next = new Set(current); currentGroup.words.forEach((word) => next.delete(word.phraseId)); return next;
                    })} className="text-xs font-bold text-muted">{t.wordDeck.selectNone}</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-bold text-faint">{t.wordDeck.randomSelection}</span>
                  {([25, 50, 75] as const).map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => selectRandomPercentage(percent)}
                      aria-label={`${t.wordDeck.randomSelection}: ${percent}%`}
                      className="rounded-lg bg-surface px-2.5 py-1 text-xs font-black text-accent ring-1 ring-line transition hover:bg-accent-soft"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                  {currentGroup.words.map((word) => {
                    const unavailable = settings.gameType === "GUESS_DESCRIPTION" && !word.description?.trim();
                    const checked = selected.has(word.phraseId) && !unavailable;
                    return (
                      <button key={word.phraseId} type="button" disabled={unavailable} onClick={() => toggleWord(word.phraseId)} className={cn("flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition", checked ? "bg-accent-soft text-accent" : "bg-surface text-muted", unavailable && "cursor-not-allowed opacity-45")}>
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-accent bg-accent text-white" : "border-line")}>
                          {checked && <IconCheck className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{word.word}</span>
                        {unavailable && <span className="shrink-0 text-[9px] font-bold uppercase">{t.wordDeck.noDescription}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-bold text-muted">{t.wordDeck.repeats}</span>
              <input type="number" min={1} max={20} value={repeatsInput} onChange={(event) => setRepeatsInput(event.target.value)} className={`${input} mt-1.5`} />
              <span className="mt-1 block text-[11px] text-faint">{fmt(t.wordDeck.cardCount, { n: total })}</span>
            </label>
            <div>
              <span className="text-xs font-bold text-muted">{t.wordDeck.timer}</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
                {(["NONE", "GAME", "CARD"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setSettings((value) => ({ ...value, timerMode: mode }))} className={cn("rounded-lg px-2 py-2 text-[11px] font-bold", settings.timerMode === mode ? "bg-accent text-white" : "text-muted")}>{mode === "NONE" ? t.wordDeck.timerNone : mode === "GAME" ? t.wordDeck.timerGame : t.wordDeck.timerCard}</button>
                ))}
              </div>
            </div>
          </div>

          {settings.timerMode !== "NONE" && (
            <label>
              <span className="text-xs font-bold text-muted">{settings.timerMode === "GAME" ? t.wordDeck.gameSeconds : t.wordDeck.cardSeconds}</span>
              <input type="number" min={settings.timerMode === "GAME" ? 10 : 3} max={settings.timerMode === "GAME" ? 3600 : 300} value={settings.timerMode === "GAME" ? settings.gameSeconds : settings.cardSeconds} onChange={(event) => setSettings((value) => settings.timerMode === "GAME" ? { ...value, gameSeconds: Number(event.target.value) } : { ...value, cardSeconds: Number(event.target.value) })} className={`${input} mt-1.5 max-w-xs`} />
            </label>
          )}

          <div className="rounded-2xl border border-line p-4">
            {settings.gameType === "SPELLING" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["autoPronounce", t.wordDeck.autoPronounce, t.wordDeck.autoPronounceHint],
                  ["allowUsAudio", t.wordDeck.allowUsAudio, t.wordDeck.allowUsAudioHint],
                  ["allowUkAudio", t.wordDeck.allowUkAudio, t.wordDeck.allowUkAudioHint],
                  ["showTips", t.wordDeck.showTips, t.wordDeck.showTipsHint],
                  ["autoPronounceUk", t.wordDeck.autoPronounceUk, t.wordDeck.autoPronounceUkHint],
                ] as const).map(([key, label, hint]) => (
                  <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 p-3">
                    <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((value) => ({ ...value, [key]: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                    <span><span className="block text-sm font-black text-content">{label}</span><span className="block text-xs text-faint">{hint}</span></span>
                  </label>
                ))}
              </div>
            ) : settings.gameType === "GUESS_DESCRIPTION" ? (
              <div className="mb-4 grid gap-4 border-b border-line pb-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={settings.descriptionIcons} onChange={(event) => setSettings((value) => ({ ...value, descriptionIcons: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <span><span className="block text-sm font-black text-content">{t.wordDeck.descriptionIcons}</span><span className="block text-xs text-faint">{t.wordDeck.descriptionIconsHint}</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={settings.answerIcons} onChange={(event) => setSettings((value) => ({ ...value, answerIcons: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <span><span className="block text-sm font-black text-content">{t.wordDeck.answerIcons}</span><span className="block text-xs text-faint">{t.wordDeck.answerIconsHint}</span></span>
                </label>
              </div>
            ) : (
              <label className="mb-4 flex cursor-pointer items-start gap-3 border-b border-line pb-4">
                <input type="checkbox" checked={settings.showIcons} onChange={(event) => setSettings((value) => ({ ...value, showIcons: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                <span><span className="block text-sm font-black text-content">{t.wordDeck.showIcons}</span><span className="block text-xs text-faint">{t.wordDeck.showIconsHint}</span></span>
              </label>
            )}
            {settings.gameType !== "SPELLING" && <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={settings.alternate} onChange={(event) => setSettings((value) => ({ ...value, alternate: event.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span><span className="block text-sm font-black text-content">{t.wordDeck.alternate}</span><span className="block text-xs text-faint">{t.wordDeck.alternateHint}</span></span>
            </label>}
            {settings.gameType !== "SPELLING" && settings.alternate && (
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-muted"><span>{t.wordDeck.forTeacher}</span><span>{t.wordDeck.forStudent}: {settings.studentPercent}%</span></div>
                <input type="range" min={0} max={100} step={5} value={settings.studentPercent} onChange={(event) => setSettings((value) => ({ ...value, studentPercent: Number(event.target.value) }))} className="mt-2 w-full accent-[var(--accent)]" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ratioPresets.map((preset) => <button key={preset.value} type="button" onClick={() => setSettings((value) => ({ ...value, studentPercent: preset.value }))} className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", settings.studentPercent === preset.value ? "bg-accent text-white" : "bg-surface-2 text-muted")}>{preset.label}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside>
          <p className="text-xs font-bold text-muted">{t.wordDeck.backgrounds}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {backgroundChoices.map((choice) => (
              <button key={choice.id} type="button" onClick={() => setSettings((value) => ({ ...value, background: choice.id }))} className={cn("h-20 rounded-xl bg-gradient-to-br ring-offset-2 ring-offset-[var(--surface)] transition", choice.swatch, settings.background === choice.id ? "ring-2 ring-accent" : "ring-1 ring-white/10")} title={choice.id} />
            ))}
          </div>
          <label className={cn("mt-2 flex min-h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs font-bold transition", settings.background === "CUSTOM" ? "border-accent bg-accent-soft text-accent" : "border-line text-muted")}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setImage(next);
              if (next) setSettings((value) => ({ ...value, background: "CUSTOM" }));
            }} />
            {image?.name ?? (activity?.backgroundImageUrl && settings.background === "CUSTOM" ? t.wordDeck.customReady : t.wordDeck.uploadBackground)}
          </label>
          <div className={cn("mt-4 rounded-2xl p-4", enough ? "bg-surface-2" : "bg-amber-500/10 ring-1 ring-amber-500/40")}>
            <p className="text-xs font-bold text-muted">{t.wordDeck.summary}</p>
            <p className="mt-2 text-3xl font-black text-content">{total}</p>
            <p className="text-xs text-faint">{t.wordDeck.cardsShort}</p>
            {!enough && <p className="mt-2 text-xs font-bold text-amber-600">{fmt(t.wordDeck.minimumWords, { n: minimum })}</p>}
          </div>
        </aside>
      </div>

      {(error || externalError) && <p className="mt-4 text-sm font-semibold text-rose-500">{error || externalError}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button type="button" disabled={busy || !title.trim() || !enough} onClick={() => {
          if (!repeatsValid) {
            setError(t.wordDeck.repeatsRequired);
            return;
          }
          setError(null);
          onSave({
            id: activity?.id,
            title,
            nodeIds,
            phraseIds: selectedEligible,
            manualWords: settings.gameType === "SPELLING" ? manualList : [],
            translationLang: locale === "uk" ? "UK" : "RU",
            settings: { ...settings, repeats: parsedRepeats },
          }, image);
        }} className="h-11 rounded-xl bg-accent px-5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40">
          {busy ? t.wordDeck.saving : (submitLabel ?? t.wordDeck.save)}
        </button>
        <p className="text-xs text-faint">{footerHint ?? t.wordDeck.snapshotHint}</p>
      </div>
    </section>
  );
}
