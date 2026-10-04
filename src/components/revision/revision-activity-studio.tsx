"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  assignRevisionPresetAction,
  deleteRevisionPresetAction,
  listRevisionPresetsAction,
  previewRevisionPresetAction,
  type AttemptView,
  type RevisionPreset,
} from "@/lib/actions/revision";
import {
  listCopyTargetsAction,
  type CopyNode,
  type CopyTree,
} from "@/lib/actions/materials";
import {
  listWordDeckStudentsAction,
  type WordDeckStudent,
} from "@/lib/actions/word-deck";
import { RevisionSetup } from "@/components/revision/revision-setup";
import { RevisionRunner } from "@/components/revision/revision-runner";
import {
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconPlus,
  IconTrash,
  IconUsers,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type VocabularyChoice = { id: string; name: string; path: string };
type VocabularyBranch = CopyNode & { children: VocabularyBranch[] };

function vocabularyTree(nodes: CopyNode[]): VocabularyBranch[] {
  const included = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (node.type !== "FILE" || node.pageKind !== "VOCAB") continue;
    for (
      let current: CopyNode | undefined = node;
      current;
      current = current.parentId ? byId.get(current.parentId) : undefined
    ) {
      if (included.has(current.id)) break;
      included.add(current.id);
    }
  }

  const branches = new Map<string, VocabularyBranch>();
  nodes
    .filter((node) => included.has(node.id))
    .forEach((node) => branches.set(node.id, { ...node, children: [] }));

  const roots: VocabularyBranch[] = [];
  for (const branch of branches.values()) {
    const parent = branch.parentId ? branches.get(branch.parentId) : null;
    if (parent) parent.children.push(branch);
    else roots.push(branch);
  }
  return roots;
}

function vocabularyPath(tree: CopyTree, node: CopyNode): string {
  const byId = new Map(tree.nodes.map((item) => [item.id, item]));
  const parts = [node.name];
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent) {
    parts.unshift(parent.name);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return [tree.short, ...parts].join(" / ");
}

export function RevisionActivityStudio({
  initialPresets,
}: {
  initialPresets: RevisionPreset[];
}) {
  const { t } = useT();
  const [presets, setPresets] = useState(initialPresets);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [sort, setSort] = useState<"NEWEST" | "TITLE">("NEWEST");
  const [choosingSource, setChoosingSource] = useState(false);
  const [source, setSource] = useState<VocabularyChoice | null>(null);
  const [assigning, setAssigning] = useState<RevisionPreset | null>(null);
  const [playing, setPlaying] = useState<RevisionPreset | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const sorted = useMemo(
    () => [...presets].sort((left, right) =>
      sort === "TITLE"
        ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
        : new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [presets, sort],
  );

  const reload = async () => setPresets(await listRevisionPresetsAction());

  return (
    <section className="activity-panel-in relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 -rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-3xl text-white shadow-lg shadow-emerald-500/20 transition-transform duration-200 hover:rotate-0 motion-reduce:transition-none">
          🧠
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-emerald-500">
            {t.revision.activityEyebrow}
          </p>
          <h2 className="mt-0.5 text-xl font-black text-content">{t.revision.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{t.revision.activitySubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setChoosingSource(true);
          }}
          className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-700 px-4 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
        >
          <IconPlus className="h-4 w-4" /> {t.revision.newPreset}
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.common.close}>
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {!presetsOpen ? (
        <button
          type="button"
          onClick={() => setPresetsOpen(true)}
          className="activity-panel-in group flex w-full items-center gap-4 rounded-2xl bg-surface-2/80 p-4 text-left ring-1 ring-line transition-all duration-200 hover:-translate-y-0.5 hover:ring-emerald-400 hover:shadow-md motion-reduce:transition-none"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 transition-colors duration-200 group-hover:bg-emerald-500 group-hover:text-white motion-reduce:transition-none">
            <IconFolder className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-black text-content">
              {t.wordDeck.presets}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{presets.length}</span>
            </span>
          </span>
          <IconChevronRight className="h-5 w-5 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-emerald-500 motion-reduce:transition-none" />
        </button>
      ) : (
        <div className="activity-panel-in flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line shadow-sm">
            <button type="button" onClick={() => setPresetsOpen(false)} className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-bold text-muted transition hover:border-accent hover:text-accent">
              <IconChevronLeft className="h-4 w-4" /> {t.wordDeck.back}
            </button>
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-black text-content">
              <IconFolder className="h-4 w-4 text-emerald-500" /> {t.wordDeck.presets}
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-faint">{presets.length}</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-faint">{t.wordDeck.sortBy}</span>
            <button type="button" onClick={() => setSort("TITLE")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "TITLE" ? "bg-emerald-500 text-white" : "bg-surface-2 text-muted")}>{t.wordDeck.sortTitle}</button>
            <button type="button" onClick={() => setSort("NEWEST")} className={cn("h-8 rounded-lg px-3 text-xs font-bold", sort === "NEWEST" ? "bg-emerald-500 text-white" : "bg-surface-2 text-muted")}>{t.wordDeck.sortNewest}</button>
          </div>

          {presets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center text-sm text-faint">
              {t.wordDeck.empty}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sorted.map((preset) => (
                <article key={preset.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-11 shrink-0 -rotate-3 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-2xl text-white shadow-lg">🧠</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black text-content">{preset.title}</span>
                      <span className="mt-0.5 block text-xs text-faint">
                        {fmt(t.revision.selected, { n: preset.phraseIds.length })} · {preset.modes.length} {t.revision.sections.toLowerCase()}
                      </span>
                      {preset.nodeName && <span className="mt-0.5 block truncate text-[11px] text-faint">{preset.nodeName}</span>}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    <button type="button" onClick={() => setPlaying(preset)} className="h-9 flex-1 rounded-xl bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500 hover:text-white dark:text-emerald-300">
                      ▶ {t.wordDeck.play}
                    </button>
                    <button type="button" onClick={() => setAssigning(preset)} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-white transition hover:bg-emerald-400">
                      <IconUsers className="h-4 w-4" /> {t.wordDeck.addToClass}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm(t.revision.presetDeleteConfirm)) return;
                        startBusy(async () => {
                          await deleteRevisionPresetAction(preset.id);
                          await reload();
                        });
                      }}
                      title={t.wordDeck.remove}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-faint transition hover:text-rose-500 disabled:opacity-50"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-faint">{t.revision.presetCopiesStay}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {choosingSource && (
        <VocabularyDialog
          onClose={() => setChoosingSource(false)}
          onChoose={(choice) => {
            setChoosingSource(false);
            setSource(choice);
          }}
        />
      )}

      {source && (
        <RevisionSetup
          purpose="PRESET"
          studentId=""
          studentName=""
          nodeId={source.id}
          nodeName={source.name}
          onClose={() => setSource(null)}
          onDone={async () => {
            setSource(null);
            setPresetsOpen(true);
            setNotice(t.revision.presetSaved);
            await reload();
          }}
        />
      )}

      {assigning && (
        <AssignRevisionDialog
          preset={assigning}
          onClose={() => setAssigning(null)}
          onDone={(message) => {
            setNotice(message);
            setAssigning(null);
          }}
        />
      )}

      {playing && (
        <RevisionPresetPlayer preset={playing} onClose={() => setPlaying(null)} />
      )}
    </section>
  );
}

function RevisionPresetPlayer({
  preset,
  onClose,
}: {
  preset: RevisionPreset;
  onClose: () => void;
}) {
  const { t } = useT();
  const [view, setView] = useState<AttemptView | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    previewRevisionPresetAction(preset.id)
      .then((result) => alive && setView(result))
      .catch(() => alive && setView(null));
    return () => { alive = false; };
  }, [preset.id]);

  if (typeof document === "undefined") return null;
  const card = {
    id: preset.id,
    title: preset.title,
    nodeId: preset.nodeId,
    nodeName: preset.nodeName,
    createdAt: preset.createdAt,
    dueAt: null,
    modes: preset.modes,
    words: preset.phraseIds.length,
    attempts: 0,
    lastFinishedAt: null,
    open: true,
    placement: "CLASS" as const,
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] isolate overflow-y-auto bg-slate-950/90 backdrop-blur-md" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex min-h-full items-center justify-center sm:p-6">
        <div className="revision-game-theme relative flex min-h-[100dvh] w-full max-w-5xl items-center justify-center overflow-hidden bg-canvas px-3 pb-5 pt-20 shadow-2xl sm:min-h-[min(44rem,calc(100dvh-3rem))] sm:rounded-[2rem] sm:px-8 sm:pb-8 sm:pt-20 sm:ring-1 sm:ring-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,.16),transparent_35%),radial-gradient(circle_at_90%_85%,rgba(20,184,166,.12),transparent_38%)]" />
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3 sm:left-6 sm:right-6 sm:top-6">
            <span className="flex min-w-0 items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-500 ring-1 ring-emerald-500/20">
              <span>🧠</span>
              <span className="truncate">{preset.title}</span>
            </span>
            <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5">× {t.wordDeck.close}</button>
          </div>
          <div className="relative w-full">
          {view === undefined && <p className="py-16 text-center text-sm font-semibold text-faint">{t.common.loading}</p>}
          {view === null && <p className="py-16 text-center text-sm font-semibold text-rose-500">{t.revision.failed}</p>}
          {view && <RevisionRunner card={card} embedded preview={view} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VocabularyDialog({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (choice: VocabularyChoice) => void;
}) {
  const { t } = useT();
  const [trees, setTrees] = useState<CopyTree[] | null>(null);
  const [sourceType, setSourceType] = useState<"PERSONAL" | "STUDENT" | "MATERIAL">("PERSONAL");
  const [studentTreeKey, setStudentTreeKey] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    listCopyTargetsAction()
      .then((rows) => {
        if (!alive) return;
        setTrees(rows);
        setStudentTreeKey(rows.find((tree) => tree.scope === "STUDENT")?.key ?? "");
      })
      .catch(() => alive && setTrees([]));
    return () => { alive = false; };
  }, []);

  const personalTree = trees?.find((tree) => tree.scope === "PERSONAL") ?? null;
  const sharedTree = trees?.find((tree) => tree.scope === "MATERIAL") ?? null;
  const studentTrees = trees?.filter((tree) => tree.scope === "STUDENT") ?? [];
  const activeTree = sourceType === "PERSONAL"
    ? personalTree
    : sourceType === "MATERIAL"
      ? sharedTree
      : studentTrees.find((tree) => tree.key === studentTreeKey) ?? null;
  const roots = vocabularyTree(activeTree?.nodes ?? []);

  const renderBranch = (node: VocabularyBranch, depth = 0): React.ReactNode => {
    const folder = node.type === "FOLDER";
    const open = !collapsed.has(node.id);
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            if (folder) {
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
              return;
            }
            if (!activeTree) return;
            onChoose({ id: node.id, name: node.name, path: vocabularyPath(activeTree, node) });
          }}
          style={{ paddingLeft: `${depth * 18 + 12}px` }}
          className="group flex min-h-11 w-full items-center gap-2 rounded-xl pr-3 text-left transition hover:bg-emerald-500/10"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-sm text-faint ring-1 ring-line group-hover:text-emerald-500">
            {folder ? (open ? "▾" : "▸") : (node.icon ?? "📚")}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-sm", folder ? "font-black text-content" : "font-bold text-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-300")}>
            {node.name}
          </span>
          {!folder && <IconChevronRight className="h-4 w-4 shrink-0 text-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
        </button>
        {folder && open && node.children.map((child) => renderBranch(child, depth + 1))}
      </div>
    );
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] isolate flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <h3 className="font-black text-content">{t.revision.newPreset}</h3>
            <p className="mt-1 text-sm text-muted">{t.revision.chooseVocabulary}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.common.close} className="mr-5 mt-5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-content sm:mr-6 sm:mt-6"><IconX className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 px-5 sm:px-6">
          {([
            ["PERSONAL", "📁", t.revision.myMaterials],
            ["STUDENT", "👥", t.revision.studentMaterials],
            ["MATERIAL", "🌐", t.revision.sharedBase],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceType(value)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center text-xs font-black ring-1 transition sm:min-h-12 sm:flex-row sm:text-sm",
                sourceType === value
                  ? "bg-emerald-500 text-white ring-emerald-500 shadow-sm"
                  : "bg-surface-2 text-muted ring-line hover:ring-emerald-400",
              )}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {sourceType === "STUDENT" && (
          <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:px-6">
            {studentTrees.map((tree) => (
              <button
                key={tree.key}
                type="button"
                onClick={() => setStudentTreeKey(tree.key)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition",
                  studentTreeKey === tree.key
                    ? "bg-emerald-500/15 text-emerald-700 ring-emerald-400 dark:text-emerald-300"
                    : "bg-surface-2 text-muted ring-line hover:ring-emerald-400",
                )}
              >
                {tree.short}
              </button>
            ))}
            {trees !== null && studentTrees.length === 0 && <p className="py-2 text-sm text-faint">{t.revision.noStudentMaterials}</p>}
          </div>
        )}

        <div className="mx-5 mb-5 mt-4 min-h-56 flex-1 overflow-y-auto rounded-2xl bg-surface-2 p-2 ring-1 ring-line sm:mx-6 sm:mb-6">
          {trees === null && <p className="p-4 text-sm text-faint">{t.common.loading}</p>}
          {trees !== null && activeTree && roots.map((root) => renderBranch(root))}
          {trees !== null && (!activeTree || roots.length === 0) && (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-5 text-center">
              <span className="text-3xl opacity-60">📚</span>
              <p className="text-sm font-semibold text-faint">{t.revision.noVocabularyInSource}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AssignRevisionDialog({
  preset,
  onClose,
  onDone,
}: {
  preset: RevisionPreset;
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
      .catch(() => alive && setStudents([]));
    return () => { alive = false; };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-content">{t.wordDeck.addToClass}</h3>
            <p className="mt-1 text-sm text-muted">{preset.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-faint hover:text-content"><IconX className="h-5 w-5" /></button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-faint">{t.wordDeck.chooseStudent}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {students === null && <p className="text-sm text-faint">{t.common.loading}</p>}
          {students?.length === 0 && <p className="text-sm text-faint">{t.wordDeck.noStudents}</p>}
          {students?.map((student) => (
            <div key={student.id} className="rounded-xl bg-surface-2 p-2 ring-1 ring-line">
              <p className="px-1 text-sm font-black text-content">{student.name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    setError(null);
                    const result = await assignRevisionPresetAction(preset.id, student.id, "CLASS");
                    if (result.error) setError(result.error);
                    else onDone(fmt(result.existed ? t.revision.alreadyInClass : t.revision.assignedToClass, { title: preset.title, name: student.name }));
                  })}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent-soft px-2 text-xs font-bold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  <IconUsers className="h-3.5 w-3.5" /> {t.revision.lessonActivity}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startBusy(async () => {
                    setError(null);
                    const result = await assignRevisionPresetAction(preset.id, student.id, "HOMEWORK");
                    if (result.error) setError(result.error);
                    else onDone(fmt(t.revision.assignedToHomework, { title: preset.title, name: student.name }));
                  })}
                  className="flex h-10 items-center justify-center rounded-lg bg-emerald-500 px-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  ✓ {t.revision.homeworkActivity}
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
