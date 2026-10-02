"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addLessonVocabularyToMaterialsAction,
  lessonVocabularyMaterialTargetsAction,
  type LessonVocabularyMaterialTarget,
} from "@/lib/actions/lessons";
import { IconFolder, IconPlus, IconX } from "@/components/icons";

function folderOptions(target: LessonVocabularyMaterialTarget | undefined) {
  if (!target) return [];
  const byId = new Map(target.folders.map((folder) => [folder.id, folder]));
  const path = (id: string) => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(" / ");
  };
  return target.folders
    .map((folder) => ({ id: folder.id, label: path(folder.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function LessonVocabToMaterials({
  unitId,
  lessonTitle,
  defaultStudentId,
}: {
  unitId: string;
  lessonTitle: string;
  defaultStudentId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<LessonVocabularyMaterialTarget[]>([]);
  const [studentId, setStudentId] = useState("");
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState(`${lessonTitle} — Vocabulary`);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const selected = targets.find((target) => target.id === studentId);
  const folders = useMemo(() => folderOptions(selected), [selected]);

  const show = () => {
    setOpen(true);
    setError(null);
    setDone(null);
    if (targets.length > 0) return;
    startBusy(async () => {
      const next = await lessonVocabularyMaterialTargetsAction();
      setTargets(next);
      setStudentId(
        next.some((student) => student.id === defaultStudentId)
          ? defaultStudentId!
          : (next[0]?.id ?? ""),
      );
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
      >
        <IconPlus className="h-3.5 w-3.5" />
        Add to materials
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <IconFolder className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-content">Add vocabulary to materials</h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  A full copy with examples, hints, category colors and images.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content"
                aria-label="Close"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-[12px] font-bold text-content">
                Student
                <select
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value);
                    setParentId("");
                    setDone(null);
                  }}
                  disabled={busy}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                >
                  {targets.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-[12px] font-bold text-content">
                Folder in the student&apos;s tree
                <select
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  disabled={busy || !studentId}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                >
                  <option value="">Root of personal materials</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-[12px] font-bold text-content">
                Vocabulary name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                />
              </label>
            </div>

            {targets.length === 0 && !busy && (
              <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-500">
                No students found.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-500">{error}</p>
            )}
            {done && (
              <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-600">{done}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-xl border border-line px-4 text-sm font-bold text-muted transition hover:text-content"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy || !studentId || !name.trim()}
                onClick={() => startBusy(async () => {
                  setError(null);
                  setDone(null);
                  const result = await addLessonVocabularyToMaterialsAction(unitId, {
                    studentId,
                    parentId: parentId || null,
                    name,
                  });
                  if (result.error) setError(result.error);
                  else setDone("Vocabulary added to the student's materials.");
                })}
                className="h-10 rounded-xl bg-accent px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
