"use client";

import type * as Ably from "ably";
import { createContext, createElement, useContext, useEffect, useEffectEvent, useState, type ReactNode } from "react";

type RealtimeStatus = "connected" | "connecting" | "unavailable";
const RealtimeConfigured = createContext(true);
let singleton: Promise<Ably.Realtime> | null = null;

export function RealtimeConfigProvider({ configured, children }: { configured: boolean; children: ReactNode }) {
  return createElement(RealtimeConfigured.Provider, { value: configured }, children);
}

async function realtimeClient() {
  if (typeof window === "undefined") return null;
  if (!singleton) {
    singleton = import("ably").then((sdk) => new sdk.Realtime({
      authUrl: "/api/realtime/token",
      echoMessages: false,
      disconnectedRetryTimeout: 5_000,
      suspendedRetryTimeout: 15_000,
    })).catch((error) => {
      singleton = null;
      throw error;
    });
  }
  return singleton;
}

type Options = {
  channel: string | null | undefined;
  events: string | string[];
  onMessage: (message: Ably.Message) => void | Promise<void>;
  enabled?: boolean;
  /** Used only when this subscription is not attached to realtime. */
  fallbackMs?: number;
  onFallback?: () => void | Promise<void>;
};

export function useRealtimeSubscription({
  channel, events, onMessage, enabled = true, fallbackMs = 30_000, onFallback,
}: Options) {
  const configured = useContext(RealtimeConfigured);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const handleMessage = useEffectEvent(onMessage);
  const runFallback = useEffectEvent(() => onFallback?.());
  const eventKey = Array.isArray(events) ? events.join("\u0000") : events;
  const hasFallback = !!onFallback;

  useEffect(() => {
    if (!configured || !enabled || !channel) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }
    let alive = true;
    let unsubscribe = () => {};
    void realtimeClient().then((client) => {
      if (!alive || !client) return;
      const subscription = client.channels.get(channel);
      let attached = false;
      const updateStatus = () => {
        if (!alive) return;
        const connected = client.connection.state === "connected" && subscription.state === "attached";
        setStatus(connected ? "connected" : client.connection.state === "connecting" ? "connecting" : "unavailable");
        // Recover any missed state after initial attachment or reconnect.
        if (connected && !attached) void Promise.resolve(runFallback()).catch(() => {});
        attached = connected;
      };
      const names = eventKey.split("\u0000");
      const handler = (message: Ably.Message) => {
        void Promise.resolve(handleMessage(message)).catch(() => {});
      };
      updateStatus();
      client.connection.on(updateStatus);
      subscription.on(updateStatus);
      names.forEach((name) => void subscription.subscribe(name, handler).catch(() => {
        if (alive) setStatus("unavailable");
      }));
      unsubscribe = () => {
        client.connection.off(updateStatus);
        subscription.off(updateStatus);
        names.forEach((name) => subscription.unsubscribe(name, handler));
      };
    }).catch(() => {
      if (alive) setStatus("unavailable");
    });
    return () => { alive = false; unsubscribe(); };
  }, [channel, configured, enabled, eventKey]);

  useEffect(() => {
    if (!enabled || status === "connected" || !hasFallback) return;
    let alive = true;
    let running = false;
    const poll = async () => {
      if (!alive || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await runFallback();
      } catch {
        // The next poll recovers a transient request failure.
      } finally {
        running = false;
      }
    };
    const wake = () => {
      if (document.visibilityState !== "hidden") void poll();
    };
    void poll();
    const timer = window.setInterval(() => void poll(), Math.max(250, fallbackMs));
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [channel, enabled, fallbackMs, hasFallback, status]);

  return status;
}

export function useSchoolPresence({
  enabled = true, data, onMembers,
}: {
  enabled?: boolean;
  data: Record<string, unknown>;
  onMembers?: (clientIds: Set<string>) => void;
}) {
  const configured = useContext(RealtimeConfigured);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const presenceData = useEffectEvent(() => data);
  const emitMembers = useEffectEvent((ids: Set<string>) => onMembers?.(ids));

  useEffect(() => {
    if (!enabled || !configured) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }
    let alive = true;
    let unsubscribe = () => {};
    void realtimeClient().then((client) => {
      if (!alive || !client) return;
      const channel = client.channels.get("presence:school");
      const refresh = async () => {
        try {
          const members = await channel.presence.get();
          if (alive) emitMembers(new Set(members.map((member) => member.clientId).filter(Boolean) as string[]));
        } catch {
          if (alive) setStatus("unavailable");
        }
      };
      const presenceChanged = () => void refresh();
      const connectionChanged = async () => {
        if (!alive) return;
        const state = client.connection.state;
        setStatus(state === "connected" ? "connected" : state === "connecting" ? "connecting" : "unavailable");
        if (state === "connected") {
          try {
            await channel.presence.enter(presenceData());
            await refresh();
          } catch {
            if (alive) setStatus("unavailable");
          }
        }
      };
      client.connection.on(connectionChanged);
      void channel.presence.subscribe(["enter", "leave", "update"], presenceChanged).catch(() => {
        if (alive) setStatus("unavailable");
      });
      void connectionChanged();
      unsubscribe = () => {
        client.connection.off(connectionChanged);
        channel.presence.unsubscribe(["enter", "leave", "update"], presenceChanged);
        void channel.presence.leave().catch(() => {});
      };
    }).catch(() => {
      if (alive) setStatus("unavailable");
    });
    return () => { alive = false; unsubscribe(); };
  }, [configured, enabled]);
  return status;
}
