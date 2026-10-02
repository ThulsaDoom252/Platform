/** Спокойная палитра категорий: одинаковое название всегда получает один цвет. */
const PALETTE = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#22c55e",
];

const NAMED: Record<string, string> = {
  green: "#10b981",
  emerald: "#10b981",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#8b5cf6",
  violet: "#8b5cf6",
  pink: "#ec4899",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  cyan: "#06b6d4",
  teal: "#14b8a6",
};

/** Цвет из материала либо стабильный автоматический цвет категории. */
export function categoryColor(category: string | null | undefined, preferred?: string | null) {
  const raw = String(preferred ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(raw)) return raw;
  if (NAMED[raw]) return NAMED[raw];

  const key = String(category ?? "").trim().toLocaleLowerCase();
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
