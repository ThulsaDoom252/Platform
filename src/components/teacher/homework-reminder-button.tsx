"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconBell, IconCheck } from "@/components/icons";
import { sendHomeworkReminderAction } from "@/lib/actions/homework-reminders";
import { fmt } from "@/lib/i18n";
import type { HomeworkReminderTarget } from "@/lib/homework-reminders";
import { cn } from "@/lib/utils";

export function HomeworkReminderButton({ target, title, exerciseTitle, showLabel = false, disabled = false, small = false }: {
  target: HomeworkReminderTarget;
  title: string;
  exerciseTitle?: string;
  showLabel?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const { t } = useT();
  const [busy, startSend] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = exerciseTitle ? t.notifications.remindExercise : t.notifications.remindHomework;
  const send = () => {
    if (!window.confirm(fmt(t.notifications.reminderConfirm, { title: exerciseTitle && exerciseTitle !== title ? `${title} — ${exerciseTitle}` : title }))) return;
    setError(null); setSent(false);
    startSend(async () => {
      try {
        const result = await sendHomeworkReminderAction(target);
        if (!result.sent) { setError(result.error === "unavailable" ? t.notifications.reminderUnavailable : t.notifications.reminderFailed); return; }
        setSent(true);
      } catch { setError(t.notifications.reminderFailed); }
    });
  };
  return <span className="relative inline-flex shrink-0" data-no-lesson-highlight>
    <button type="button" disabled={disabled || busy} onClick={send}
      aria-label={label} title={disabled ? t.notifications.reminderUnavailable : sent ? t.notifications.reminderSent : label}
      className={cn("flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent-soft text-accent ring-1 ring-accent/25 transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-40",
        small ? "h-8" : "h-9", showLabel ? "px-3 text-xs font-black" : small ? "w-8" : "w-9", sent && "ring-emerald-500/60") }>
      {sent ? <IconCheck className="h-4 w-4" /> : <IconBell className={cn("h-4 w-4", busy && "animate-pulse")} />}
      {showLabel && <span>{label}</span>}
    </button>
    <span role="status" className="sr-only">{sent ? t.notifications.reminderSent : ""}</span>
    {error && <span role="alert" className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-rose-400/40 bg-surface p-3 text-xs font-bold text-rose-500 shadow-xl">{error}</span>}
  </span>;
}
