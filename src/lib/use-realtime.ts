"use client";

import type * as Ably from "ably";
import { createContext, createElement, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { schoolPresenceMap, type ClassPresence } from "@/lib/presence";

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
  onMembers?: (presences: Record<string, ClassPresence>) => void;
}) {
  const configured = useContext(RealtimeConfigured);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const presenceData = useEffectEvent(() => data);
  const emitMembers = useEffectEvent((presences: Record<string, ClassPresence>) => onMembers?.(presences));
  const updateDataRef = useRef<(() => Promise<void>) | null>(null);
  const recoverRef = useRef<(() => Promise<void>) | null>(null);
  const dataKey = JSON.stringify(data);
  const observesMembers = !!onMembers;

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
        if (!observesMembers) return true;
        try {
          const members = await channel.presence.get();
          if (alive) emitMembers(schoolPresenceMap(members));
          if (alive && client.connection.state === "connected" && channel.state === "attached") setStatus("connected");
          return true;
        } catch {
          if (alive) setStatus("unavailable");
          return false;
        }
      };
      const presenceChanged = () => void refresh();
      const updateData = async () => {
        if (!alive || client.connection.state !== "connected" || channel.state !== "attached") return false;
        try {
          await channel.presence.update(presenceData());
          return true;
        } catch {
          if (alive) setStatus("unavailable");
          return false;
        }
      };
      const publishData = async () => { await updateData(); };
      updateDataRef.current = publishData;
      let entering = false;
      const connectionChanged = async () => {
        if (!alive) return;
        const state = client.connection.state;
        if (state !== "connected") {
          setStatus(state === "connecting" ? "connecting" : "unavailable");
          return;
        }
        if (!entering) {
          entering = true;
          try {
            const sentData = presenceData();
            await channel.presence.enter(sentData);
            if (!alive) return;
            if (JSON.stringify(sentData) !== JSON.stringify(presenceData()) && !await updateData()) return;
            const refreshed = await refresh();
            if (alive && refreshed && client.connection.state === "connected" && channel.state === "attached") setStatus("connected");
          } catch {
            if (alive) setStatus("unavailable");
          } finally {
            entering = false;
          }
        }
      };
      recoverRef.current = connectionChanged;
      client.connection.on(connectionChanged);
      const channelChanged = () => {
        if (channel.state === "attached") void connectionChanged();
        else if (alive) setStatus("unavailable");
      };
      channel.on(channelChanged);
      if (observesMembers) void channel.presence.subscribe(["enter", "leave", "update", "present"], presenceChanged).catch(() => {
        if (alive) setStatus("unavailable");
      });
      void connectionChanged();
      unsubscribe = () => {
        if (updateDataRef.current === publishData) updateDataRef.current = null;
        if (recoverRef.current === connectionChanged) recoverRef.current = null;
        client.connection.off(connectionChanged);
        channel.off(channelChanged);
        if (observesMembers) channel.presence.unsubscribe(["enter", "leave", "update", "present"], presenceChanged);
        void channel.presence.leave().catch(() => {});
      };
    }).catch(() => {
      if (alive) setStatus("unavailable");
    });
    return () => { alive = false; unsubscribe(); };
  }, [configured, enabled, observesMembers]);
  // Route changes update member data without leaving/re-entering the school.
  useEffect(() => {
    void updateDataRef.current?.();
  }, [dataKey]);
  useEffect(() => {
    if (!configured || !enabled || status !== "unavailable") return;
    const timer = window.setInterval(() => void recoverRef.current?.(), 15_000);
    return () => window.clearInterval(timer);
  }, [configured, enabled, status]);
  return status;
}
