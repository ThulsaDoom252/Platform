"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconChart,
  IconMaterials,
  IconSettings,
} from "@/components/icons";

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useT();

  const items = [
    { href: "/teacher", label: t.nav.home, Icon: IconHome, exact: true },
    { href: "/teacher/students", label: t.nav.students, Icon: IconUsers },
    { href: "/teacher/schedule", label: t.nav.schedule, Icon: IconCalendar },
    { href: "/teacher/accounts", label: t.nav.finances, Icon: IconChart },
    { href: "/teacher/materials", label: t.nav.materials, Icon: IconMaterials },
    { href: "/teacher/settings", label: t.nav.settings, Icon: IconSettings },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
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
