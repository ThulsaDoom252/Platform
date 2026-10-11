"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, RotateCcw } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { remindAssignedTestAction, restartAssignedTestAction } from "@/lib/actions/tests";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestAttempt, TestReply } from "@/lib/tests/types";
import { TestDeadlineEditor } from "./test-deadline-editor";

type ControlActions = {
  remind: typeof remindAssignedTestAction;
  restart: typeof restartAssignedTestAction;
};
const actions: ControlActions = { remind: remindAssignedTestAction, restart: restartAssignedTestAction };

export function TestAssignmentControls({ assignmentId, onRestarted, perform = actions, dueAt, completed, onDeadlineSaved }: {
  assignmentId: string; onRestarted?: (attempt: TestAttempt) => void; perform?: ControlActions;
  dueAt?: string | null; completed?: boolean; onDeadlineSaved?: (dueAt: string | null) => void;
}) {
  const { locale } = useT();
  const labels = TEST_LABELS[locale];
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, startAction] = useTransition();
  const requests = useRef<{ reminder?: string; restart?: string }>({});

  function act(kind: "reminder" | "restart") {
    if (busy) return;
    const requestId = requests.current[kind] ??= crypto.randomUUID();
    startAction(async () => {
      setMessage(null); setError(false);
      try {
        const reply: TestReply<unknown> = kind === "reminder"
          ? await perform.remind({ assignmentId, requestId })
          : await perform.restart({ assignmentId, requestId, notifyStudent });
        if (!reply.ok) { setError(true); setMessage(reply.error === "forbidden" ? labels.forbidden : reply.error === "stale" ? labels.stale : labels.actionError); return; }
        delete requests.current[kind];
        setMessage(kind === "reminder" ? labels.reminderSent : labels.restarted);
        if (kind === "restart") { setConfirm(false); onRestarted?.(reply.value as TestAttempt); router.refresh(); }
      } catch { setError(true); setMessage(labels.actionError); }
    });
  }

  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => act("reminder")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs font-bold text-accent disabled:opacity-50"><Bell aria-hidden className="h-4 w-4" />{labels.remind}</button>
      <button type="button" disabled={busy} aria-expanded={confirm} onClick={() => { setConfirm((value) => !value); setMessage(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs font-bold text-muted hover:text-accent disabled:opacity-50"><RotateCcw aria-hidden className="h-4 w-4" />{labels.restart}</button>
    </div>
    {confirm && <div className="rounded-2xl border border-accent/30 bg-surface-2 p-4">
      <p className="text-sm leading-relaxed text-content">{labels.restartConfirm}</p>
      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted"><input type="checkbox" checked={notifyStudent} disabled={busy} onChange={(event) => setNotifyStudent(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />{labels.notify}</label>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-10 rounded-xl border border-line px-3 text-xs font-bold text-muted">{labels.cancel}</button><button type="button" disabled={busy} onClick={() => act("restart")} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? labels.loading : labels.restart}</button></div>
    </div>}
    <TestDeadlineEditor assignmentId={assignmentId} dueAt={dueAt} completed={completed} onSaved={onDeadlineSaved} />
    {message && <p role={error ? "alert" : "status"} className={`text-xs font-semibold ${error ? "text-[var(--t-rose)]" : "text-[var(--t-emerald)]"}`}>{message}</p>}
  </div>;
}
