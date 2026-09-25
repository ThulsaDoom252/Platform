"use client";

/**
 * Текущее время как внешнее состояние.
 *
 * Читать Date.now() прямо в рендере нельзя: на сервере и в браузере
 * получатся разные числа, и разметка разойдётся при гидратации. Здесь
 * время лежит в одном общем месте, обновляется раз в минуту и раздаётся
 * подписчикам — поэтому «урок уже прошёл» само становится правдой, без
 * перезагрузки страницы.
 *
 * Снимок обязательно кэшируется: если отдавать новое число на каждый
 * вызов, React сочтёт состояние вечно меняющимся и зациклится.
 */
import { useSyncExternalStore } from "react";

/** Шаг обновления. Минуты достаточно: время показывается с точностью до неё. */
const TICK = 60_000;

const listeners = new Set<() => void>();
let cached = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    cached = Date.now();
    timer = setInterval(() => {
      cached = Date.now();
      for (const l of listeners) l();
    }, TICK);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  if (cached === 0) cached = Date.now();
  return cached;
}

/**
 * Текущее время в миллисекундах. На сервере — 0, поэтому сравнения с ним
 * до гидратации дают «ещё не прошло»: осторожная сторона для подсказок.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
