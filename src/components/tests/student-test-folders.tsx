import Link from "next/link";
import { ChevronRight, Folder, Users } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { TEST_LABELS } from "@/lib/tests/labels";
import { studentTestFolders } from "@/lib/tests/student-folders";
import type { TestHomeworkCard } from "@/lib/tests/types";

export function StudentTestFolders({ items, locale }: { items: TestHomeworkCard[]; locale: Locale }) {
  const labels = TEST_LABELS[locale];
  const folders = studentTestFolders(items, locale);
  return <section data-test-student-folders aria-labelledby="test-student-folders-heading" className="flex flex-col gap-4">
    <header><h2 id="test-student-folders-heading" className="flex items-center gap-2 text-xl font-black text-content"><Users aria-hidden className="h-5 w-5 text-accent" />{labels.studentFolders}</h2><p className="mt-2 text-sm text-muted">{labels.foldersHint}</p></header>
    {folders.length ? <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => <Link key={folder.id} data-test-student-folder={folder.id} href={`/teacher/tests/assigned/${folder.id}`} prefetch={false} className="group flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Folder aria-hidden className="h-6 w-6" /></span><h3 className="min-w-0 flex-1 break-words text-lg font-bold text-content">{folder.name}</h3><ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint group-hover:text-accent" /></div>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-accent-soft px-3 py-2 text-accent">Awaiting: {folder.awaiting}</span><span className="rounded-lg bg-surface-2 px-3 py-2 text-[var(--t-green)]">Passed tests: {folder.passed}</span></div>
        {folder.results.length > 0 && <ul className="flex flex-col gap-2 text-xs text-muted">{folder.results.slice(0, 3).map((result) => <li key={result.id} className="flex items-start justify-between gap-3"><span className="min-w-0 break-words">{result.title}</span><strong className="shrink-0 text-content">{result.percent === null ? "—" : `${result.percent}%`}</strong></li>)}</ul>}
        <p className="border-t border-line pt-3 text-xs font-bold text-accent">{labels.openFolder}</p>
      </Link>)}
    </div> : <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">{labels.noTestFolders}</p>}
  </section>;
}
