"use client";

/**
 * Булев переключатель, живущий в localStorage.
 *
 * Читать хранилище в эффекте нельзя: setState сразу после монтирования
 * даёт лишний каскад рендеров, а читать его прямо в рендере — расхождение
 * с серверной разметкой. useSyncExternalStore закрывает оба случая: на
 * сервере отдаёт значение по умолчанию, в браузере — настоящее, и сам
 * перерисовывает подписчиков, когда флаг меняют.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Тот же флаг может переключить соседняя вкладка.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Запасная память на случай, когда хранилище недоступно. */
const memory = new Map<string, boolean>();

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // Приватный режим или запрет на хранилище: переключатель всё равно
    // должен работать, просто забудется при перезагрузке.
    return memory.get(key) ?? false;
  }
}

/** Возвращает флаг и функцию его установки. На сервере флаг всегда снят. */
export function useLocalFlag(key: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );

  const set = useCallback(
    (next: boolean) => {
      memory.set(key, next);
      try {
        if (next) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
      } catch {
        /* не сохранилось — останется в памяти до перезагрузки */
      }
      notify();
    },
    [key],
  );

  return [value, set];
}
