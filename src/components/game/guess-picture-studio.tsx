"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  addGuessPicturePresetToClassAction,
  deleteGuessPicturePresetAction,
  listGuessPicturePresetGroupsAction,
  listGuessPicturePresetsAction,
  saveGuessPicturePresetAction,
  type GameMode,
  type GuessPicturePreset,
  type GuessPicturePresetGroup,
} from "@/lib/actions/guess-picture";
import {
  listWordDeckStudentsAction,
  type WordDeckStudent,
} from "@/lib/actions/word-deck";
import {
  listCopyTargetsAction,
  type CopyNode,
  type CopyTree,
} from "@/lib/actions/materials";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconGrid,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

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

const readyForMode = (
  word: GuessPicturePresetGroup["words"][number],
  mode: GameMode,
) => mode === "TRANSLATION"
  ? Boolean(word.translation?.trim())
  : mode === "MIXED"
    ? Boolean(word.translation?.trim()) && Boolean(word.imageUrl)
    : Boolean(word.imageUrl);

const presetNodeIds = (preset: GuessPicturePreset | null) => [
  ...new Set((preset?.cards ?? []).map((card) => card.nodeId).filter((id): id is string => Boolean(id))),
];

export function GuessPictureStudio({ initialPresets }: { initialPresets: GuessPicturePreset[] }) {
  const { t } = useT();
  const [presets, setPresets] = useState(initialPresets);
  const [editing, setEditing] = useState<GuessPicturePreset | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<GuessPicturePreset | null>(null);
  const [presetFolderOpen, setPresetFolderOpen] = useState(false);
  const [sort, setSort] = useState<"NEWEST" | "TITLE">("NEWEST");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const sorted = useMemo(() => [...presets].sort((left, right) =>
    sort === "TITLE"
      ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
      : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [presets, sort]);

  const reload = async () => {
    const rows = await listGuessPicturePresetsAction();
    setPresets(rows);
    return rows;
  };

  if (creating || editing) {
    return (
      <GuessPicturePresetForm
        preset={editing}
        busy={busy}
        externalError={notice}
        onCancel={() => { setCreating(false); setEditing(null); setNotice(null); }}
        onSave={(payload) => startBusy(async () => {
          const result = await saveGuessPicturePresetAction(payload);
          if (result.error) return setNotice(result.error);
          await reload();
          setCreating(false);
          setEditing(null);
          setPresetFolderOpen(true);
          setNotice(t.game.presetSaved);
        })}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {!presetFolderOpen && <button
          type="button"
          onClick={() => { setNotice(null); setCreating(true); }}
          className="group flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-line shadow-sm transition hover:-translate-y-0.5 hover:ring-accent hover:shadow-md"
        >
          <span className="grad-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"><IconGrid className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-content">{t.game.title}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.game.subtitle}</span>
          </span>
          <span className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-black text-white"><IconPlus className="h-4 w-4" /> {t.game.newPreset}</span>
        </button>}

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          <span>{notice}</span><button type="button" onClick={() => setNotice(null)}><IconX className="h-4 w-4" /></button>
        </div>
      )}

      {presets.length > 0 && !presetFolderOpen && (
        <button type="button" onClick={() => setPresetFolderOpen(true)} className="group flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-line shadow-sm transition hover:-translate-y-0.5 hover:ring-accent hover:shadow-md">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white"><IconFolder className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-black text-content">{t.game.presets}<span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{presets.length}</span></span></span>
          <IconChevronRight className="h-5 w-5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </button>
      )}

      {presets.length > 0 && presetFolderOpen && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line shadow-sm">
            <button type="button" onClick={() => setPresetFolderOpen(false)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent"><IconChevronLeft className="h-4 w-4" /> {t.wordDeck.back}</button>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-content"><IconFolder className="h-4 w-4 text-accent" /> {t.game.presets}<span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{presets.length}</span></span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-faint">{t.game.sortBy}</span>
            <button type="button" onClick={() => setSort("TITLE")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "TITLE" ? "bg-accent text-white" : "bg-surface-2 text-muted")}>{t.game.sortTitle}</button>
            <button type="button" onClick={() => setSort("NEWEST")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "NEWEST" ? "bg-accent text-white" : "bg-surface-2 text-muted")}>{t.game.sortNewest}</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {sorted.map((preset) => (
              <article key={preset.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grad-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"><IconGrid className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-black text-content">{preset.title}</span><span className="block text-xs text-faint">{preset.mode === "PICTURE" ? t.game.modePicture : preset.mode === "TRANSLATION" ? t.game.modeTranslation : t.game.modeMixed} · {fmt(t.wordDeck.cardCount, { n: preset.cards.length * (preset.mode === "MIXED" ? 2 : 1) })}</span></span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <button type="button" onClick={() => setAssigning(preset)} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white"><IconUsers className="h-4 w-4" /> {t.wordDeck.addToClass}</button>
                  <button type="button" onClick={() => { setNotice(null); setEditing(preset); }} title={t.wordDeck.edit} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted hover:text-accent"><IconPencil className="h-4 w-4" /></button>
                  <button type="button" disabled={busy} onClick={() => { if (!confirm(t.game.deletePresetConfirm)) return; startBusy(async () => { const result = await deleteGuessPicturePresetAction(preset.id); if (result.error) setNotice(result.error); const rows = await reload(); if (rows.length === 0) setPresetFolderOpen(false); }); }} title={t.wordDeck.remove} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint hover:text-rose-500 disabled:opacity-50"><IconTrash className="h-4 w-4" /></button>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-faint">{t.game.classCopiesStay}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {assigning && <GuessAssignDialog preset={assigning} onClose={() => setAssigning(null)} onDone={(message) => { setNotice(message); setAssigning(null); }} />}
    </section>
  );
}

function GuessAssignDialog({ preset, onClose, onDone }: { preset: GuessPicturePreset; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useT();
  const [students, setStudents] = useState<WordDeckStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    listWordDeckStudentsAction().then((rows) => alive && setStudents(rows)).catch(() => alive && setError(t.wordDeck.studentsFailed));
    return () => { alive = false; };
  }, [t.wordDeck.studentsFailed]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-content">{t.wordDeck.addToClass}</h3><p className="mt-1 text-sm text-muted">{preset.title}</p></div><button type="button" onClick={onClose}><IconX className="h-5 w-5 text-faint" /></button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {students === null && <p className="text-sm text-faint">{t.common.loading}</p>}
          {students?.map((student) => <button key={student.id} type="button" disabled={busy} onClick={() => startBusy(async () => { const result = await addGuessPicturePresetToClassAction(preset.id, student.id); if (result.error) setError(result.error); else onDone(result.existed ? fmt(t.wordDeck.alreadyInClass, { name: student.name }) : fmt(t.wordDeck.addedToClass, { name: student.name })); })} className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3 text-left text-sm font-bold text-content transition hover:bg-accent-soft hover:text-accent disabled:opacity-50"><IconUsers className="h-4 w-4" /> {student.name}</button>)}
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}
      </div>
    </div>
  );
}

function GuessPicturePresetForm({ preset, busy, externalError, onCancel, onSave }: {
  preset: GuessPicturePreset | null;
  busy: boolean;
  externalError: string | null;
  onCancel: () => void;
  onSave: (payload: Parameters<typeof saveGuessPicturePresetAction>[0]) => void;
}) {
  const { t } = useT();
  const startingNodes = useMemo(() => presetNodeIds(preset), [preset]);
  const [trees, setTrees] = useState<CopyTree[] | null>(null);
  const [source, setSource] = useState<"MINE" | "STUDENTS">("MINE");
  const [studentTreeKey, setStudentTreeKey] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodeIds, setNodeIds] = useState(startingNodes);
  const [groups, setGroups] = useState<GuessPicturePresetGroup[]>([]);
  const [selected, setSelected] = useState(() => new Set((preset?.cards ?? []).map((card) => card.phraseId)));
  const [autoSelectNodes] = useState(() => new Set<string>());
  const [activeGroup, setActiveGroup] = useState(0);
  const [loadingWords, setLoadingWords] = useState(startingNodes.length > 0);
  const [mode, setMode] = useState<GameMode>(preset?.mode ?? "PICTURE");
  const [shuffleWords, setShuffleWords] = useState(preset?.shuffleWords ?? true);
  const [shuffleDecks, setShuffleDecks] = useState(preset?.shuffleDecks ?? false);
  const [seconds, setSeconds] = useState(preset?.seconds ?? 10);
  const [customTitle, setCustomTitle] = useState<string | null>(preset?.title ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCopyTargetsAction().then((rows) => {
      if (!alive) return;
      const usable = rows.filter((tree) => tree.scope === "PERSONAL" || tree.scope === "STUDENT");
      setTrees(usable);
      const initialTree = usable.find((tree) => startingNodes.some((id) => tree.nodes.some((node) => node.id === id)));
      if (initialTree?.scope === "STUDENT") { setSource("STUDENTS"); setStudentTreeKey(initialTree.key); }
      else setStudentTreeKey(usable.find((tree) => tree.scope === "STUDENT")?.key ?? "");
    }).catch(() => alive && setError(t.wordDeck.materialsFailed));
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
      listGuessPicturePresetGroupsAction(nodeIds).then((next) => {
        if (!alive) return;
        setGroups(next);
        const auto = new Set(next.map((group) => group.id).filter((id) => autoSelectNodes.has(id)));
        auto.forEach((id) => autoSelectNodes.delete(id));
        setSelected((current) => {
          const valid = new Set(next.flatMap((group) => group.words.map((word) => word.phraseId)));
          const result = new Set([...current].filter((id) => valid.has(id)));
          next.filter((group) => auto.has(group.id)).forEach((group) => group.words.forEach((word) => result.add(word.phraseId)));
          return result;
        });
        setActiveGroup((index) => Math.min(index, Math.max(0, next.length - 1)));
        setLoadingWords(false);
      }).catch(() => { if (alive) { setError(t.wordDeck.materialsFailed); setLoadingWords(false); } });
    });
    return () => { alive = false; cancelAnimationFrame(frame); };
    // nodeKey is the stable identity of the ordered selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);

  const personalTree = trees?.find((tree) => tree.scope === "PERSONAL") ?? null;
  const studentTrees = trees?.filter((tree) => tree.scope === "STUDENT") ?? [];
  const tree = source === "MINE" ? personalTree : studentTrees.find((candidate) => candidate.key === studentTreeKey) ?? null;
  const roots = treeWithVocabulary(tree?.nodes ?? []);
  const currentGroup = groups[activeGroup] ?? null;
  const title = customTitle ?? (groups.length === 1 ? groups[0].name : groups.length > 1 ? "Mix" : "");
  const eligible = new Set(groups.flatMap((group) => group.words.filter((word) => readyForMode(word, mode)).map((word) => word.phraseId)));
  const selectedEligible = [...selected].filter((id) => eligible.has(id));

  const toggleNode = (id: string) => {
    if (nodeIds.includes(id)) autoSelectNodes.delete(id); else autoSelectNodes.add(id);
    setNodeIds((current) => current.includes(id) ? current.filter((nodeId) => nodeId !== id) : [...current, id]);
  };
  const toggleWord = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const renderBranch = (node: Branch, depth = 0): React.ReactNode => {
    const folder = node.type === "FOLDER";
    const open = !collapsed.has(node.id);
    const checked = nodeIds.includes(node.id);
    return <div key={node.id}><div style={{ paddingLeft: `${depth * 16 + 8}px` }} className={cn("flex items-center gap-2 rounded-lg pr-2 transition", checked ? "bg-accent-soft" : "hover:bg-surface")}>
      {!folder && <input type="checkbox" checked={checked} onChange={() => toggleNode(node.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />}
      <button type="button" onClick={() => folder ? setCollapsed((current) => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; }) : toggleNode(node.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"><span className="w-4 shrink-0 text-xs text-faint">{folder ? (open ? "▾" : "▸") : (node.icon ?? "📘")}</span><span className={cn("truncate text-sm", folder ? "font-bold text-content" : checked ? "font-bold text-accent" : "font-semibold text-muted")}>{node.name}</span></button>
    </div>{folder && open && node.children.map((child) => renderBranch(child, depth + 1))}</div>;
  };

  return (
    <section className="rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted">← {t.wordDeck.back}</button><h2 className="text-xl font-black text-content">{preset ? t.game.editPreset : t.game.newPreset}</h2></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-5">
          <label><span className="text-xs font-bold text-muted">{t.wordDeck.gameTitle}</span><input value={title} onChange={(event) => setCustomTitle(event.target.value)} placeholder={t.wordDeck.titlePlaceholder} className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none focus:border-accent" /></label>
          <div><p className="text-xs font-bold text-muted">{t.game.modeTitle}</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{(["PICTURE", "TRANSLATION", "MIXED"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={cn("rounded-xl p-3 text-left ring-1", mode === value ? "bg-accent-soft text-accent ring-accent" : "bg-surface-2 text-muted ring-line")}><span className="block text-sm font-black">{value === "PICTURE" ? t.game.modePicture : value === "TRANSLATION" ? t.game.modeTranslation : t.game.modeMixed}</span></button>)}</div></div>
          <div>
            <p className="text-xs font-bold text-muted">{t.wordDeck.chooseSource}</p>
            <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSource("MINE")} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1", source === "MINE" ? "bg-accent text-white ring-accent" : "bg-surface-2 text-muted ring-line")}><IconFolder className="h-4 w-4" /> {t.wordDeck.myMaterials}</button><button type="button" onClick={() => setSource("STUDENTS")} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ring-1", source === "STUDENTS" ? "bg-accent text-white ring-accent" : "bg-surface-2 text-muted ring-line")}><IconUsers className="h-4 w-4" /> {t.wordDeck.students}</button></div>
            {source === "STUDENTS" && <div className="mt-2 flex flex-wrap gap-1.5">{studentTrees.map((student) => <button key={student.key} type="button" onClick={() => setStudentTreeKey(student.key)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", student.key === studentTreeKey ? "bg-accent-soft text-accent ring-1 ring-accent" : "bg-surface-2 text-muted")}>{student.short}</button>)}</div>}
            <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface-2 p-2">{trees === null && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}{trees !== null && !tree && <p className="p-3 text-sm text-faint">{source === "MINE" ? t.wordDeck.noVocab : t.wordDeck.noStudents}</p>}{roots.map((root) => renderBranch(root))}</div>
            <p className="mt-2 text-xs font-semibold text-faint">{fmt(t.wordDeck.vocabsSelected, { n: nodeIds.length })}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2"><button type="button" disabled={groups.length < 2} onClick={() => setActiveGroup((index) => (index - 1 + groups.length) % groups.length)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted disabled:opacity-30"><IconChevronLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1 text-center"><p className="truncate text-sm font-black text-content">{currentGroup ? `${currentGroup.icon ?? "📘"} ${currentGroup.name}` : t.wordDeck.pickVocabs}</p>{groups.length > 0 && <p className="text-[11px] text-faint">{activeGroup + 1} / {groups.length}</p>}</div><button type="button" disabled={groups.length < 2} onClick={() => setActiveGroup((index) => (index + 1) % groups.length)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted disabled:opacity-30"><IconChevronRight className="h-4 w-4" /></button></div>
            {loadingWords && <p className="p-3 text-sm text-faint">{t.common.loading}</p>}
            {!loadingWords && currentGroup && <><div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3"><span className="text-xs text-faint">{fmt(t.wordDeck.selectedInVocab, { selected: currentGroup.words.filter((word) => selected.has(word.phraseId) && readyForMode(word, mode)).length, total: currentGroup.words.filter((word) => readyForMode(word, mode)).length })}</span><div className="flex gap-2"><button type="button" onClick={() => setSelected((current) => { const next = new Set(current); currentGroup.words.filter((word) => readyForMode(word, mode)).forEach((word) => next.add(word.phraseId)); return next; })} className="text-xs font-bold text-accent">{t.wordDeck.selectAll}</button><button type="button" onClick={() => setSelected((current) => { const next = new Set(current); currentGroup.words.forEach((word) => next.delete(word.phraseId)); return next; })} className="text-xs font-bold text-muted">{t.wordDeck.selectNone}</button></div></div><div className="mt-2 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">{currentGroup.words.map((word) => { const unavailable = !readyForMode(word, mode); const checked = selected.has(word.phraseId) && !unavailable; return <button key={word.phraseId} type="button" disabled={unavailable} onClick={() => toggleWord(word.phraseId)} className={cn("flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold", checked ? "bg-accent-soft text-accent" : "bg-surface text-muted", unavailable && "opacity-40")}><span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-accent bg-accent text-white" : "border-line")}>{checked && <IconCheck className="h-3 w-3" />}</span><span className="truncate">{word.word}</span></button>; })}</div></>}
          </div>
        </div>
        <aside className="flex flex-col gap-3">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3"><span className="text-sm font-bold text-content">{t.game.seconds}</span><input type="number" min={3} max={120} value={seconds} onChange={(event) => setSeconds(Number(event.target.value) || 10)} className="h-9 w-20 rounded-xl border border-line bg-surface px-3 text-sm text-content" /></label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 p-3"><input type="checkbox" checked={shuffleWords} onChange={(event) => setShuffleWords(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" /><span><span className="block text-sm font-bold text-content">{t.game.shuffleWords}</span><span className="block text-xs text-faint">{t.game.shuffleWordsHint}</span></span></label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-surface-2 p-3"><input type="checkbox" checked={shuffleDecks} onChange={(event) => setShuffleDecks(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" /><span><span className="block text-sm font-bold text-content">{t.game.shuffleDecks}</span><span className="block text-xs text-faint">{t.game.shuffleDecksHint}</span></span></label>
          <div className={cn("rounded-2xl p-4", selectedEligible.length > 0 ? "bg-surface-2" : "bg-amber-500/10 ring-1 ring-amber-500/40")}><p className="text-xs font-bold text-muted">{t.wordDeck.summary}</p><p className="mt-2 text-3xl font-black text-content">{selectedEligible.length * (mode === "MIXED" ? 2 : 1)}</p><p className="text-xs text-faint">{t.wordDeck.cardsShort}</p></div>
        </aside>
      </div>
      {(error || externalError) && <p className="mt-4 text-sm font-semibold text-rose-500">{error || externalError}</p>}
      <div className="mt-6 flex items-center gap-3 border-t border-line pt-5"><button type="button" disabled={busy || !title.trim() || nodeIds.length === 0 || selectedEligible.length === 0} onClick={() => { setError(null); onSave({ id: preset?.id, title, nodeIds, phraseIds: selectedEligible, mode, shuffleWords, shuffleDecks, seconds }); }} className="h-11 rounded-xl bg-accent px-5 text-sm font-black text-white disabled:opacity-40">{busy ? t.wordDeck.saving : t.game.savePreset}</button><p className="text-xs text-faint">{t.game.snapshotHint}</p></div>
    </section>
  );
}
