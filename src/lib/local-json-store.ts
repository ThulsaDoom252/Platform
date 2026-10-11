/** Cached JSON snapshots for useSyncExternalStore. */
const cache = new Map<string, { raw: string; value: unknown }>();
const memory = new Map<string, unknown>();

export function readLocalJson<T>(key: string, fallback: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return memory.has(key) ? memory.get(key) as T : fallback;
  }
  if (raw === null) return memory.has(key) ? memory.get(key) as T : fallback;
  const hit = cache.get(key);
  if (hit?.raw === raw) return hit.value as T;
  try {
    const value = JSON.parse(raw) as T;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

export function writeLocalJson<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  // Keep the latest value even when the browser refuses storage access.
  memory.set(key, value);
  try {
    localStorage.setItem(key, raw);
    memory.delete(key);
    cache.set(key, { raw, value });
  } catch {
    // The preference remains usable until the page is reloaded.
  }
}
