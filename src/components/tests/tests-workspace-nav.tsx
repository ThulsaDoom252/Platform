"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Users } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { TEST_LABELS } from "@/lib/tests/labels";
import { cn } from "@/lib/utils";

export function TestsWorkspaceNav() {
  const { locale } = useT();
  const pathname = usePathname();
  const labels = TEST_LABELS[locale];
  const assigned = pathname.startsWith("/teacher/tests/assigned");
  return <nav aria-label={labels.tests} className="mx-auto mb-5 flex w-full max-w-6xl flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2">
    {[{ href: "/teacher/tests", label: labels.library, Icon: BookOpen, active: !assigned },
      { href: "/teacher/tests/assigned", label: labels.assignedTests, Icon: Users, active: assigned }].map(({ href, label, Icon, active }) =>
      <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold transition", active ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content")}><Icon aria-hidden className="h-4 w-4" />{label}</Link>)}
  </nav>;
}
