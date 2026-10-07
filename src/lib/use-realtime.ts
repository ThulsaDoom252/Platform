"use client";

import * as Ably from "ably";
import { useEffect, useEffectEvent, useState } from "react";

type RealtimeStatus = "connected" | "connecting" | "unavailable";

let singleton: Ably.Realtime | null = null;

function realtimeClient() {
  if (typeof window === "undefined") return null;
  if (!singleton) {
    singleton = new Ably.Realtime({
      authUrl: "/api/realtime/token",
      echoMessages: false,
      disconnectedRetryTimeout: 5_000,
      suspendedRetryTimeout: 15_000,
    });
  }
  return singleton;
}

type Options = {
  channel: string | null | undefined;
  events: string | string[];
  onMessage: (message: Ably.Message) => void | Promise<void>;
  enabled?: boolean;
  /** A safety net used only while WebSocket is unavailable. */
  fallbackMs?: number;
  onFallback?: () => void | Promise<void>;
};

/** Subscribe to invalidation events while keeping polling only as a fallback. */
export function useRealtimeSubscription({
  channel,
  events,
  onMessage,
  enabled = true,
  fallbackMs = 30_000,
  onFallback,
}: Options) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const handleMessage = useEffectEvent(onMessage);
  const runFallback = useEffectEvent(() => onFallback?.());
  const eventKey = Array.isArray(events) ? events.join("\u0000") : events;
  const hasFallback = !!onFallback;

  useEffect(() => {
    if (!enabled || !channel) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }
    const client = realtimeClient();
    if (!client) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }

    const updateStatus = () => {
      const state = client.connection.state;
      setStatus(
        state === "connected"
          ? "connected"
          : state === "connecting"
            ? "connecting"
            : "unavailable",
      );
    };
    const realtimeChannel = client.channels.get(channel);
    const names = eventKey.split("\u0000");
    const handler = (message: Ably.Message) => {
      void handleMessage(message);
    };

    updateStatus();
    client.connection.on(updateStatus);
    names.forEach((name) => realtimeChannel.subscribe(name, handler));

    return () => {
      client.connection.off(updateStatus);
      names.forEach((name) => realtimeChannel.unsubscribe(name, handler));
    };
  }, [channel, enabled, eventKey]);

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
        // A transient request failure must not stop the next recovery poll.
      } finally {
        running = false;
      }
    };
    const wake = () => {
      if (document.visibilityState !== "hidden") void poll();
    };

    // Do not leave the UI stale until the first interval. This is especially
    // important on deployments where the realtime provider is not configured.
    void poll();
    const timer = window.setInterval(() => void poll(), Math.max(750, fallbackMs));
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);

    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [enabled, fallbackMs, hasFallback, status]);

  return status;
}

export function useSchoolPresence({
  enabled = true,
  data,
  onMembers,
}: {
  enabled?: boolean;
  data: Record<string, unknown>;
  onMembers?: (clientIds: Set<string>) => void;
}) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const presenceData = useEffectEvent(() => data);
  const emitMembers = useEffectEvent((clientIds: Set<string>) => onMembers?.(clientIds));

  useEffect(() => {
    if (!enabled) return;
    const client = realtimeClient();
    if (!client) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }
    const channel = client.channels.get("presence:school");
    let alive = true;

    const refresh = async () => {
      try {
        const members = await channel.presence.get();
        if (alive) {
          emitMembers(new Set(members.map((member) => member.clientId).filter(Boolean) as string[]));
        }
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
    channel.presence.subscribe(["enter", "leave", "update"], presenceChanged);
    void connectionChanged();
    return () => {
      alive = false;
      client.connection.off(connectionChanged);
      channel.presence.unsubscribe(["enter", "leave", "update"], presenceChanged);
      void channel.presence.leave().catch(() => {});
    };
  }, [enabled]);

  return status;
}
