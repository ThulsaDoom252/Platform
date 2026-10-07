"use client";

type LiveResults = {
  focus: Awaited<ReturnType<typeof import("@/lib/actions/class").classSyncAction>>;
  lesson: Awaited<ReturnType<typeof import("@/lib/actions/lessons").assignedLessonAction>>;
  "lesson-state": Awaited<ReturnType<typeof import("@/lib/actions/lessons").lessonLiveStateAction>>;
  deck: Awaited<ReturnType<typeof import("@/lib/actions/word-deck").classWordDeckLiveStateAction>>;
};
const pending = new Map<string, Promise<unknown>>();
const snapshots = new Map<string, { version: string; data: unknown }>();

/** Only current-class background reads, outside Next's mutation queue. */
export function readClassLive<K extends keyof LiveResults>(resource: K, id = "", onBoard = false): Promise<LiveResults[K]> {
  const key = `${resource}:${id}:${onBoard}`;
  const existing = pending.get(key);
  if (existing) return existing as Promise<LiveResults[K]>;
  const previous = snapshots.get(key);
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/class/live", {
        method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id, onBoard, version: previous?.version }),
      });
      if (response.status === 204 && previous) return previous.data as LiveResults[K];
      if (!response.ok) throw new Error(`Class state: HTTP ${response.status}`);
      const result = await response.json() as { version: string; data: LiveResults[K] };
      snapshots.delete(key);
      snapshots.set(key, result);
      if (snapshots.size > 16) snapshots.delete(snapshots.keys().next().value!);
      return result.data;
    } finally {
      clearTimeout(timeout);
      pending.delete(key);
    }
  })();
  pending.set(key, request);
  return request;
}
