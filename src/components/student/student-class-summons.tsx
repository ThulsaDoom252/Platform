"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { studentPlatformCommandAction } from "@/lib/actions/class";
import { useRealtimeSubscription } from "@/lib/use-realtime";

/**
 * Даёт учителю привести уже работающего на платформе ученика в класс.
 * Команда одноразовая: после чтения она удаляется на сервере, поэтому
 * обновление страницы не затягивает ученика в класс повторно.
 */
export function StudentClassSummons({ userId }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const pull = async () => {
    const command = await studentPlatformCommandAction();
    if (command.enterClass && pathname !== "/student/class") {
      router.push("/student/class");
    }
  };
  const initialPull = useEffectEvent(pull);

  useEffect(() => {
    void initialPull().catch(() => {});
  }, [pathname, router]);

  useRealtimeSubscription({
    channel: `user:${userId}`,
    events: "summon",
    onMessage: pull,
    onFallback: pull,
    fallbackMs: 30_000,
  });

  return null;
}
