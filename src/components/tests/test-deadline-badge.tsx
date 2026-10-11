import { CalendarClock } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatTestDeadline, testDeadlineOverdue } from "@/lib/tests/deadline";
import { TEST_LABELS } from "@/lib/tests/labels";

export function TestDeadlineBadge({ dueAt, locale, completed = false }: { dueAt?: string | null; locale: Locale; completed?: boolean }) {
  if (!dueAt) return null;
  const labels = TEST_LABELS[locale];
  const overdue = testDeadlineOverdue(dueAt, completed);
  return <p data-test-deadline className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${overdue ? "text-[var(--t-rose)]" : "text-muted"}`}><CalendarClock aria-hidden className="h-4 w-4 shrink-0" /><span>{labels.deadline}: <time dateTime={dueAt}>{formatTestDeadline(dueAt, locale)}</time></span>{overdue && <strong className="rounded-lg bg-accent-soft px-2 py-1">{labels.overdue}</strong>}</p>;
}
