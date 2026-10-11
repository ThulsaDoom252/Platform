import { PICKER_GROUPS } from "./icons-data";
import { suggestIcon } from "./icon-suggest";

const materialIcons = new Set(PICKER_GROUPS.flatMap((group) => group.icons.map(([icon]) => icon)));

/** The generated vocabulary suffix must not outweigh the lesson's subject. */
export function automaticMaterialIcon(name: string): string {
  const subject = name.trim().replace(/\s+[—–-]\s+(?:Vocabulary|Словарь|Словник)$/iu, "");
  return suggestIcon(subject) ?? "📚";
}

/** Null/omitted means automatic; explicitly supplied values must be picker icons. */
export function resolveMaterialIcon(name: string, selected: unknown): string | null {
  if (selected === null || selected === undefined) return automaticMaterialIcon(name);
  if (typeof selected !== "string") return null;
  const icon = selected.trim();
  return materialIcons.has(icon) ? icon : null;
}
