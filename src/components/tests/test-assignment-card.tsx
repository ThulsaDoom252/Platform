import Link from "next/link";
import Image from "next/image";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { TestHomeworkCard } from "@/lib/tests/types";
import { TEST_LABELS } from "@/lib/tests/labels";
import { testTone } from "./test-result-view";
import { TestAssignmentControls } from "./test-assignment-controls";
import { TestDeadlineBadge } from "./test-deadline-badge";

export function TestAssignmentCard({ item, teacher, locale }: { item: TestHomeworkCard; teacher?: boolean; locale: Locale }) {
  const labels = TEST_LABELS[locale];
  return <section className="overflow-hidden rounded-2xl border border-line bg-surface">
  <Link href={teacher ? `/teacher/homeworks/tests/${item.id}` : `/student/tests/${item.id}`} prefetch={false} className="group flex flex-col gap-3 p-5 transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
    {item.cover && <Image src={item.cover.src} alt={item.cover.alt} width={item.cover.width} height={item.cover.height} className="h-36 w-full rounded-xl bg-surface-2 object-contain" />}
    <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><ClipboardCheck aria-hidden className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-accent">{labels.tests}</p><h3 className="mt-1 text-sm font-bold text-content">{item.title}</h3><p className="mt-1 text-xs text-muted">{labels.exercises}: {item.exerciseIds.map((id) => id.replace("exercise-", "")).join(", ")}</p></div><ChevronRight aria-hidden className="mt-3 h-4 w-4 shrink-0 text-faint group-hover:text-accent" /></div>
    {teacher && <p className="text-sm font-bold text-content">{labels.student}: {item.studentName}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-bold text-muted">{item.submittedAt ? labels.done : item.started ? labels.inProgress : labels.notStarted}</span>{item.latestPercent !== null && <strong style={testTone(item.latestPercent)} className="text-2xl font-black text-[var(--test-tone)]">{item.latestPercent}%</strong>}</div>
    <TestDeadlineBadge dueAt={item.dueAt} locale={locale} completed={!!item.submittedAt} />
    <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-[10px] font-semibold text-faint"><span>{labels.assignedOn}: {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Europe/Simferopol" }).format(new Date(item.assignedAt))}</span><span>{labels.attempt}: {item.attemptCount}</span></div>
  </Link>
  {teacher && <div className="border-t border-line p-4"><TestAssignmentControls assignmentId={item.id} dueAt={item.dueAt} completed={!!item.submittedAt} /></div>}
  </section>;
}
