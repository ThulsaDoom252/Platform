"use client";

import { useActionState } from "react";
import { useT } from "@/components/i18n-provider";
import { IconBell, IconCheck } from "@/components/icons";
import {
  sendManualNotificationAction,
  updateNotificationPolicyAction,
} from "@/lib/actions/profile";
import type { NotificationPolicy } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationSettings({
  policy,
  students,
}: {
  policy: NotificationPolicy;
  students: { id: string; name: string }[];
}) {
  const { t } = useT();
  const [manual, manualAction, pending] = useActionState(sendManualNotificationAction, {});
  const manualError = manual.error === "missing"
    ? t.notifications.manualMissing
    : manual.error === "notFound"
      ? t.notifications.manualStudentMissing
      : manual.error
        ? t.notifications.manualForbidden
        : null;
  const choices: Array<{ value: NotificationPolicy; title: string; hint: string }> = [
    { value: "ALWAYS", title: t.settings.notificationAlways, hint: t.settings.notificationAlwaysHint },
    { value: "NEVER", title: t.settings.notificationNever, hint: t.settings.notificationNeverHint },
    { value: "CONFIRM", title: t.settings.notificationConfirm, hint: t.settings.notificationConfirmHint },
  ];

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <IconBell className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-content">{t.settings.notificationSettings}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.notificationSettingsHint}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {choices.map((choice) => (
          <form key={choice.value} action={updateNotificationPolicyAction}>
            <input type="hidden" name="policy" value={choice.value} />
            <button
              type="submit"
              className={cn(
                "flex h-full w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                policy === choice.value
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface-2 hover:border-accent/50",
              )}
            >
              <span className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                policy === choice.value ? "border-accent bg-accent text-white" : "border-line bg-surface",
              )}>
                {policy === choice.value && <IconCheck className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-black text-content">{choice.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{choice.hint}</span>
              </span>
            </button>
          </form>
        ))}
      </div>

      <form action={manualAction} className="mt-6 rounded-2xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-black text-content">{t.notifications.manualTitle}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">
            {t.common.student}
            <select name="studentId" required className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-content outline-none focus:border-accent">
              <option value="">—</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">
            {t.notifications.manualMessage}
            <input name="message" required maxLength={500} placeholder={t.notifications.manualPlaceholder} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-content outline-none focus:border-accent" />
          </label>
          <button type="submit" disabled={pending} className="h-11 rounded-xl bg-accent px-5 text-sm font-black text-white shadow-sm disabled:opacity-50">
            {t.notifications.send}
          </button>
        </div>
        {manualError && <p className="mt-2 text-xs font-bold text-rose-500">{manualError}</p>}
        {manual.ok && <p className="mt-2 text-xs font-bold text-emerald-600">{t.notifications.manualSent}</p>}
      </form>
    </section>
  );
}
