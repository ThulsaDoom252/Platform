"use client";

/**
 * Состояние партии, которое два экрана получают по WebSocket.
 *
 * Между серверными событиями остаток времени отсчитывается на
 * месте: иначе цифра дёргалась бы раз в секунду скачками, а полоса
 * стояла бы на месте.
 *
 * Срок берётся от сервера каждым ответом — так часы у учителя и ученика
 * не расходятся, даже если у одного из них время сбито.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/actions/guess-picture";
import { useRealtimeSubscription } from "@/lib/use-realtime";

const TICK_MS = 100;

export function useGameState(
  load: () => Promise<GameState | null>,
  realtime?: { channel: string; gameId?: string },
) {
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [leftMs, setLeftMs] = useState(0);
  const endsAt = useRef(0);

  // Функция опроса приходит из компонента и меняется на каждый рендер;
  // держим её в ref, чтобы не перезапускать таймеры.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      const next = await loadRef.current();
      setState(next);
      setLoaded(true);
      endsAt.current = next ? Date.now() + next.leftMs : 0;
      setLeftMs(next?.leftMs ?? 0);
    } catch {
      /* сеть моргнула — следующий опрос подхватит */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeSubscription({
    channel: realtime?.channel,
    events: "game-state",
    onMessage: (message) => {
      const changed = (message.data as { gameId?: string } | undefined)?.gameId;
      if (!realtime?.gameId || !changed || changed === realtime.gameId) void refresh();
    },
    onFallback: refresh,
    fallbackMs: 30_000,
    enabled: !!realtime?.channel,
  });

  useEffect(() => {
    const tick = setInterval(() => {
      setLeftMs(endsAt.current ? Math.max(0, endsAt.current - Date.now()) : 0);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  return { state, loaded, leftMs, refresh };
}
