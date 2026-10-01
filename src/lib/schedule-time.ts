/**
 * В расписании хранится не абсолютный UTC-момент, а местное время школы.
 * Drizzle читает `timestamp without time zone` как Date с теми же UTC-полями.
 * Поэтому все поля/форматтеры расписания обязаны работать через UTC-геттеры:
 * браузерная зона пользователя больше не прибавляет и не отнимает часы.
 */
export const SCHOOL_TIME_ZONE = "Europe/Simferopol";
export const SCHEDULE_FORMAT_TIME_ZONE = "UTC";

const inputPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseScheduleInput(raw: string): Date | null {
  const match = inputPattern.exec(String(raw ?? "").trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s = "0"] = match;
  const date = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
  );
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d) ||
    date.getUTCHours() !== Number(h) ||
    date.getUTCMinutes() !== Number(mi)
  ) {
    return null;
  }
  return date;
}

export function scheduleInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function scheduleDateValue(date: Date): string {
  return scheduleInputValue(date).slice(0, 10);
}

/** Текущий реальный момент, представленный местными часами школы. */
export function scheduleNow(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    ),
  );
}

export function sameScheduleDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function scheduleStartOfWeek(date: Date): Date {
  const out = new Date(date);
  out.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export function addScheduleDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function scheduleDateFromISO(raw?: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? ""));
  if (!match) return null;
  return parseScheduleInput(`${match[1]}-${match[2]}-${match[3]}T00:00`);
}
