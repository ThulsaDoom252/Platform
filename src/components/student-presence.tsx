"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  platformPresenceHeartbeatAction,
  studentPresenceSnapshotAction,
  type StudentPresenceSnapshot,
} from "@/lib/actions/presence";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { platformPresence, type ClassPresence, type Presence } from "@/lib/presence";
import { useSchoolPresence } from "@/lib/use-realtime";

const PresenceContext = createContext<Record<string, ClassPresence>>({});
const FALLBACK_REFRESH_MS = 30_000;

function asMap(rows: StudentPresenceSnapshot[]) {
  return Object.fromEntries(rows.map((row) => [row.id, row.presence]));
}

function usePlatformPresenceLocation() {
  const pathname = usePathname();
  const inClass = pathname === "/student/class" || pathname === "/teacher/class";
  useEffect(() => {
    let running = false;
    const beat = async () => {
      if (running) return;
      running = true;
      try {
        await platformPresenceHeartbeatAction(inClass);
      } catch {
        // Realtime remains authoritative; the next beacon recovers the fallback.
      } finally {
        running = false;
      }
    };
    void beat();
    const timer = window.setInterval(() => void beat(), FALLBACK_REFRESH_MS);
    const wake = () => document.visibilityState === "visible" && void beat();
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [inClass]);
  return inClass;
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
  const inClass = usePlatformPresenceLocation();
  const [presences, setPresences] = useState<Record<string, ClassPresence>>(() => asMap(initial));
  const status = useSchoolPresence({
    data: { role: self.role, name: self.name, inClass },
    onMembers: (members) => {
      setPresences((current) => Object.fromEntries(
        [...new Set([...Object.keys(current), ...Object.keys(members)])].map((id) => [id, members[id] ?? "offline"]),
      ));
    },
  });

  useEffect(() => {
    if (status === "connected") return;
    let alive = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const rows = await studentPresenceSnapshotAction();
        if (alive) setPresences(asMap(rows));
      } catch {
        // Keep the last known snapshot on a transient server failure.
      } finally {
        loading = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), FALLBACK_REFRESH_MS);
    const visible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [status]);

  return <PresenceContext.Provider value={presences}>{children}</PresenceContext.Provider>;
}

/** Keeps a student visible online even outside the class page. */
export function RealtimePresenceBeacon({
  name,
}: {
  name: string;
}) {
  const inClass = usePlatformPresenceLocation();
  useSchoolPresence({ data: { role: "STUDENT", name, inClass } });
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
