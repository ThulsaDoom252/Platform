/** A summon is acknowledged only after the student's class route has committed. */
export const STUDENT_CLASS_PATH = "/student/class";
export const CLASS_SUMMONS_ENDPOINT = "/api/class/summons";
export const CLASS_SUMMONS_POLL_MS = 4_000;

export type ClassSummonsCommand = {
  id: string;
  requestedAt: string;
  expiresAt: string;
};

export function pendingClassSummons(value: unknown, now = Date.now()): ClassSummonsCommand | null {
  if (!value || typeof value !== "object") return null;
  const command = (value as { command?: unknown }).command;
  if (!command || typeof command !== "object") return null;
  const { id, requestedAt, expiresAt } = command as Partial<ClassSummonsCommand>;
  if (typeof id !== "string" || !id || id.length > 200 || typeof requestedAt !== "string" || typeof expiresAt !== "string") return null;
  const requested = Date.parse(requestedAt);
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(requested) || !Number.isFinite(expires) || expires <= requested || expires <= now) return null;
  return { id, requestedAt, expiresAt };
}

type ArrivalStorage = Pick<Storage, "getItem" | "setItem">;
export type ClassSummonsArrivals = {
  has: (command: ClassSummonsCommand) => boolean;
  add: (command: ClassSummonsCommand) => void;
};

export function classSummonsArrivalKey(userId: string) {
  return `lingora:class-summons-arrived:${userId}`;
}

/** Survives refresh/Strict Mode and shares successful arrivals with other tabs.
 * Nothing is remembered before an actual arrival, so a failed navigation is retryable.
 */
export function createClassSummonsArrivals(
  userId: string,
  storage?: ArrivalStorage,
  now = Date.now,
): ClassSummonsArrivals {
  const key = classSummonsArrivalKey(userId);
  const memory = new Map<string, number>();
  const read = () => {
    try {
      const stored: unknown = JSON.parse(storage?.getItem(key) ?? "null");
      if (Array.isArray(stored)) for (const item of stored) {
        if (item && typeof item === "object" && typeof item.id === "string" && item.id.length <= 200 && typeof item.expires === "number" && item.expires > now()) {
          memory.set(item.id, item.expires);
        }
      }
    } catch {
      // Storage can be disabled; the current mounted client still deduplicates.
    }
    for (const [id, expires] of memory) if (expires <= now()) memory.delete(id);
  };
  return {
    has(command) {
      read();
      return memory.has(command.id);
    },
    add(command) {
      read();
      memory.set(command.id, Date.parse(command.expiresAt));
      const items = [...memory].sort((a, b) => b[1] - a[1]).slice(0, 32).map(([id, expires]) => ({ id, expires }));
      try { storage?.setItem(key, JSON.stringify(items)); } catch { /* Keep the in-memory arrival. */ }
    },
  };
}

type ClassSummonsClientOptions = {
  pathname: () => string | null;
  visible: () => boolean;
  active?: () => boolean;
  pending: (signal: AbortSignal) => Promise<unknown>;
  acknowledge: (commandId: string, signal: AbortSignal) => Promise<boolean>;
  navigate: () => void;
  hardNavigate: () => void;
  arrivals: ClassSummonsArrivals;
  now?: () => number;
  requestTimeoutMs?: number;
};

/** Single-flight transport, independent of the serialized Next server-action queue.
 * Realtime is a wake-up signal, not the durable command itself. Every navigation
 * attempt is based on a fresh server read, including the bounded hard fallback.
 */
export function createClassSummonsClient(options: ClassSummonsClientOptions) {
  const now = options.now ?? Date.now;
  let alive = true;
  let pulling: Promise<void> | null = null;
  let repull = false;
  let forceNext = false;
  let current: ClassSummonsCommand | null = null;
  let navigation: { id: string; startedAt: number; lastAttemptAt: number; hard: boolean } | null = null;
  const acknowledged = new Set<string>();
  const acknowledging = new Set<string>();
  const requests = new Set<AbortController>();

  async function request<T>(send: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 5_000);
    try { return await send(controller.signal); }
    finally { clearTimeout(timeout); requests.delete(controller); }
  }

  async function acknowledge(command: ClassSummonsCommand) {
    if (!alive || acknowledged.has(command.id) || acknowledging.has(command.id)) return;
    acknowledging.add(command.id);
    try {
      const accepted = await request((signal) => options.acknowledge(command.id, signal));
      if (!alive) return;
      if (accepted) {
        acknowledged.add(command.id);
        if (current?.id === command.id) current = null;
      }
      // A rejected exact-ID ACK may mean a newer command exists. The next push/poll
      // reads it without retrying recursively against a persistently rejected command.
    } catch {
      // Arrival is already remembered; retry the ACK without pulling the student back after leaving.
    } finally { acknowledging.delete(command.id); }
  }

  function arrived(command: ClassSummonsCommand) {
    // An old hidden class tab must not consume a new summon before the student's
    // currently visible section receives it. Hidden tabs may prepare the route.
    if (!alive || !(options.active ?? options.visible)() || Date.parse(command.expiresAt) <= now()) return;
    options.arrivals.add(command);
    navigation = null;
    void acknowledge(command);
  }

  function received(command: ClassSummonsCommand | null) {
    current = command;
    if (!command) { navigation = null; return; }
    // Read the latest committed pathname here, never the route captured before an awaited request.
    if (options.pathname() === STUDENT_CLASS_PATH) { arrived(command); return; }
    if (acknowledged.has(command.id)) return;
    if (options.arrivals.has(command)) {
      // Retrying metadata-only delivery confirmation after leaving must not navigate again.
      void acknowledge(command);
      return;
    }
    const time = now();
    if (navigation?.id !== command.id) navigation = { id: command.id, startedAt: time, lastAttemptAt: -Infinity, hard: false };
    if (navigation.hard) return;
    if (time - navigation.startedAt >= 8_000) {
      navigation.hard = true;
      try { options.hardNavigate(); } catch { navigation.hard = false; }
    } else if (time - navigation.lastAttemptAt >= 3_000) {
      navigation.lastAttemptAt = time;
      try { options.navigate(); } catch { /* A fresh pending read retries a rejected router transition. */ }
    }
  }

  function poll(force = false): Promise<void> {
    if (!alive || (!force && !options.visible())) return Promise.resolve();
    forceNext ||= force;
    if (pulling) { repull = true; return pulling; }
    pulling = (async () => {
      do {
        repull = false;
        const allowHidden = forceNext;
        forceNext = false;
        try {
          const value = await request(options.pending);
          if (!alive) return;
          if (allowHidden || options.visible()) received(pendingClassSummons(value, now()));
        } catch {
          // A transient transport error does not consume the command. The next wake/poll recovers.
        }
      } while (alive && repull && (options.visible() || forceNext));
    })().finally(() => { pulling = null; });
    return pulling;
  }

  return {
    poll,
    routeChanged() {
      if (!alive) return;
      if (options.pathname() === STUDENT_CLASS_PATH && current) arrived(current);
      // Refresh validity after route changes; do not navigate from a cached command.
      void poll();
    },
    stop() {
      alive = false;
      current = null;
      for (const controller of requests) controller.abort();
      requests.clear();
    },
  };
}
