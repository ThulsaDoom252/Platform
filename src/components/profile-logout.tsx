"use client";
import { useAppView } from "./app-view-provider";
import { useT } from "./i18n-provider";
import { logoutAction } from "@/lib/actions/auth";
import { IconLogout } from "./icons";
export function ProfileLogout() {
  const { view } = useAppView();
  const { t } = useT();
  if (view !== "UPDATED") return null;
  return (
    <section className="flex justify-end rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white"
        >
          <IconLogout aria-hidden className="h-4 w-4" />
          {t.topbar.logout}
        </button>
      </form>
    </section>
  );
}
