export const APP_VIEWS = ["CLASSIC", "UPDATED"] as const;
export type AppView = (typeof APP_VIEWS)[number];
export function normalizeAppView(value: unknown): AppView {
  return value === "UPDATED" ? "UPDATED" : "CLASSIC";
}
export function classParticipantsPlacement(view: AppView, teacher: boolean, materialsLoaded: boolean) {
  if (view !== "UPDATED" || !materialsLoaded) return "ABOVE" as const;
  return teacher ? ("TEACHER_INLINE" as const) : ("STUDENT_INLINE" as const);
}
