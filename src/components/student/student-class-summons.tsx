"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CLASS_SUMMONS_ENDPOINT,
  CLASS_SUMMONS_POLL_MS,
  STUDENT_CLASS_PATH,
  classSummonsArrivalKey,
  createClassSummonsArrivals,
  createClassSummonsClient,
} from "@/lib/class-summons-client";
import { useRealtimeSubscription } from "@/lib/use-realtime";

/** Layout-wide, route-independent reception. Merely reading a command never consumes it. */
export function StudentClassSummons({ userId }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const client = useRef<ReturnType<typeof createClassSummonsClient> | null>(null);
  const currentPathname = useEffectEvent(() => pathname);
  const navigate = useEffectEvent(() => router.push(STUDENT_CLASS_PATH));
  const receiveSummon = () => client.current?.poll(true);

  useEffect(() => {
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Private/disabled storage falls back to memory. */ }
    const controller = createClassSummonsClient({
      pathname: currentPathname,
      visible: () => document.visibilityState !== "hidden",
      active: () => document.visibilityState !== "hidden" && document.hasFocus(),
      arrivals: createClassSummonsArrivals(userId, storage),
      pending: async (signal) => {
        const response = await fetch(CLASS_SUMMONS_ENDPOINT, { signal, cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("Class summon is temporarily unavailable");
        return response.json();
      },
      acknowledge: async (commandId, signal) => {
        const response = await fetch(CLASS_SUMMONS_ENDPOINT, {
          method: "POST", signal, cache: "no-store", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandId }),
        });
        if (!response.ok) throw new Error("Class arrival acknowledgement is temporarily unavailable");
        return (await response.json()).acknowledged === true;
      },
      navigate,
      // Fixed same-origin route only; never navigate to URLs supplied by realtime or the server.
      hardNavigate: () => window.location.assign(STUDENT_CLASS_PATH),
    });
    client.current = controller;
    const wake = () => { void controller.poll(); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === classSummonsArrivalKey(userId)) wake();
    };
    wake();
    // Keep bounded recovery even with a connected socket (a missed event is otherwise invisible).
    const timer = window.setInterval(wake, CLASS_SUMMONS_POLL_MS);
    // Background tabs still receive explicit summons; the slower safety read also
    // recovers a missed push without running the visible four-second cadence.
    const backgroundTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") void controller.poll(true);
    }, 15_000);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("storage", storageChanged);
    return () => {
      if (client.current === controller) client.current = null;
      controller.stop();
      window.clearInterval(timer);
      window.clearInterval(backgroundTimer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("storage", storageChanged);
    };
  }, [userId]);

  useEffect(() => { client.current?.routeChanged(); }, [pathname]);

  useRealtimeSubscription({
    channel: `user:${userId}`,
    events: "summon",
    onMessage: receiveSummon,
    onFallback: receiveSummon,
    // This callback also runs immediately on socket attachment/reconnect.
    // The dedicated four-second poll owns steady recovery; avoid a second fast timer.
    fallbackMs: 30_000,
  });

  return null;
}
