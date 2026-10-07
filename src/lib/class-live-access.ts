import type { SessionPayload } from "@/lib/session";

/** The class student is resolved from the authenticated user's server state. */
export function canReadClassLesson(session: Pick<SessionPayload, "role" | "userId">, classStudentId: string, row: { studentId: string; authorId: string }) {
  if (row.studentId !== classStudentId) return false;
  return session.role === "STUDENT" ? session.userId === row.studentId : session.userId === row.authorId;
}

export function canReadClassDeck(session: Pick<SessionPayload, "role" | "userId">, classStudentId: string, row: { studentId: string; kind: string }) {
  return row.kind === "WORD_DECK" && row.studentId === classStudentId &&
    (session.role === "TEACHER" || session.userId === row.studentId);
}
