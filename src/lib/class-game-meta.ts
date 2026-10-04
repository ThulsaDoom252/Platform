export type ClassGameGrade = "GREAT" | "GOOD" | "NOT_BAD" | "RIDICULOUS";

export type ClassActivitySetting = {
  teacherSeesAnswers: boolean;
};

export type ClassGameReview = {
  activityKey: string;
  title: string;
  grade: ClassGameGrade;
  notes: string;
  visible: boolean;
  at: string;
};

export type ClassGameReviewNotice = ClassGameReview;

export type ClassActivityMeta = {
  order: string[];
  settings: Record<string, ClassActivitySetting>;
  reviews: Record<string, ClassGameReview>;
};

export const CLASS_GAME_GRADES: ClassGameGrade[] = [
  "GREAT",
  "GOOD",
  "NOT_BAD",
  "RIDICULOUS",
];

export const classActivityKey = (kind: "game" | "revision", id: string) =>
  `${kind}:${id}`;

export function normalizeClassGameReview(value: unknown): ClassGameReview | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ClassGameReview>;
  if (
    typeof row.activityKey !== "string" ||
    typeof row.title !== "string" ||
    !CLASS_GAME_GRADES.includes(row.grade as ClassGameGrade) ||
    typeof row.at !== "string"
  ) return null;
  return {
    activityKey: row.activityKey.slice(0, 100),
    title: row.title.slice(0, 120),
    grade: row.grade as ClassGameGrade,
    notes: typeof row.notes === "string" ? row.notes.slice(0, 1000) : "",
    visible: row.visible === true,
    at: row.at,
  };
}

export const classGameGradeStyle: Record<ClassGameGrade, {
  emoji: string;
  panel: string;
  button: string;
}> = {
  GREAT: {
    emoji: "🌟",
    panel: "border-emerald-400/50 bg-emerald-400/15 text-emerald-950 dark:text-emerald-50",
    button: "border-emerald-400/40 bg-emerald-500/15 text-emerald-500",
  },
  GOOD: {
    emoji: "😊",
    panel: "border-sky-400/50 bg-sky-400/15 text-sky-950 dark:text-sky-50",
    button: "border-sky-400/40 bg-sky-500/15 text-sky-500",
  },
  NOT_BAD: {
    emoji: "🙂",
    panel: "border-amber-400/50 bg-amber-400/15 text-amber-950 dark:text-amber-50",
    button: "border-amber-400/40 bg-amber-500/15 text-amber-500",
  },
  RIDICULOUS: {
    emoji: "🤦",
    panel: "border-rose-400/50 bg-rose-400/15 text-rose-950 dark:text-rose-50",
    button: "border-rose-400/40 bg-rose-500/15 text-rose-500",
  },
};
