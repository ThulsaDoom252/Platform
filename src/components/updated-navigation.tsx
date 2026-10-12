"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useT } from "./i18n-provider";
import { useAppView } from "./app-view-provider";
import { useModalLayer } from "@/lib/use-modal-layer";
import { Avatar } from "./avatar";
import { GlobalSearch } from "./global-search";
export function UpdatedNavigation({
  role,
  name,
  avatarUrl,
  roleLine,
  navigation,
  notifications,
  returnToTeacher,
}: {
  role: "TEACHER" | "STUDENT";
  name: string;
  avatarUrl?: string | null;
  roleLine: string;
  navigation: ReactNode;
  notifications: ReactNode;
  returnToTeacher?: ReactNode;
}) {
  const { t } = useT();
  const { view } = useAppView();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState({ path: pathname, open: false });
  if (drawer.path !== pathname) setDrawer({ path: pathname, open: false });
  const open = view === "UPDATED" && drawer.path === pathname && drawer.open;
  const modalRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setDrawer((current) => ({ ...current, open: false })), []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (desktop.matches) close();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [close]);
  useModalLayer(open, modalRef, close);
  if (view !== "UPDATED") return null;
  const root = role === "TEACHER" ? "/teacher" : "/student";
  const content = (
    <>
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <Link
          href={`${root}/profile`}
          title={t.topbar.profile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition hover:bg-surface-2"
        >
          <Avatar name={name} src={avatarUrl} className="h-11 w-11 shrink-0 text-base" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-content">{name}</span>
            <span className="block truncate text-[11px] text-faint">{roleLine}</span>
          </span>
        </Link>
        <div className="shrink-0" data-panel-notifications>
          {notifications}
        </div>
      </div>
      <div className="updated-panel-search my-4">
        <GlobalSearch role={role} />
      </div>
      {returnToTeacher}
      <div
        className="min-w-0"
        onClickCapture={(event) => {
          if ((event.target as Element).closest("a[href]")) close();
        }}
      >
        {navigation}
      </div>
      <Link
        href={`${root}/profile`}
        className="mt-4 block rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted hover:text-accent"
      >
        {t.topbar.profile}
      </Link>
    </>
  );
  return (
    <>
      <div className="updated-navigation sticky top-0 z-40 hidden h-dvh w-64 shrink-0 lg:block">
        <aside
          aria-label={t.settings.navigation}
          className="flex h-full flex-col overflow-y-auto border-r border-line bg-surface p-4"
        >
          {content}
        </aside>
      </div>
      <button
        type="button"
        aria-label={t.settings.openNavigation}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setDrawer({ path: pathname, open: true })}
        className="updated-menu-launcher fixed left-3 top-3 z-40 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 shadow-lg lg:hidden"
      >
        <Menu aria-hidden className="h-5 w-5 text-muted" />
        <Avatar name={name} src={avatarUrl} className="h-7 w-7 text-xs" />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t.common.close}
            onClick={close}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />
          <aside
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.settings.navigation}
            data-modal-layer="1"
            tabIndex={-1}
            className="updated-navigation relative flex h-dvh w-[min(320px,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-line bg-surface p-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={close}
              aria-label={t.common.close}
              className="mb-3 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
