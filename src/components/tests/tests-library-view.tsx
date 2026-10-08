"use client";

import Link from "next/link";
import type { MouseEvent, Ref } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, BookText, ChevronRight, ClipboardCheck, Folder, FolderOpen, Headphones, Languages, PenLine, SpellCheck2, Trophy, type LucideIcon } from "lucide-react";
import { fmt, type Dict } from "@/lib/i18n";
import { TEST_CATEGORIES, TEST_LEVELS, testLibraryHref, type TestCategoryId, type TestLibraryLocation } from "@/lib/test-library";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<TestCategoryId, LucideIcon> = {
  grammar: SpellCheck2,
  vocabulary: BookText,
  listening: Headphones,
  reading: BookOpen,
  "use-of-english": Languages,
  writing: PenLine,
  exams: Trophy,
};

const FOLDER_GRADIENTS = [
  "linear-gradient(135deg, var(--c1), var(--c1b))",
  "linear-gradient(135deg, var(--c2), var(--c2b))",
  "linear-gradient(135deg, var(--c3), var(--c3b))",
  "linear-gradient(135deg, var(--c4), var(--c4b))",
];

export function TestsLibraryView({
  location, labels, onNavigate, headingRef,
}: {
  location: TestLibraryLocation;
  labels: Dict["testsLibrary"];
  onNavigate?: (location: TestLibraryLocation) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const level = TEST_LEVELS.find((item) => item.id === location.level);
  const category = level ? location.category : null;
  const CategoryIcon = category ? CATEGORY_ICONS[category] : ClipboardCheck;

  function navigate(event: MouseEvent<HTMLAnchorElement>, next: TestLibraryLocation) {
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {level && (
        <nav aria-label={labels.breadcrumb} className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <Link href={testLibraryHref()} prefetch={false} onClick={(event) => navigate(event, { level: null, category: null })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 transition hover:bg-surface-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{labels.title}
          </Link>
          <ChevronRight className="h-3 w-3 text-faint" aria-hidden />
          {category ? (
            <Link href={testLibraryHref(level.id)} prefetch={false} onClick={(event) => navigate(event, { level: level.id, category: null })} className="inline-flex min-h-9 items-center rounded-lg px-2 transition hover:bg-surface-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{level.label}</Link>
          ) : <span aria-current="page" className="text-accent">{level.label}</span>}
          {category && <><ChevronRight className="h-3 w-3 text-faint" aria-hidden /><span aria-current="page" className="text-accent">{labels.categoryNames[category]}</span></>}
        </nav>
      )}

      <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[24px] border-accent/5" />
        <div className="relative flex flex-wrap items-start gap-4 sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/15 sm:h-16 sm:w-16">
            <CategoryIcon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.7} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 ref={headingRef} tabIndex={-1} className="break-words text-2xl font-bold tracking-tight text-content outline-none sm:text-3xl">
              {category ? labels.categoryNames[category] : level ? `${level.label} · ${labels.title}` : labels.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{category ? labels.categoryHints[category] : level ? labels.levelHint : labels.subtitle}</p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2 text-[11px] font-bold sm:ml-auto">
            {level ? <span className="rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-accent">{level.label}</span> : <span className="rounded-xl border border-line bg-surface px-3 py-2 text-muted">{fmt(labels.levelCount, { n: TEST_LEVELS.length })}</span>}
            {!category && <span className="rounded-xl border border-line bg-surface px-3 py-2 text-muted">{fmt(labels.categoryCount, { n: TEST_CATEGORIES.length })}</span>}
          </div>
        </div>
      </header>

      {!level ? (
        <section aria-label={labels.levels}>
          <h2 className="mb-4 text-sm font-bold text-content">{labels.levels}</h2>
          <div data-tests-levels className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {TEST_LEVELS.map((item, index) => (
              <Link key={item.id} data-test-level={item.id} href={testLibraryHref(item.id)} prefetch={false} onClick={(event) => navigate(event, { level: item.id, category: null })} className="group relative flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-safe:hover:-translate-y-0.5">
                <div aria-hidden className="absolute inset-x-0 top-0 h-1 opacity-70" style={{ background: FOLDER_GRADIENTS[index % FOLDER_GRADIENTS.length] }} />
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: FOLDER_GRADIENTS[index % FOLDER_GRADIENTS.length] }}><Folder className="h-7 w-7" strokeWidth={1.6} aria-hidden /></span>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold tracking-tight text-content">{item.label}</h3>
                    <p className="mt-1 text-xs text-muted">{fmt(labels.categoryCount, { n: TEST_CATEGORIES.length })}</p>
                  </div>
                  <ArrowUpRight className="ml-auto h-5 w-5 shrink-0 text-faint transition group-hover:text-accent" aria-hidden />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs font-bold text-accent">{labels.openFolder}</span>
                  <ChevronRight className="h-4 w-4 text-faint transition group-hover:text-accent motion-safe:group-hover:translate-x-1" aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : !category ? (
        <section aria-label={labels.categories} className="flex min-w-0 flex-col gap-4">
          <nav aria-label={labels.levels} className="flex flex-wrap gap-2">
            {TEST_LEVELS.map((item) => <Link key={item.id} href={testLibraryHref(item.id)} prefetch={false} onClick={(event) => navigate(event, { level: item.id, category: null })} aria-current={item.id === level.id ? "page" : undefined} className={cn("inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent", item.id === level.id ? "border-accent bg-accent text-white shadow-sm" : "border-line bg-surface text-muted hover:border-accent/40 hover:text-accent")}>{item.label}</Link>)}
          </nav>
          <h2 className="mt-1 text-sm font-bold text-content">{labels.categories}</h2>
          <div data-tests-categories className="flex flex-col gap-3">
            {TEST_CATEGORIES.map((item, index) => {
              const Icon = CATEGORY_ICONS[item];
              return (
                <Link key={item} data-test-category={item} href={testLibraryHref(level.id, item)} prefetch={false} onClick={(event) => navigate(event, { level: level.id, category: item })} className="group flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4 transition hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:gap-4 sm:px-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="h-6 w-6" strokeWidth={1.7} aria-hidden /></span>
                  <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold text-content sm:text-base">{labels.categoryNames[item]}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{labels.categoryHints[item]}</p></div>
                  <span className="hidden text-[11px] font-semibold tabular-nums text-faint sm:block">{String(index + 1).padStart(2, "0")}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-faint transition group-hover:bg-accent group-hover:text-white"><ChevronRight className="h-4 w-4" aria-hidden /></span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <section data-tests-empty className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface px-5 py-10 text-center">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent-soft text-accent"><FolderOpen className="h-10 w-10" strokeWidth={1.4} aria-hidden /></span>
          <h2 className="text-lg font-bold text-content">{labels.emptyTitle}</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{labels.emptyHint}</p>
          <Link href={testLibraryHref(level.id)} prefetch={false} onClick={(event) => navigate(event, { level: level.id, category: null })} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"><ArrowLeft className="h-4 w-4" aria-hidden />{labels.allCategories}</Link>
        </section>
      )}
    </div>
  );
}
