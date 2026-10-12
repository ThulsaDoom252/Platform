import { detectTranslationLang, type TranslationLang } from "./translation-lang";
import { isRegularTranslationExercise, type RegularLessonSection } from "./regular-lesson";

export const LEARNING_LANGUAGES = ["RU", "UK"] as const;
export type LearningLanguage = TranslationLang;
export function learningLanguage(value: unknown): LearningLanguage | null {
  return value === "RU" || value === "UK" ? value : null;
}
export type LearningSegment = { text: string; source?: LearningLanguage | "EN"; context: string };
type Path = (string | number)[];
type TextPatch = { path: Path; segment: number; htmlToken?: number };
export type LearningTranslationPlan = {
  segments: LearningSegment[];
  patches: TextPatch[];
  languagePaths: Path[];
};
const cyrillic = /[\u0400-\u04ff]/;
const ignored = new Set(["answers", "attempts", "results", "state", "sourceText", "contentBackup", "teacherFeedback", "teacherNote", "transcript", "questions"]);
const ruleTypes = new Set(["heading", "text", "callout", "formula", "example", "list", "table", "word", "form", "marker", "grid", "link"]);
const htmlTokens = (html: string) => html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? [];
const decode = (text: string) => text.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, value => {
  const entities: Record<string, string> = { "&nbsp;": "\u00a0", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  if (value.toLowerCase() in entities) return entities[value.toLowerCase()];
  const number = /^&#x/i.test(value) ? parseInt(value.slice(3), 16) : parseInt(value.slice(2), 10);
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : value;
});
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Only translation-capable fields enter the plan. English sources and learner history never do. */
export function collectLearningTranslations(value: unknown, target: LearningLanguage): LearningTranslationPlan {
  const plan: LearningTranslationPlan = { segments: [], patches: [], languagePaths: [] };
  const wordByTranslation = new Map<string, Path>();
  const chooseOptions: { path: Path; text: unknown; hint?: LearningLanguage | null; wordPath?: Path }[] = [];
  const indexWords = (entry: unknown, path: Path) => {
    if (Array.isArray(entry)) { entry.forEach((item, i) => indexWords(item, [...path, i])); return; }
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const english = [row.english, row.word, row.phrase, row.base].find(text => typeof text === "string" && !cyrillic.test(text));
    if (typeof row.translation === "string" && typeof english === "string") wordByTranslation.set(row.translation, [...path, "translation"]);
    Object.entries(row).forEach(([key, child]) => { if (!ignored.has(key)) indexWords(child, [...path, key]); });
  };
  indexWords(value, []);
  const add = (path: Path, current: unknown, english?: unknown, hint?: LearningLanguage | null, context = "English learning translation", htmlToken?: number) => {
    const text = typeof current === "string" ? current.trim() : "";
    const en = typeof english === "string" ? english.trim() : "";
    const source = detectTranslationLang([text]) ?? hint ?? undefined;
    if (text && source === target) return;
    // Latin-only examples/definitions are originals, not Russian/Ukrainian explanations.
    if (text && !cyrillic.test(text) && !en) return;
    const sourceText = en || text;
    if (!sourceText) return;
    const segment = plan.segments.length;
    plan.segments.push({ text: sourceText, source: en ? "EN" : source, context });
    plan.patches.push({ path, segment, ...(htmlToken === undefined ? {} : { htmlToken }) });
  };
  const explanatory = (path: Path, text: unknown, hint?: LearningLanguage | null) => {
    if (typeof text === "string" && cyrillic.test(text)) add(path, text, undefined, hint);
  };
  const html = (path: Path, text: unknown, hint?: LearningLanguage | null) => {
    if (typeof text !== "string") return;
    htmlTokens(text).forEach((token, index) => {
      if (token.startsWith("<") || !cyrillic.test(token)) return;
      add(path, decode(token), undefined, hint, "Russian/Ukrainian explanation in an English worksheet; keep English examples unchanged", index);
    });
  };
  const walk = (entry: unknown, path: Path, inherited?: LearningLanguage | null) => {
    if (Array.isArray(entry)) { entry.forEach((item, i) => walk(item, [...path, i], inherited)); return; }
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    if (row.teacherOnly === true || row.tone === "teacher") return;
    const hint = learningLanguage(row.translationLang) ?? learningLanguage(row.translationLanguage) ?? inherited;
    const handled = new Set<string>();
    const paired = (field: string, englishField: string, force = false) => {
      if (!force && !(field in row)) return;
      const context = `English learning item: ${String(row[englishField] ?? "").slice(0, 1000)}. Existing translation (sense/context only): ${String(row[field] ?? "").slice(0, 1000)}`;
      add([...path, field], row[field], row[englishField], hint, context);
      handled.add(field);
    };
    const explain = (field: string) => { explanatory([...path, field], row[field], hint); handled.add(field); };

    if ("translation" in row) {
      const source = ["english", "word", "phrase", "base", "body", "text"].find(key => typeof row[key] === "string" && !cyrillic.test(row[key] as string));
      if (source && row.kind !== "NOTE") {
        paired("translation", source);
        plan.languagePaths.push([...path, "translationLang"]);
      }
      else explain("translation");
      explain("note");
      if (row.kind === "NOTE") explain("phrase");
    }
    if (row.type === "word" || row.type === "marker") paired("tr", "word", true);
    else if (typeof row.en === "string" && ("tr" in row || row.type === "example")) paired("tr", "en", true);
    if (row.mode === "choose" && Array.isArray(row.options)) {
      const word = row.word && typeof row.word === "object" ? row.word as Record<string, unknown> : null;
      row.options.forEach((text, i) => chooseOptions.push({ path: [...path, "options", i], text, hint, ...(word?.translation === text ? { wordPath: [...path, "word", "translation"] } : {}) }));
      handled.add("options");
    }
    if (typeof row.type === "string" && ruleTypes.has(row.type)) {
      for (const field of ["text", "label", "why", "sense", "formula", "hintText", "title"]) explain(field);
      for (const field of ["items", "headers", "rows", "notes"]) {
        const strings = (part: unknown, subPath: Path) => {
          if (Array.isArray(part)) part.forEach((item, i) => strings(item, [...subPath, i]));
          else explanatory(subPath, part, hint);
        };
        strings(row[field], [...path, field]);
        // String cells are patched here; nested cards/blocks still need traversal.
      }
      if (row.type === "marker") paired("ru", "en");
    }
    if (row.kind === "translate" && Array.isArray(row.items)) {
      const fromEnglish = row.translationDirection === "from-english";
      row.items.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const question = item as Record<string, unknown>;
        const itemPath = [...path, "items", index];
        add([...itemPath, fromEnglish ? "answer" : "prompt"], question[fromEnglish ? "answer" : "prompt"], question[fromEnglish ? "prompt" : "answer"], hint);
        // Only target-language accepted answers change, never English keys.
        if (fromEnglish && Array.isArray(question.accepted)) question.accepted.forEach((text, i) => add([...itemPath, "accepted", i], text, undefined, hint));
      });
      plan.languagePaths.push([...path, "translationLanguage"]); handled.add("items");
    } else if (Array.isArray(row.items) && (row.translationLanguage || /translation|перевод|переклад/i.test(String(row.title ?? "")))) {
      // Explicit translation overrides in regular worksheets always translate INTO English.
      row.items.forEach((item, i) => {
        if (!item || typeof item !== "object") return;
        const question = item as Record<string, unknown>;
        const answers = Array.isArray(question.answers) ? question.answers : [];
        add([...path, "items", i, "prompt"], question.prompt, answers[0], hint);
      });
      plan.languagePaths.push([...path, "translationLanguage"]); handled.add("items");
    }
    for (const field of ["studentHtml", "teacherHtml"]) {
      if (field in row) { html([...path, field], row[field], hint); handled.add(field); }
    }
    if (typeof row.studentHtml === "string" && row.exerciseOverrides && typeof row.exerciseOverrides === "object") {
      for (const [index, override] of Object.entries(row.exerciseOverrides)) {
        if (!override || typeof override !== "object") continue;
        const exercise = override as Record<string, unknown>;
        const translation = isRegularTranslationExercise(row as RegularLessonSection, Number(index));
        walk(translation ? { ...exercise, translationLanguage: learningLanguage(exercise.translationLanguage) ?? hint ?? "RU" } : exercise, [...path, "exerciseOverrides", index], hint);
      }
      handled.add("exerciseOverrides");
    }
    if ("translationLang" in row) plan.languagePaths.push([...path, "translationLang"]);
    for (const [key, child] of Object.entries(row)) {
      if (!ignored.has(key) && !handled.has(key)) walk(child, [...path, key], hint);
    }
  };
  walk(value, []);
  // A choose option must equal the word's translated answer exactly, including
  // a teacher's existing target-language wording. Do not translate it twice.
  for (const option of chooseOptions) {
    const wordPath = option.wordPath ?? (typeof option.text === "string" ? wordByTranslation.get(option.text) : undefined);
    if (wordPath) {
      const patch = plan.patches.find(item => JSON.stringify(item.path) === JSON.stringify(wordPath));
      if (patch) plan.patches.push({ path: option.path, segment: patch.segment });
    } else add(option.path, option.text, undefined, option.hint);
  }
  return plan;
}

/** Apply to a fresh payload, not a cached copy: response/progress metadata is always current. */
export function applyLearningTranslations<T>(value: T, target: LearningLanguage, plan: LearningTranslationPlan, translated: readonly string[]): T {
  const result = structuredClone(value);
  const get = (path: Path): unknown => path.reduce<unknown>((item, key) => (item as Record<string | number, unknown>)?.[key], result);
  const set = (path: Path, next: unknown) => {
    if (!path.length) return;
    const parent = get(path.slice(0, -1)) as Record<string | number, unknown> | undefined;
    if (parent) parent[path.at(-1)!] = next;
  };
  const htmlChanges = new Map<string, { path: Path; tokens: string[] }>();
  for (const patch of plan.patches) {
    const text = translated[patch.segment];
    if (typeof text !== "string" || !text.trim()) throw new Error("Incomplete learning-language translation");
    if (patch.htmlToken === undefined) { set(patch.path, text); continue; }
    const key = JSON.stringify(patch.path);
    const group = htmlChanges.get(key) ?? { path: patch.path, tokens: htmlTokens(String(get(patch.path))) };
    const old = group.tokens[patch.htmlToken];
    const leading = old.match(/^\s*/)?.[0] ?? "", trailing = old.match(/\s*$/)?.[0] ?? "";
    group.tokens[patch.htmlToken] = leading + escape(text.trim()) + trailing;
    htmlChanges.set(key, group);
  }
  for (const group of htmlChanges.values()) set(group.path, group.tokens.join(""));
  for (const path of plan.languagePaths) set(path, target);
  return result;
}
