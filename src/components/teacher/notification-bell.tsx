"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearMyNotificationsAction,
  markMyNotificationReadAction,
  markMyNotificationsReadAction,
  resolveNotificationPromptAction,
} from "@/lib/actions/profile";
import { setCancellationChargeAction } from "@/lib/actions/teacher";
import { useT } from "@/components/i18n-provider";
import type { FeedItem, FeedKind } from "@/lib/notifications";
import {
  IconBell,
  IconClock,
  IconXCircle,
  IconCheckCircle,
  IconHeart,
  IconWallet,
  IconUser,
  IconCheck,
} from "@/components/icons";

const kindStyle: Record<FeedKind, { Icon: typeof IconBell; cls: string }> = {
  reminder: { Icon: IconClock, cls: "tint-sky" },
  cancelled: { Icon: IconXCircle, cls: "tint-rose" },
  homework: { Icon: IconCheckCircle, cls: "tint-green" },
  wishlist: { Icon: IconHeart, cls: "tint-violet" },
  contact: { Icon: IconUser, cls: "tint-amber" },
  balance: { Icon: IconWallet, cls: "tint-orange" },
};

export function NotificationBell({
  items,
  unreadCount,
}: {
  items: FeedItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, startAction] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useT();
  const visibleItems = items.filter((item) => !hidden.includes(item.id));
  const hiddenUnread = items.filter((item) => item.unread && hidden.includes(item.id)).length;
  const visibleUnread = Math.max(0, unreadCount - hiddenUnread);

  const dismiss = (id: string) => setHidden((current) => [...current, id]);
  const visit = (item: FeedItem) => startAction(async () => {
    await markMyNotificationReadAction(item.id);
    dismiss(item.id);
    setOpen(false);
    if (item.href) router.push(item.href);
    router.refresh();
  });
  const resolvePrompt = (item: FeedItem, send: boolean) => startAction(async () => {
    await resolveNotificationPromptAction(item.id, send);
    dismiss(item.id);
    router.refresh();
  });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2"
        aria-label={t.notifications.title}
      >
        <IconBell className="h-5 w-5" />
        {visibleUnread > 0 && (
          <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {visibleUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-content">{t.notifications.title}</p>
            <div className="flex items-center gap-3">
            {visibleUnread > 0 && (
              <form action={markMyNotificationsReadAction}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  {t.notifications.markRead}
                </button>
              </form>
            )}
            {visibleItems.length > 0 && (
              <form
                action={clearMyNotificationsAction}
                onSubmit={(event) => {
                  if (!window.confirm(t.notifications.clearConfirm)) event.preventDefault();
                }}
              >
                <button type="submit" className="text-xs font-medium text-rose-500 hover:opacity-80">
                  {t.notifications.clear}
                </button>
              </form>
            )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {visibleItems.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {t.notifications.empty}
              </p>
            )}
            {visibleItems.map((it) => {
              const s = kindStyle[it.kind];
              return (
                <div
                  key={it.id}
                  className={`flex gap-3 px-4 py-3 transition hover:bg-surface-2 ${it.unread ? "bg-accent-soft/40" : ""}`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.cls}`}
                  >
                    <s.Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-content">{it.title}</p>
                    <p className="mt-0.5 text-[11px] text-faint">{it.meta}</p>
                    {it.confirmation && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resolvePrompt(it, true)}
                          className="rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          {t.notifications.send}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resolvePrompt(it, false)}
                          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-content disabled:opacity-50"
                        >
                          {t.notifications.doNotSend}
                        </button>
                      </div>
                    )}
                    {it.cancellationDecision === "pending" && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <form action={setCancellationChargeAction}>
                          <input type="hidden" name="notificationId" value={it.id} />
                          <input type="hidden" name="charge" value="yes" />
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-rose-500 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-rose-600"
                          >
                            {t.notifications.chargeLesson}
                          </button>
                        </form>
                        <form action={setCancellationChargeAction}>
                          <input type="hidden" name="notificationId" value={it.id} />
                          <input type="hidden" name="charge" value="no" />
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-content transition hover:bg-surface-2"
                          >
                            {t.notifications.keepBalance}
                          </button>
                        </form>
                      </div>
                    )}
                    {it.cancellationDecision === "charged" && (
                      <p className="mt-1.5 text-[11px] font-semibold text-rose-500">
                        {t.notifications.lessonCharged}
                      </p>
                    )}
                    {it.cancellationDecision === "not_charged" && (
                      <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">
                        {t.notifications.balanceKept}
                      </p>
                    )}
                    {it.href && !it.confirmation && !it.cancellationDecision && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => visit(it)}
                        className="mt-2 text-[11px] font-black text-accent hover:underline disabled:opacity-50"
                      >
                        {t.notifications.open} →
                      </button>
                    )}
                  </div>
                  {it.unread && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
