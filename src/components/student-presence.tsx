"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  type StudentPresenceSnapshot,
} from "@/lib/actions/presence";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { platformPresence, type ClassPresence, type Presence } from "@/lib/presence";
import { useRealtimeSubscription, useSchoolPresence } from "@/lib/use-realtime";
import { createPlatformPresenceWriter, postPlatformPresence } from "@/lib/platform-presence-client";

const PresenceContext = createContext<Record<string, ClassPresence>>({});
const FALLBACK_REFRESH_MS = 30_000;
const SNAPSHOT_REFRESH_MS = 10_000;

function asMap(rows: StudentPresenceSnapshot[]) {
  return Object.fromEntries(rows.map((row) => [row.id, row.presence]));
}

function usePlatformPresenceLocation() {
  const pathname = usePathname();
  const inClass = pathname === "/student/class" || pathname === "/teacher/class";
  const writer = useRef<ReturnType<typeof createPlatformPresenceWriter> | null>(null);
  const [activity, setActivity] = useState({ visible: true, activeAt: 0 });
  useEffect(() => {
    let controller: AbortController | null = null;
    const current = createPlatformPresenceWriter(async (location) => {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 8_000);
      try { await postPlatformPresence(location, controller.signal); }
      finally { window.clearTimeout(timeout); }
    });
    writer.current = current;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") current.heartbeat();
    }, FALLBACK_REFRESH_MS);
    const retry = window.setInterval(() => current.retry(), 3_000);
    const wake = () => {
      const visible = document.visibilityState !== "hidden";
      setActivity({ visible, activeAt: Date.now() });
      if (visible) current.heartbeat();
    };
    const frame = requestAnimationFrame(wake);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      current.stop();
      controller?.abort();
      if (writer.current === current) writer.current = null;
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.clearInterval(retry);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, []);
  useEffect(() => {
    writer.current?.location(inClass);
    const frame = requestAnimationFrame(() => setActivity({ visible: document.visibilityState !== "hidden", activeAt: Date.now() }));
    return () => cancelAnimationFrame(frame);
  }, [inClass]);
  return { inClass, ...activity };
}

/** Все точки статуса используют один опрос, независимо от их количества. */
export function StudentPresenceProvider({
  initial,
  self,
  children,
}: {
  initial: StudentPresenceSnapshot[];
  self: { id: string; name: string; role: "TEACHER" | "STUDENT" };
  children: ReactNode;
}) {
  const location = usePlatformPresenceLocation();
  const [presences, setPresences] = useState<Record<string, ClassPresence>>(() => asMap(initial));
  const [fallbackPresences, setFallbackPresences] = useState<Record<string, ClassPresence>>(() => asMap(initial));
  const snapshot = useRef(asMap(initial));
  const membersRef = useRef<Record<string, ClassPresence>>({});
  const snapshotVersion = useRef(0);
  const serverEventAt = useRef<Record<string, number>>({});
  const status = useSchoolPresence({
    data: { role: self.role, name: self.name, ...location },
    onMembers: (members) => {
      membersRef.current = members;
      // A partial/failed school entry must not erase a fresh server heartbeat.
      setPresences({ ...snapshot.current, ...members });
    },
  });
  useRealtimeSubscription({
    channel: "presence:school", events: "presence",
    onMessage: (message) => {
      const data = message.data as { userId?: unknown; presence?: unknown; observedAt?: unknown } | undefined;
      if (typeof data?.userId !== "string" || !["online", "in_class"].includes(String(data.presence)) ||
        typeof data.observedAt !== "number" || !Number.isFinite(data.observedAt)) return;
      if (data.observedAt <= (serverEventAt.current[data.userId] ?? 0)) return;
      serverEventAt.current[data.userId] = data.observedAt;
      const presence = data.presence as ClassPresence;
      snapshotVersion.current++;
      snapshot.current = { ...snapshot.current, [data.userId]: presence };
      setFallbackPresences(snapshot.current);
      // Server beacons repair missing members, never override the active tab
      // chosen by a real school-presence update (including a hidden class tab).
      setPresences({ ...snapshot.current, ...membersRef.current });
    },
  });

  useEffect(() => {
    let alive = true;
    let loading = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      const version = snapshotVersion.current;
      try {
        controller = new AbortController();
        const timeout = window.setTimeout(() => controller?.abort(), 8_000);
        try {
          const response = await fetch("/api/presence", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
          if (!response.ok) return;
          const rows: StudentPresenceSnapshot[] = await response.json();
          if (alive && version === snapshotVersion.current && Array.isArray(rows)) {
            snapshot.current = asMap(rows);
            setFallbackPresences(snapshot.current);
            setPresences({ ...snapshot.current, ...membersRef.current });
          }
        } finally { window.clearTimeout(timeout); }
      } catch {
        // Keep the last known snapshot on a transient server failure.
      } finally {
        loading = false;
      }
    };
    void refresh();
    // Realtime is instant; this cheap safety net also runs during a connected
    // but incomplete presence session, not only a disconnected websocket.
    const timer = window.setInterval(() => void refresh(), SNAPSHOT_REFRESH_MS);
    const visible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
    };
  }, []);

  // Never let a disconnected socket's cached member map override the safety snapshot.
  return <PresenceContext.Provider value={status === "connected" ? presences : fallbackPresences}>{children}</PresenceContext.Provider>;
}

/** Keeps a student visible online even outside the class page. */
export function RealtimePresenceBeacon({
  name,
}: {
  name: string;
}) {
  const location = usePlatformPresenceLocation();
  useSchoolPresence({ data: { role: "STUDENT", name, ...location } });
  return null;
}

export function useStudentPresence(studentId: string): Presence {
  const presences = useContext(PresenceContext);
  return platformPresence(presences[studentId] ?? "offline");
}

export function usePresenceMap() {
  return useContext(PresenceContext);
}

export function PresenceIndicator({
  presence,
  showLabel = false,
  showClassStatus = false,
  className,
}: {
  presence: ClassPresence;
  showLabel?: boolean;
  showClassStatus?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const inClass = showClassStatus && presence === "in_class";
  const online = platformPresence(presence) === "online";
  const title = inClass ? t.classRoom.inClassTitle : online ? t.classRoom.onlineTitle : t.classRoom.offlineTitle;
  const label = inClass ? t.classRoom.inClass : online ? t.classRoom.online : t.classRoom.offline;

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5",
        showLabel && "rounded-full bg-surface-2 px-2 py-1 text-[10px] font-bold",
        showLabel && (inClass ? "text-violet-600 dark:text-violet-300" : online ? "text-emerald-600 dark:text-emerald-300" : "text-faint"),
        className,
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface",
          inClass ? "bg-violet-500" : online ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export function StudentPresence({
  studentId,
  showLabel = false,
  className,
}: {
  studentId: string;
  showLabel?: boolean;
  className?: string;
}) {
  const presence = useStudentPresence(studentId);
  return <PresenceIndicator presence={presence} showLabel={showLabel} className={className} />;
}
