import { CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestHomeworkCard } from "@/lib/tests/types";
import { TestAssignmentCard } from "./test-assignment-card";

/** Completion belongs to the current attempt; a restart returns the test to Awaiting. */
export function assignedTestSections(items: TestHomeworkCard[]) {
  return {
    awaiting: items.filter((item) => !item.submittedAt),
    passed: items.filter((item) => Boolean(item.submittedAt)),
  };
}

export function AssignedTestsList({ items, locale, teacher = false }: { items: TestHomeworkCard[]; locale: Locale; teacher?: boolean }) {
  const labels = TEST_LABELS[locale];
  const sections = assignedTestSections(items);
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
    <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:p-8">
      <ClipboardCheck aria-hidden className="pointer-events-none absolute -right-3 -top-3 h-40 w-40 text-accent opacity-5" />
      <p className="relative text-xs font-bold uppercase tracking-widest text-accent">{labels.tests}</p>
      <h1 className="relative mt-2 text-2xl font-black text-content sm:text-3xl">{labels.assignedTests}</h1>
      <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-muted">{teacher ? labels.assignmentsHint : labels.studentTestsHint}</p>
      <div className="relative mt-5 flex flex-wrap gap-2 text-xs font-bold text-muted"><span className="rounded-xl border border-line bg-surface px-3 py-2">{labels.assignedTests}: {items.length}</span><span className="rounded-xl border border-line bg-surface px-3 py-2">{labels.done}: {items.filter((item) => item.submittedAt).length}</span></div>
    </header>
    {sections.awaiting.length > 0 && <section aria-labelledby="awaiting-tests-heading" data-test-section="awaiting" className="flex flex-col gap-4">
      <h2 id="awaiting-tests-heading" className="flex items-center gap-2 text-lg font-black text-content"><Clock3 aria-hidden className="h-5 w-5 text-accent" />Awaiting<span className="rounded-lg bg-accent-soft px-2 py-1 text-xs text-accent">{sections.awaiting.length}</span></h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.awaiting.map((item) => <TestAssignmentCard key={item.id} item={item} locale={locale} teacher={teacher} />)}</div>
    </section>}
    {sections.passed.length > 0 && <section aria-labelledby="passed-tests-heading" data-test-section="passed" className="flex flex-col gap-4">
      <h2 id="passed-tests-heading" className="flex items-center gap-2 text-lg font-black text-content"><CheckCircle2 aria-hidden className="h-5 w-5 text-[var(--t-green)]" />Passed tests<span className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-[var(--t-green)]">{sections.passed.length}</span></h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{sections.passed.map((item) => <TestAssignmentCard key={item.id} item={item} locale={locale} teacher={teacher} />)}</div>
    </section>}
    {items.length === 0 && <p className="rounded-3xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">{labels.emptyAssignments}</p>}
  </div>;
}
