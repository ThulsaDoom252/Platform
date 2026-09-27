"use client";

/**
 * Объект, живущий в localStorage.
 *
 * То же, что use-local-flag и use-local-number, но для настроек
 * посложнее: выбранный порядок дерева и сохранённые расстановки.
 * Читается через useSyncExternalStore, потому что и эффект, и чтение
 * прямо в рендере тут одинаково неуместны.
 *
 * Снимок кэшируется: JSON.parse на каждый вызов отдавал бы новый объект,
 * и React решил бы, что состояние меняется бесконечно.
 */
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Приватный режим: настройка проживёт до перезагрузки.
    raw = null;
  }

  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;

  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }

  cache.set(key, { raw, value });
  return value;
}

/** Возвращает объект и функцию его замены. На сервере — значение по умолчанию. */
export function useLocalJson<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const set = useCallback(
    (next: T) => {
      const raw = JSON.stringify(next);
      cache.set(key, { raw, value: next });
      try {
        localStorage.setItem(key, raw);
      } catch {
        /* не сохранилось — останется в памяти до перезагрузки */
      }
      notify();
    },
    [key],
  );

  return [value, set];
}
