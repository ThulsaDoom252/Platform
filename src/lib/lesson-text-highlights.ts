import type { HighlightColor } from "./lesson-unit";

export type LessonHighlightSnippet = {
  key: string;
  text: string;
  words: Array<{ key: string; start: number; end: number }>;
};
export type LessonHighlightFragment = { snippet: LessonHighlightSnippet; start: number; end: number };

export function lessonSnippetColors(marks: Record<string, string>, snippet: LessonHighlightSnippet) {
  const colors: Array<HighlightColor | null> = Array.from({ length: snippet.text.length }, () => null);
  for (const word of snippet.words) {
    const color = marks[word.key];
    if (color === "yellow" || color === "green" || color === "red") colors.fill(color, word.start, word.end);
  }
  const prefix = `${snippet.key}:`;
  for (const [key, color] of Object.entries(marks)) {
    if (!key.startsWith(prefix) || (color !== "yellow" && color !== "green" && color !== "red")) continue;
    const [start, end] = key.slice(prefix.length).split(":").map(Number);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= colors.length) colors.fill(color, start, end);
  }
  return colors;
}

/** Replace just the selected characters; legacy word marks remain readable. */
export function toggleLessonTextFragments(marks: Record<string, HighlightColor>, fragments: LessonHighlightFragment[], color: HighlightColor, wordClick = false) {
  const valid = fragments.filter(({ snippet, start, end }) => Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= snippet.text.length);
  if (!valid.length) return marks;
  const remove = wordClick
    ? valid.some(({ snippet, start, end }) => lessonSnippetColors(marks, snippet).slice(start, end).some(Boolean))
    : valid.every(({ snippet, start, end }) => lessonSnippetColors(marks, snippet).slice(start, end).every((mark) => mark === color));
  const next = { ...marks };
  for (const { snippet, start, end } of valid) {
    const colors = lessonSnippetColors(next, snippet);
    colors.fill(remove ? null : color, start, end);
    snippet.words.forEach((word) => delete next[word.key]);
    Object.keys(next).filter((key) => key.startsWith(`${snippet.key}:`)).forEach((key) => delete next[key]);
    for (let at = 0; at < colors.length;) {
      const mark = colors[at];
      let endAt = at + 1;
      while (endAt < colors.length && colors[endAt] === mark) endAt += 1;
      if (mark) next[`${snippet.key}:${at}:${endAt}`] = mark;
      at = endAt;
    }
  }
  return next;
}
