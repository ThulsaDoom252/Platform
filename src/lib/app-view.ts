export const APP_VIEWS = ["CLASSIC", "UPDATED"] as const;
export type AppView = (typeof APP_VIEWS)[number];
export function appViewPreference(role: "TEACHER" | "STUDENT" = "TEACHER"): { setting: string; fallback: AppView } {
  // One-time student rollout: ignore the old Classic choice, then keep any
  // explicit choice made in Settings. Do not bump this key on ordinary releases.
  return role === "STUDENT"
    ? { setting: "application:view:student-updated-v1", fallback: "UPDATED" }
    : { setting: "application:view", fallback: "CLASSIC" };
}
export function normalizeAppView(value: unknown): AppView {
  return value === "UPDATED" ? "UPDATED" : "CLASSIC";
}
export function classParticipantsPlacement(view: AppView, teacher: boolean, materialsLoaded: boolean) {
  if (view !== "UPDATED" || !materialsLoaded) return "ABOVE" as const;
  return teacher ? ("TEACHER_INLINE" as const) : ("STUDENT_INLINE" as const);
}
