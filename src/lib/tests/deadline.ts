import type { Locale } from "@/lib/i18n";
import { parseScheduleInput, scheduleInputValue, scheduleNow, SCHOOL_TIME_ZONE } from "@/lib/schedule-time";

/** datetime-local means the school's wall clock, not the teacher device's time zone. */
export function parseTestDeadlineInput(raw: string): string | null {
  const wall = parseScheduleInput(raw);
  if (!wall || wall.getUTCFullYear() < 2000 || wall.getUTCFullYear() > 2100) return null;
  const offset = scheduleNow(wall).getTime() - wall.getTime();
  const instant = new Date(wall.getTime() - offset);
  if (scheduleInputValue(scheduleNow(instant)) !== scheduleInputValue(wall)) return null;
  return instant.toISOString();
}

export function testDeadlineInputValue(iso?: string | null): string {
  const date = iso ? new Date(iso) : null;
  return date && Number.isFinite(date.getTime()) ? scheduleInputValue(scheduleNow(date)) : "";
}

export function testDeadlineOverdue(dueAt?: string | null, completed = false, now = new Date()): boolean {
  return !completed && !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

export function formatTestDeadline(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: SCHOOL_TIME_ZONE }).format(new Date(iso));
}
