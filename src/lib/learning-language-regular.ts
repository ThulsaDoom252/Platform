import { isRegularTranslationExercise, normalizeRegularLessonSections, regularExerciseOverride } from "./regular-lesson";
import { detectTranslationLang } from "./translation-lang";

/** Old private worksheet edits predate translationLanguage. Infer it only
 * from the original translation-check list, never from an ordinary fill task. */
export function learningRegularOverrides(sections: unknown, answers: Record<string, string>) {
  const normalized = normalizeRegularLessonSections(sections);
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(answers)) {
    const match = key.match(/^regular-exercise-override:(.+):(\d+)$/);
    if (!match) continue;
    const exercise = regularExerciseOverride(answers, match[1], Number(match[2]));
    if (!exercise) continue;
    const section = normalized.find(item => item.id === match[1]);
    if (!section || section.teacherOnly || section.tone === "teacher") continue;
    overrides[key] = isRegularTranslationExercise(section, Number(match[2]))
      ? { ...exercise, translationLanguage: exercise.translationLanguage ?? detectTranslationLang(exercise.items.map(item => item.prompt)) ?? "RU" }
      : exercise;
  }
  return overrides;
}
