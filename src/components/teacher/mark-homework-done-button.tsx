"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { IconCheckCircle } from "@/components/icons";
import { markHomeworkDoneAction } from "@/lib/actions/homework-completion";
import type { HomeworkDoneResult } from "@/lib/homework-completion";

/** The callback keeps the confirmation UI testable without touching student records. */
export function HomeworkDoneControl({ onConfirm, onDone }: {
  onConfirm: () => Promise<HomeworkDoneResult>;
  onDone?: (reviewedAt: string) => void;
}) {
  const { t } = useT();
  const labels = t.teacherHomeworks;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, startComplete] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setOpen(false); setError(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    cancel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); };
  }, [open, busy]);
  return <>
    <button ref={trigger} type="button" title={labels.markHomeworkDone} aria-label={labels.markHomeworkDone}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { setError(false); setOpen(true); }}
      className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 text-xs font-black text-emerald-700 ring-1 ring-emerald-500/35 transition hover:bg-emerald-600 hover:text-white dark:text-emerald-300">
      <IconCheckCircle className="h-4 w-4" /><span>Done</span>
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-hint`}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500"><IconCheckCircle className="h-6 w-6" /></div>
        <h2 id={`${id}-heading`} className="mt-4 text-lg font-black text-content">{labels.markHomeworkDone}</h2>
        <p id={`${id}-hint`} className="mt-2 text-sm leading-relaxed text-muted">{labels.markHomeworkDoneConfirm}</p>
        {error && <p role="alert" className="mt-3 text-sm font-bold text-rose-500">{labels.markHomeworkDoneError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancel} type="button" disabled={busy} onClick={close}
            className="h-10 rounded-xl px-4 text-sm font-bold text-muted ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-50">{labels.cancelHomeworkDone}</button>
          <button type="button" disabled={busy} onClick={() => {
            setError(false);
            startComplete(async () => {
              try {
                const result = await onConfirm();
                if (result.error || !result.reviewedAt) { setError(true); return; }
                close(); onDone?.(result.reviewedAt);
              } catch { setError(true); }
            });
          }} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">
            <IconCheckCircle className="h-4 w-4" />{busy ? labels.markingHomeworkDone : "Done"}
          </button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}

export function MarkHomeworkDoneButton({ assignmentId, onDone }: { assignmentId: string; onDone?: (reviewedAt: string) => void }) {
  const router = useRouter();
  return <HomeworkDoneControl onConfirm={() => markHomeworkDoneAction(assignmentId)} onDone={reviewedAt => {
    onDone?.(reviewedAt); router.refresh();
  }} />;
}
