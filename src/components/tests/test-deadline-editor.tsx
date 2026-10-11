"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { updateTestDeadlineAction } from "@/lib/actions/tests";
import { parseTestDeadlineInput, testDeadlineInputValue } from "@/lib/tests/deadline";
import { TEST_LABELS } from "@/lib/tests/labels";

export function TestDeadlineEditor({ assignmentId, dueAt, completed = false, onSaved, perform = updateTestDeadlineAction }: {
  assignmentId: string; dueAt?: string | null; completed?: boolean;
  onSaved?: (dueAt: string | null) => void; perform?: typeof updateTestDeadlineAction;
}) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const router = useRouter();
  const inputId = useId();
  const [deadline, setDeadline] = useState({ source: dueAt ?? null, value: dueAt ?? null });
  const stored = deadline.source === (dueAt ?? null) ? deadline.value : dueAt ?? null;
  if (deadline.source !== (dueAt ?? null)) setDeadline({ source: dueAt ?? null, value: dueAt ?? null });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, startAction] = useTransition();

  function save(next: string | null) {
    if (busy) return;
    if (next !== null && new Date(next).getTime() <= Date.now()) { setError(true); setMessage(labels.invalidDeadline); return; }
    startAction(async () => {
      setMessage(null); setError(false);
      try {
        const reply = await perform({ assignmentId, dueAt: next });
        if (!reply.ok) { setError(true); setMessage(reply.error === "completed" ? labels.completedDeadline : reply.error === "invalid" ? labels.invalidDeadline : reply.error === "forbidden" ? labels.forbidden : labels.actionError); return; }
        setDeadline({ source: dueAt ?? null, value: reply.value.dueAt }); setOpen(false); onSaved?.(reply.value.dueAt);
        setMessage(reply.value.dueAt ? labels.deadlineSaved : labels.deadlineRemoved); router.refresh();
      } catch { setError(true); setMessage(labels.actionError); }
    });
  }

  if (completed) return null;
  return <div className="flex flex-col gap-3">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setOpen((value) => !value); setMessage(null); }} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs font-bold text-muted hover:text-accent disabled:opacity-50"><CalendarClock aria-hidden className="h-4 w-4" />{stored ? labels.editDeadline : labels.setDeadline}</button>
    {open && <form onSubmit={(event) => { event.preventDefault(); const value = parseTestDeadlineInput(String(new FormData(event.currentTarget).get("dueAt") ?? "")); if (!value) { setError(true); setMessage(labels.invalidDeadline); return; } save(value); }} className="min-w-0 rounded-2xl border border-line bg-surface-2 p-4">
      <label htmlFor={inputId} className="block text-xs font-bold text-content">{labels.deadline}</label>
      <input id={inputId} name="dueAt" type="datetime-local" required step={60} defaultValue={testDeadlineInputValue(stored)} disabled={busy} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-content [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-accent" />
      <p className="mt-2 text-[11px] text-muted">{labels.deadlineTimeZone}</p>
      <div className="mt-4 flex flex-wrap gap-2">{stored && <button type="button" disabled={busy} onClick={() => save(null)} className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-[var(--t-rose)] disabled:opacity-50">{labels.removeDeadline}</button>}<button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-muted">{labels.cancel}</button><button type="submit" disabled={busy} className="min-h-10 rounded-xl bg-accent px-3 text-xs font-bold text-white disabled:opacity-50">{busy ? labels.loading : labels.saveDeadline}</button></div>
    </form>}
    {message && <p role={error ? "alert" : "status"} className={`text-xs font-semibold ${error ? "text-[var(--t-rose)]" : "text-[var(--t-emerald)]"}`}>{message}</p>}
  </div>;
}
