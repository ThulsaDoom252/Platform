"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import {
  IconHome,
  IconUsers,
  IconCalendar,
  IconMaterials,
  IconGrid,
} from "@/components/icons";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useT();

  const items = [
    { href: "/teacher", label: t.nav.home, Icon: IconHome, exact: true },
    { href: "/teacher/students", label: t.nav.students, Icon: IconUsers },
    { href: "/teacher/schedule", label: t.nav.shortLessons, Icon: IconCalendar },
    { href: "/teacher/materials", label: t.nav.shortFiles, Icon: IconMaterials },
    { href: "/teacher/settings", label: t.nav.shortMore, Icon: IconGrid },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-faint",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
