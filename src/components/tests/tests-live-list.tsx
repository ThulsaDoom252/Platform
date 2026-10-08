"use client";

import { useRouter } from "next/navigation";
import { useRealtimeSubscription } from "@/lib/use-realtime";

export function TestsLiveList({ userId }: { userId: string }) {
  const router = useRouter();
  useRealtimeSubscription({ channel: `user:${userId}`, events: "homework-review",
    onMessage: (message) => { if (message.data?.kind === "TEST") router.refresh(); } });
  return null;
}
