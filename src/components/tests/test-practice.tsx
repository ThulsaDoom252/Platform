"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { testLibraryHref } from "@/lib/test-library";
import { TEST_LABELS } from "@/lib/tests/labels";
import type { TestDefinition } from "@/lib/tests/types";
import { TestAssigner } from "./test-assigner";
import { TestRunner } from "./test-runner";

export function TestPractice({ test }: { test: TestDefinition }) {
  const { t, locale } = useT();
  const labels = TEST_LABELS[locale];
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <Link href={testLibraryHref(test.level, test.category)} className="flex min-h-10 w-fit items-center gap-2 rounded-xl px-2 text-xs font-bold text-muted hover:bg-surface-2 hover:text-accent"><ArrowLeft aria-hidden className="h-4 w-4" />{labels.tests} · {test.level.toUpperCase()} · {t.testsLibrary.categoryNames[test.category]}</Link>
    <header className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent-soft via-surface to-surface p-6 sm:p-8">
      <ClipboardCheck aria-hidden className="pointer-events-none absolute -right-2 -top-2 h-40 w-40 text-accent opacity-5" />
      <p className="relative text-[11px] font-bold uppercase tracking-[.15em] text-accent">{test.level.toUpperCase()} · {t.testsLibrary.categoryNames[test.category]}</p>
      <h1 className="relative mt-2 text-2xl font-black tracking-tight text-content sm:text-3xl">{test.title}</h1>
      <p className="relative mt-2 text-sm text-muted">{test.subtitle}</p>
    </header>
    <TestAssigner test={test} />
    <div className="px-1"><h2 className="text-sm font-bold text-accent">{labels.practice}</h2><p className="mt-1 text-xs text-muted">{labels.practiceHint}</p></div>
    <TestRunner test={test} />
  </div>;
}
