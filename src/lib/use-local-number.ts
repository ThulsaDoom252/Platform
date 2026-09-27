"use client";

/**
 * Число, живущее в localStorage.
 *
 * То же, что и use-local-flag, только для размеров: ширины панелей,
 * которые учитель подобрал под свой экран. Читать хранилище в эффекте
 * нельзя — это лишний каскад рендеров, а читать в рендере нельзя из-за
 * расхождения с серверной разметкой. useSyncExternalStore закрывает оба
 * случая: на сервере отдаёт значение по умолчанию, в браузере —
 * настоящее.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // То же значение может поменять соседняя вкладка.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Запасная память на случай, когда хранилище недоступно. */
const memory = new Map<string, number>();

function read(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : (memory.get(key) ?? fallback);
  } catch {
    // Приватный режим или запрет на хранилище: размер всё равно
    // меняется, просто забудется при перезагрузке.
    return memory.get(key) ?? fallback;
  }
}

/** Возвращает число и функцию его установки. На сервере — значение по умолчанию. */
export function useLocalNumber(
  key: string,
  fallback: number,
): [number, (value: number) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const set = useCallback(
    (next: number) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* не сохранилось — останется в памяти до перезагрузки */
      }
      notify();
    },
    [key],
  );

  return [value, set];
}
