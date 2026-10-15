"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { createLessonVocabularyFolderAction, notifyLessonVocabularyMaterialAction } from "@/lib/actions/lesson-vocabulary-materials";
import {
  addLessonVocabularyToMaterialsAction,
  lessonVocabularyMaterialTargetsAction,
  type LessonVocabularyMaterialTarget,
} from "@/lib/actions/lessons";
import { IconFolder, IconPlus, IconX } from "@/components/icons";
import { IconPicker } from "@/components/materials/icon-picker";
import { automaticMaterialIcon } from "@/lib/material-icon";

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
  iconOnly = false,
}: {
  unitId: string;
  lessonTitle: string;
  defaultStudentId?: string | null;
  iconOnly?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<LessonVocabularyMaterialTarget[]>([]);
  const [studentId, setStudentId] = useState("");
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState(`${lessonTitle} — Vocabulary`);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const automaticIcon = useMemo(() => automaticMaterialIcon(name), [name]);
  const icon = selectedIcon ?? automaticIcon;
  const dialogTitleId = useId();
  const iconPanelId = useId();
  const iconButton = useRef<HTMLButtonElement>(null);
  const triggerButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const folderSelect = useRef<HTMLSelectElement>(null);
  const restoreFocus = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ nodeId: string; studentName: string; sent?: boolean; error?: string } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, startBusy] = useTransition();

  const selected = targets.find((target) => target.id === studentId);
  const folders = useMemo(() => folderOptions(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocus.current = true;
    };
  }, [open]);

  useEffect(() => {
    if (busy) return;
    if (open && !creatingFolder) folderSelect.current?.focus();
    else if (!open && restoreFocus.current) {
      triggerButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [open, busy, creatingFolder]);

  const show = () => {
    setOpen(true);
    setError(null);
    setSuccess(null);
    setCreatingFolder(false);
    setFolderName("");
    setPickingIcon(false);
    setTargets([]);
    setStudentId("");
    setParentId("");
    startBusy(async () => {
      try {
        const next = await lessonVocabularyMaterialTargetsAction();
        setTargets(next);
        const preferred = next.some(student => student.id === defaultStudentId) ? defaultStudentId! : next.some(student => student.id === studentId) ? studentId : next[0]?.id ?? "";
        setStudentId(preferred);
        setParentId("");
      } catch { setError("Could not load student folders. Please try again."); }
    });
  };

  const createFolder = () => startBusy(async () => {
    setError(null);
    try {
      const result = await createLessonVocabularyFolderAction({ studentId, parentId: parentId || null, name: folderName });
      if (result.error || !result.folder) { setError(result.error ?? "Could not create the folder."); return; }
      const folder = result.folder;
      setTargets(current => current.map(target => target.id === studentId ? { ...target, folders: [...target.folders, folder] } : target));
      setParentId(folder.id);
      setFolderName("");
      setCreatingFolder(false);
    } catch { setError("Could not create the folder. Please try again."); }
  });

  return (
    <>
      <button
        ref={triggerButton}
        type="button"
        onClick={show}
        disabled={busy}
        title="Add to materials"
        aria-label="Add to materials"
        className={iconOnly ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50" : "flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"}
      >
        <IconPlus className="h-4 w-4" aria-hidden="true" />
        {!iconOnly && "Add to materials"}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} onKeyDown={(event) => {
            if (event.key === "Escape") { event.stopPropagation(); if (pickingIcon) { setPickingIcon(false); iconButton.current?.focus(); } else setOpen(false); }
            if (event.key === "Tab") {
              const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
              const first = controls?.[0], last = controls?.[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          }} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <IconFolder className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={dialogTitleId} className="text-lg font-black text-content">Add vocabulary to materials</h2>
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
                    setCreatingFolder(false);
                    setFolderName("");
                    setError(null);
                  }}
                  disabled={busy}
                  className="h-11 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                >
                  {targets.map((student) => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-[12px] font-bold text-content">
                Folder in the student&apos;s tree
                <select
                  ref={folderSelect}
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                  disabled={busy || !studentId}
                  className="h-11 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                >
                  <option value="">Root of personal materials</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.label}</option>
                  ))}
                </select>
              </label>

              <div className="-mt-2">
                {!creatingFolder ? <button type="button" disabled={busy || !studentId} onClick={() => { setCreatingFolder(true); setError(null); }} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-accent hover:bg-accent-soft disabled:opacity-50">
                  <IconPlus className="h-3.5 w-3.5" />New folder
                </button> : <div className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3">
                  <label className="grid gap-1 text-xs font-bold text-content">New folder name
                    <input autoFocus value={folderName} onChange={event => setFolderName(event.target.value)} maxLength={200} disabled={busy}
                      onKeyDown={event => { if (event.key === "Enter" && folderName.trim() && !busy) { event.preventDefault(); createFolder(); } }}
                      className="h-10 min-w-0 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-accent" />
                  </label>
                  <p className="break-words text-[11px] text-muted">Create inside: {folders.find(folder => folder.id === parentId)?.label ?? "Root of personal materials"}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" disabled={busy} onClick={() => setCreatingFolder(false)} className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold text-muted">Cancel</button>
                    <button type="button" disabled={busy || !folderName.trim()} onClick={createFolder} className="min-h-9 rounded-lg bg-accent px-3 text-xs font-bold text-white disabled:opacity-50">Create folder</button>
                  </div>
                </div>}
              </div>

              <label className="grid gap-1.5 text-[12px] font-bold text-content">
                Vocabulary name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  disabled={busy}
                  className="h-11 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-content outline-none focus:border-accent"
                />
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-bold text-content">Material icon</p>
                  <button type="button" disabled={busy || selectedIcon === null} onClick={() => setSelectedIcon(null)} className="text-[11px] font-bold text-accent transition hover:underline disabled:text-muted disabled:no-underline">Auto-select</button>
                </div>
                <button ref={iconButton} type="button" disabled={busy} aria-label="Choose material icon" aria-expanded={pickingIcon} aria-controls={iconPanelId} onClick={() => setPickingIcon((value) => !value)} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-left transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl">{icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-content">{pickingIcon ? "Close icon picker" : "Change icon"}</span><span className="block text-[11px] text-muted">{selectedIcon === null ? "Automatically selected from the name" : "Your selected icon"}</span></span>
                </button>
                {pickingIcon && <div id={iconPanelId} className="rounded-2xl border border-line bg-surface p-3">
                  <IconPicker value={icon} onChange={(next) => { setSelectedIcon(next); setPickingIcon(false); iconButton.current?.focus(); }} />
                </div>}
              </div>
            </div>

            {targets.length === 0 && !busy && (
              <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-500">
                No students found.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-500">{error}</p>
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
                disabled={busy || !studentId || !name.trim() || creatingFolder}
                onClick={() => startBusy(async () => {
                  setError(null);
                  setPickingIcon(false);
                  try {
                    const result = await addLessonVocabularyToMaterialsAction(unitId, {
                      studentId,
                      parentId: parentId || null,
                      name,
                      icon,
                    });
                    if (result.error || !result.nodeId) { setError(result.error ?? "Could not add vocabulary."); return; }
                    setOpen(false);
                    setSuccess({ nodeId: result.nodeId, studentName: selected?.name ?? "student" });
                  } catch { setError("Could not add vocabulary. Please try again."); }
                })}
                className="h-10 rounded-xl bg-accent px-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
      {success && createPortal(<section role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[300] mx-auto w-auto max-w-lg rounded-2xl border border-emerald-400 bg-surface p-4 text-content shadow-xl sm:left-auto sm:right-5 sm:top-5 sm:mx-0 sm:w-[min(28rem,calc(100vw-2.5rem))]">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>
          <div className="min-w-0 flex-1"><p className="font-black text-emerald-600">Added successfully</p>
            <p className="mt-1 break-words text-sm">{success.sent ? "Notification sent" : fmt(t.notifications.sendPrompt, { name: success.studentName })}</p>
            {success.error && <p className="mt-2 text-xs text-rose-500">{success.error}</p>}
          </div>
          <button type="button" disabled={busy} aria-label={t.common.close} onClick={() => setSuccess(null)} className="rounded-lg p-1 text-muted hover:bg-surface-2"><IconX className="h-4 w-4" /></button>
        </div>
        {!success.sent && <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setSuccess(null)} className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-muted disabled:opacity-50">{t.notifications.doNotSend}</button>
          <button type="button" disabled={busy} onClick={() => startBusy(async () => {
            try {
              const result = await notifyLessonVocabularyMaterialAction(success.nodeId);
              setSuccess(current => current?.nodeId === success.nodeId ? { ...current, sent: result.ok === true, error: result.error } : current);
            } catch { setSuccess(current => current ? { ...current, error: "Could not send the notification. Please try again." } : null); }
          })} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-black text-white disabled:opacity-50">{busy ? t.common.loading : t.notifications.send}</button>
        </div>}
      </section>, document.body)}
    </>
  );
}
