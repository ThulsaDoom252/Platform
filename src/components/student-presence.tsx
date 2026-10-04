"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  studentPresenceSnapshotAction,
  type StudentPresenceSnapshot,
} from "@/lib/actions/presence";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { Presence } from "@/lib/presence";

const PresenceContext = createContext<Record<string, Presence>>({});
const REFRESH_MS = 10_000;

function asMap(rows: StudentPresenceSnapshot[]) {
  return Object.fromEntries(rows.map((row) => [row.id, row.presence]));
}

/** Все точки статуса используют один опрос, независимо от их количества. */
export function StudentPresenceProvider({
  initial,
  children,
}: {
  initial: StudentPresenceSnapshot[];
  children: ReactNode;
}) {
  const [presences, setPresences] = useState<Record<string, Presence>>(() => asMap(initial));

  useEffect(() => {
    let alive = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const rows = await studentPresenceSnapshotAction();
        if (alive) setPresences(asMap(rows));
      } finally {
        loading = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const visible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  return <PresenceContext.Provider value={presences}>{children}</PresenceContext.Provider>;
}

export function useStudentPresence(studentId: string): Presence {
  const presences = useContext(PresenceContext);
  return presences[studentId] ?? "offline";
}

export function PresenceIndicator({
  presence,
  showLabel = false,
  className,
}: {
  presence: Presence;
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const online = presence === "online";
  const title = online ? t.classRoom.onlineTitle : t.classRoom.offlineTitle;

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5",
        showLabel && "rounded-full bg-surface-2 px-2 py-1 text-[10px] font-bold",
        showLabel && (online ? "text-emerald-600 dark:text-emerald-300" : "text-faint"),
        className,
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface",
          online ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      {showLabel && <span>{online ? t.classRoom.online : t.classRoom.offline}</span>}
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
