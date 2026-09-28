"use client";

/**
 * Состояние партии, которое два экрана читают опросом.
 *
 * Постоянного соединения в проекте нет, поэтому оба браузера спрашивают
 * сервер раз в секунду. Между опросами остаток времени отсчитывается на
 * месте: иначе цифра дёргалась бы раз в секунду скачками, а полоса
 * стояла бы на месте.
 *
 * Срок берётся от сервера каждым ответом — так часы у учителя и ученика
 * не расходятся, даже если у одного из них время сбито.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/actions/guess-picture";

const POLL_MS = 1000;
const TICK_MS = 100;

export function useGameState(load: () => Promise<GameState | null>) {
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
    let alive = true;

    const poll = () => {
      if (alive) void refresh();
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => {
      setLeftMs(endsAt.current ? Math.max(0, endsAt.current - Date.now()) : 0);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  return { state, loaded, leftMs, refresh };
}
