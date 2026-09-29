"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RAIL_ONLY_OPEN } from "@/components/sidebar-rail";
import { useT } from "@/components/i18n-provider";
import {
  IconCap,
  IconFile,
  IconHome,
  IconUsers,
  IconCalendar,
  IconChart,
  IconMaterials,
  IconSettings,
  IconVolume,
  IconFire,
  IconLayers,
} from "@/components/icons";

export function SidebarNav() {
  const pathname = usePathname();
  const { t } = useT();

  const items = [
    { href: "/teacher/class", label: t.nav.myClass, Icon: IconCap },
    { href: "/teacher", label: t.nav.home, Icon: IconHome, exact: true },
    { href: "/teacher/students", label: t.nav.students, Icon: IconUsers },
    { href: "/teacher/schedule", label: t.nav.schedule, Icon: IconCalendar },
    { href: "/teacher/lessons", label: t.nav.lessons, Icon: IconLayers },
    { href: "/teacher/script", label: t.nav.script, Icon: IconFile },
    { href: "/teacher/tongue-twisters", label: t.nav.twisters, Icon: IconVolume },
    { href: "/teacher/activities", label: t.nav.activities, Icon: IconFire },
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
