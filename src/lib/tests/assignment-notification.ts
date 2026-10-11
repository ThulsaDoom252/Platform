import type { Locale } from "@/lib/i18n";
import { TEST_LABELS } from "./labels";

/** Explicit teacher notifications bypass the policy for automatic lesson notifications. */
export function testAssignmentNotification(input: {
  id: string; assignmentId: string; teacherId: string; studentId: string;
  title: string; locale: Locale; event: "assigned" | "restarted" | "reminder";
}) {
  const labels = TEST_LABELS[input.locale];
  const prefix = input.event === "assigned" ? labels.notificationAssigned
    : input.event === "restarted" ? labels.notificationRestarted : labels.notificationReminder;
  return { id: input.id, recipientId: input.studentId, senderId: input.teacherId,
    relatedStudentId: input.studentId, type: "HOMEWORK_SUBMITTED" as const,
    message: `${prefix}: «${input.title}»`, href: `/student/tests/${input.assignmentId}`,
    data: input.event === "reminder" ? { kind: "HOMEWORK_REMINDER" as const } : null };
}
