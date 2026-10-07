import "server-only";

import * as Ably from "ably";

export const realtimeChannels = {
  class: (studentId: string) => `class:${studentId}`,
  user: (userId: string) => `user:${userId}`,
  presence: "presence:school",
} as const;

export type RealtimeEvent =
  | "board"
  | "chat"
  | "class-people"
  | "class-sync"
  | "game-state"
  | "homework-review"
  | "lesson"
  | "notification"
  | "presence"
  | "summon"
  | "twister"
  | "vocabulary"
  | "word-deck";

let restClient: Ably.Rest | null | undefined;

function getRestClient() {
  if (restClient !== undefined) return restClient;
  const key = process.env.ABLY_API_KEY?.trim();
  restClient = key ? new Ably.Rest({ key }) : null;
  return restClient;
}

/**
 * Realtime is deliberately best-effort: Postgres remains the source of truth,
 * so a temporary transport outage must never roll back a successful mutation.
 */
export async function publishRealtime(
  channel: string,
  event: RealtimeEvent,
  data: Record<string, unknown> = {},
) {
  const client = getRestClient();
  if (!client) return;
  try {
    await client.channels.get(channel).publish(event, {
      ...data,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Realtime publish failed", { channel, event, error });
  }
}

export function publishClassRealtime(
  studentId: string | null | undefined,
  event: RealtimeEvent,
  data?: Record<string, unknown>,
) {
  if (!studentId) return Promise.resolve();
  return publishRealtime(realtimeChannels.class(studentId), event, data);
}

export function publishUserRealtime(
  userId: string | null | undefined,
  event: RealtimeEvent,
  data?: Record<string, unknown>,
) {
  if (!userId) return Promise.resolve();
  return publishRealtime(realtimeChannels.user(userId), event, data);
}
