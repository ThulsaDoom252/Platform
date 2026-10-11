"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { IconPencil, IconX } from "@/components/icons";
import { renameHomeworkTitleAction } from "@/lib/actions/homework-title";
import { HOMEWORK_TITLE_MAX_LENGTH, normalizeHomeworkTitle, type HomeworkTitleSaveResult } from "@/lib/homework-title";
import { cn } from "@/lib/utils";

/** Presentational editor with a save callback, also usable with isolated test data. */
export function HomeworkTitleEditor({ title, onSave, onSaved, showLabel = false }: {
  title: string;
  onSave: (title: string | null) => Promise<HomeworkTitleSaveResult>;
  onSaved?: (title: string | null) => void;
  showLabel?: boolean;
}) {
  const { t } = useT();
  const labels = t.teacherHomeworks;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [busy, startSave] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => { setOpen(false); setError(null); triggerRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault(); setOpen(false); setError(null); triggerRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); };
  }, [open, busy]);

  const save = (value: string | null) => {
    const submitted = value === null ? null : normalizeHomeworkTitle(value);
    if (value !== null && !submitted) { setError(labels.invalidHomeworkName); return; }
    setError(null);
    startSave(async () => {
      try {
        const result = await onSave(submitted);
        if (result.error) { setError(result.error === "invalid" ? labels.invalidHomeworkName : labels.renameHomeworkError); return; }
        onSaved?.(result.title !== undefined ? result.title : submitted);
        close();
      } catch { setError(labels.renameHomeworkError); }
    });
  };

  return <>
    <button ref={triggerRef} type="button" title={labels.renameHomework} aria-label={labels.renameHomework}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setDraft(title); setError(null); setOpen(true); }}
      className={cn("flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent-soft text-accent ring-1 ring-accent/25 transition hover:bg-accent hover:text-white", showLabel ? "px-3 text-xs font-black" : "w-9")}>
      <IconPencil className="h-4 w-4" />{showLabel && <span>{labels.renameHomework}</span>}
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-hint`}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><IconPencil className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h2 id={`${id}-heading`} className="text-lg font-black text-content">{labels.renameHomework}</h2>
            <p id={`${id}-hint`} className="mt-1 text-sm text-muted">{labels.renameHomeworkHint}</p></div>
          <button type="button" disabled={busy} aria-label={labels.cancelHomeworkName} onClick={close} className="rounded-lg p-1 text-muted hover:bg-surface-2 disabled:opacity-50"><IconX className="h-5 w-5" /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (!busy) save(draft); }} className="mt-5">
          <label htmlFor={`${id}-input`} className="text-sm font-bold text-content">{labels.homeworkName}</label>
          <input ref={inputRef} id={`${id}-input`} value={draft} maxLength={HOMEWORK_TITLE_MAX_LENGTH} disabled={busy}
            onChange={(event) => { setDraft(event.target.value); setError(null); }}
            aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            className="mt-2 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm font-semibold text-content outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60" />
          {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-semibold text-rose-500">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => save(null)} className="mr-auto rounded-xl px-2 py-2 text-xs font-bold text-muted hover:bg-surface-2 disabled:opacity-50">{labels.restoreHomeworkName}</button>
            <button type="button" disabled={busy} onClick={close} className="rounded-xl border border-line px-3 py-2.5 text-xs font-bold text-muted disabled:opacity-50">{labels.cancelHomeworkName}</button>
            <button type="submit" disabled={busy || !normalizeHomeworkTitle(draft)} className="rounded-xl bg-accent px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? labels.savingHomeworkName : labels.saveHomeworkName}</button>
          </div>
        </form>
      </div>
    </div>, document.body)}
  </>;
}

export function RenameHomeworkButton({ assignmentId, title, showLabel, onSaved }: {
  assignmentId: string; title: string; showLabel?: boolean; onSaved?: (title: string | null) => void;
}) {
  const router = useRouter();
  return <HomeworkTitleEditor title={title} showLabel={showLabel}
    onSave={(value) => renameHomeworkTitleAction(assignmentId, value)}
    onSaved={(value) => { onSaved?.(value); router.refresh(); }} />;
}
