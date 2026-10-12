"use client";
import { useRouter } from "next/navigation";
import { useRealtimeSubscription } from "@/lib/use-realtime";
/** Refresh translated server props without navigating away from the current page. */
export function LearningLanguageRefresh({ userId }: { userId: string }) {
  const router = useRouter();
  useRealtimeSubscription({ channel: `user:${userId}`, events: "learning-language", onMessage: () => router.refresh(), onFallback: () => router.refresh(), fallbackMs: 60_000 });
  return null;
}
