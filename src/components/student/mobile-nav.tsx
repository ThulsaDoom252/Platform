"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import {
  IconHome,
  IconMaterials,
  IconCalendar,
  IconGrid,
  IconCheckCircle,
} from "@/components/icons";

export function StudentMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useT();

  const items = [
    { href: "/student", label: t.nav.home, Icon: IconHome, exact: true },
    { href: "/student/materials", label: t.nav.shortFiles, Icon: IconMaterials },
    { href: "/student/homework", label: t.nav.homework, Icon: IconCheckCircle },
    { href: "/student/schedule", label: t.nav.schedule, Icon: IconCalendar },
    { href: "/student/settings", label: t.nav.shortMore, Icon: IconGrid },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {items.map(({ href, label, Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname.startsWith(href) || (
              href === "/student/homework" &&
              pathname.startsWith("/student/lessons/") &&
              searchParams.get("section") === "homework"
            );
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
