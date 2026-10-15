/** One ordered writer per layout: a slow old route cannot overtake a new one. */
export function createPlatformPresenceWriter(write: (inClass: boolean) => Promise<void>) {
  let desired: boolean | null = null;
  let pending = false;
  let running = false;
  let stopped = false;
  const flush = async () => {
    if (running || stopped || desired === null || !pending) return;
    running = true;
    try {
      while (pending && !stopped && desired !== null) {
        const location = desired;
        pending = false;
        try { await write(location); }
        catch { pending = true; break; }
      }
    } finally { running = false; }
  };
  return {
    location(inClass: boolean) {
      if (stopped || desired === inClass) return;
      desired = inClass;
      pending = true;
      void flush();
    },
    heartbeat() { if (!stopped && desired !== null) { pending = true; void flush(); } },
    retry() { void flush(); },
    stop() { stopped = true; pending = false; },
  };
}

/** Independent fetches avoid the serial Next server-action queue used by homework. */
export async function postPlatformPresence(inClass: boolean, signal?: AbortSignal) {
  const response = await fetch("/api/presence", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inClass }), signal,
  });
  if (!response.ok) throw new Error("Presence unavailable");
}
