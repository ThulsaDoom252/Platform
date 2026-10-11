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
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readLocalJson, writeLocalJson } from "@/lib/local-json-store";

const listeners = new Set<() => void>();

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

/** Возвращает объект и функцию его замены. На сервере — значение по умолчанию. */
export function useLocalJson<T>(key: string, fallback: T): [T, (value: T) => void] {
  const fallbackJson = JSON.stringify(fallback);
  const stableFallback = useMemo(() => JSON.parse(fallbackJson) as T, [fallbackJson]);
  const value = useSyncExternalStore(
    subscribe,
    () => readLocalJson(key, stableFallback),
    () => stableFallback,
  );

  const set = useCallback(
    (next: T) => {
      writeLocalJson(key, next);
      notify();
    },
    [key],
  );

  return [value, set];
}
