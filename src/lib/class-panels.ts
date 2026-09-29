/**
 * Части класса, между которыми ходят учитель и ученик.
 *
 * Список живёт отдельно от серверных действий: файл с "use server"
 * умеет отдавать наружу только асинхронные функции, а список нужен и
 * разметке, и проверке пришедшей команды.
 */
export const CLASS_PANELS = [
  "chat",
  "dictionary",
  "verbs",
  "script",
  "board",
] as const;

export type ClassPanel = (typeof CLASS_PANELS)[number];

/** Пришедшее снаружи имя панели — или ничего. */
export function asPanel(value: unknown): ClassPanel | null {
  return CLASS_PANELS.includes(value as ClassPanel) ? (value as ClassPanel) : null;
}
