import { en, type Dict } from "./en";
import { ru } from "./ru";
import { uk } from "./uk";
import { plural, type Plural } from "./plural";

export type Locale = "en" | "ru" | "uk";
export type { Dict, Plural };
export { plural };

export const dictionaries: Record<Locale, Dict> = { en, ru, uk };

export const locales: { id: Locale; label: string; code: string }[] = [
  { id: "en", label: "English", code: "EN" },
  { id: "ru", label: "Русский", code: "RU" },
  { id: "uk", label: "Українська", code: "UK" },
];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Подстановка {placeholder} в строку словаря.
 * Если строка счётная, форма выбирается по переданному {n}.
 */
export function fmt(
  template: string | Plural,
  vars: Record<string, string | number> = {},
): string {
  const text =
    typeof template === "string" ? template : plural(template, Number(vars.n ?? 0));

  return text.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? String(vars[key]) : m,
  );
}

export function getDictFor(locale: string | null | undefined): Dict {
  return dictionaries[(locale as Locale) ?? DEFAULT_LOCALE] ?? dictionaries[DEFAULT_LOCALE];
}
