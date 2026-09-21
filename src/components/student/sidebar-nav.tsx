"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import {
  IconCap,
  IconMaterials,
  IconCalendar,
  IconMessage,
  IconChart,
  IconSettings,
  IconCheckCircle,
} from "@/components/icons";

export function StudentSidebarNav() {
  const pathname = usePathname();
  const { t } = useT();

  const items = [
    { href: "/student/class", label: t.nav.myClass, Icon: IconCap },
    { href: "/student/homework", label: t.nav.homework, Icon: IconCheckCircle },
    { href: "/student/materials", label: t.nav.materials, Icon: IconMaterials },
    { href: "/student/schedule", label: t.nav.schedule, Icon: IconCalendar },
    { href: "/student/messages", label: t.nav.messages, Icon: IconMessage },
    { href: "/student/statistics", label: t.nav.statistics, Icon: IconChart },
    { href: "/student/settings", label: t.nav.settings, Icon: IconSettings },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-accent-soft text-accent shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                active ? "text-accent" : "text-faint group-hover:text-muted",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
