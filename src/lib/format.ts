export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const lessonStatusLabels: Record<string, string> = {
  SCHEDULED: "Запланирован",
  COMPLETED: "Проведён",
  CANCELLED_BY_STUDENT: "Отменён учеником",
  CANCELLED_BY_TEACHER: "Отменён учителем",
  BURNED: "Сгорел",
};

export const lessonStatusTone: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  SCHEDULED: "info",
  COMPLETED: "success",
  CANCELLED_BY_STUDENT: "warning",
  CANCELLED_BY_TEACHER: "warning",
  BURNED: "danger",
};

export const homeworkStatusLabels: Record<string, string> = {
  NOT_DONE: "Не выполнена",
  SUBMITTED: "Отправлена учеником",
  IN_REVIEW: "На проверке",
  REVIEWED: "Просмотрена",
  NEEDS_REVISION: "Отправлена на доработку",
};

export const homeworkStatusTone: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  NOT_DONE: "default",
  SUBMITTED: "info",
  IN_REVIEW: "warning",
  REVIEWED: "success",
  NEEDS_REVISION: "danger",
};
