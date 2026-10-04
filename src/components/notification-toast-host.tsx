"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markMyNotificationReadAction,
  pollMyNotificationsAction,
  resolveNotificationPromptAction,
  type NotificationToastItem,
} from "@/lib/actions/profile";
import { useT } from "@/components/i18n-provider";

/** Yellow live message: it only exists while the recipient is online. */
export function NotificationToastHost() {
  const { t } = useT();
  const router = useRouter();
  const cursor = useRef(new Date().toISOString());
  const [items, setItems] = useState<NotificationToastItem[]>([]);
  const [busy, startAction] = useTransition();

  useEffect(() => {
    let alive = true;
    let pulling = false;
    const pull = async () => {
      if (pulling) return;
      pulling = true;
      try {
        const result = await pollMyNotificationsAction(cursor.current);
        cursor.current = result.cursor;
        if (alive && result.items.length > 0) {
          setItems((current) => {
            const known = new Set(current.map((item) => item.id));
            return [...current, ...result.items.filter((item) => !known.has(item.id))].slice(-3);
          });
        }
      } finally {
        pulling = false;
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 4_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const remove = (id: string) => setItems((current) => current.filter((item) => item.id !== id));
  const read = (item: NotificationToastItem, navigate: boolean) => startAction(async () => {
    await markMyNotificationReadAction(item.id);
    remove(item.id);
    if (navigate && item.href) router.push(item.href);
    router.refresh();
  });
  const resolve = (item: NotificationToastItem, send: boolean) => startAction(async () => {
    await resolveNotificationPromptAction(item.id, send);
    remove(item.id);
    router.refresh();
  });

  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[300] flex flex-col items-center gap-2 sm:top-5">
      {items.map((item) => (
        <section
          key={item.id}
          className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-400 bg-amber-100 px-4 py-3 text-amber-950 shadow-2xl shadow-amber-950/20"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl" aria-hidden>🔔</span>
            <p className="min-w-0 flex-1 text-sm font-bold leading-relaxed">{item.message}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => read(item, false)}
              className="rounded-lg px-2 py-1 text-sm font-black hover:bg-amber-200 disabled:opacity-50"
              aria-label={t.common.close}
            >
              ×
            </button>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            {item.confirmation ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resolve(item, false)}
                  className="rounded-xl border border-amber-400 bg-white/70 px-3 py-2 text-xs font-black disabled:opacity-50"
                >
                  {t.notifications.doNotSend}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resolve(item, true)}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50"
                >
                  {t.notifications.send}
                </button>
              </>
            ) : item.href ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => read(item, true)}
                className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50"
              >
                {t.notifications.open} →
              </button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
