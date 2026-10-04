"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  assignRevisionPresetAction,
  deleteRevisionPresetAction,
  listRevisionPresetsAction,
  type RevisionPreset,
} from "@/lib/actions/revision";
import {
  listCopyTargetsAction,
  type CopyTree,
} from "@/lib/actions/materials";
import {
  listWordDeckStudentsAction,
  type WordDeckStudent,
} from "@/lib/actions/word-deck";
import { RevisionSetup } from "@/components/revision/revision-setup";
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
    </section>
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

  useEffect(() => {
    let alive = true;
    listCopyTargetsAction()
      .then((rows) => alive && setTrees(rows))
      .catch(() => alive && setTrees([]));
    return () => { alive = false; };
  }, []);

  const choices = useMemo(() => {
    if (!trees) return [];
    const result: VocabularyChoice[] = [];
    for (const tree of trees) {
      const byId = new Map(tree.nodes.map((node) => [node.id, node]));
      for (const node of tree.nodes) {
        if (node.type !== "FILE" || node.pageKind !== "VOCAB") continue;
        const parents: string[] = [];
        let parent = node.parentId ? byId.get(node.parentId) : undefined;
        while (parent) {
          parents.unshift(parent.name);
          parent = parent.parentId ? byId.get(parent.parentId) : undefined;
        }
        result.push({
          id: node.id,
          name: node.name,
          path: [tree.short, ...parents, node.name].join(" / "),
        });
      }
    }
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }, [trees]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-content">{t.revision.newPreset}</h3>
            <p className="mt-1 text-sm text-muted">{t.revision.chooseVocabulary}</p>
          </div>
          <button type="button" onClick={onClose} className="text-faint hover:text-content"><IconX className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {trees === null && <p className="text-sm text-faint">{t.common.loading}</p>}
          {trees !== null && choices.length === 0 && <p className="text-sm text-faint">{t.revision.noVocabulary}</p>}
          {choices.map((choice) => (
            <button key={choice.id} type="button" onClick={() => onChoose(choice)} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-left ring-1 ring-line transition hover:ring-emerald-400">
              <span className="text-xl">📚</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-content">{choice.name}</span>
                <span className="block truncate text-[11px] text-faint">{choice.path}</span>
              </span>
            </button>
          ))}
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
