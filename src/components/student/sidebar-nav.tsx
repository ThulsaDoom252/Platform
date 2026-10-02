"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { RAIL_ONLY_OPEN } from "@/components/sidebar-rail";
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
  const searchParams = useSearchParams();
  const { t } = useT();

  const items = [
    { href: "/student/class", label: t.nav.myClass, Icon: IconCap },
    { href: "/student/materials", label: t.nav.materials, Icon: IconMaterials },
    { href: "/student/homework", label: t.nav.homework, Icon: IconCheckCircle },
    { href: "/student/schedule", label: t.nav.schedule, Icon: IconCalendar },
    { href: "/student/messages", label: t.nav.messages, Icon: IconMessage },
    { href: "/student/statistics", label: t.nav.statistics, Icon: IconChart },
    { href: "/student/settings", label: t.nav.settings, Icon: IconSettings },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href) || (
          href === "/student/homework" &&
          pathname.startsWith("/student/lessons/") &&
          searchParams.get("section") === "homework"
        );
        return (
          <Link
            key={href}
            href={href}
            /* В свёрнутой полосе подписи не видно — выручает подсказка. */
            title={label}
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
            <span className={cn("whitespace-nowrap", RAIL_ONLY_OPEN)}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
