/** Readable text sizes; card faces grow to fit their full contents, never scroll. */
export function wordDeckTextSize(text: string | null | undefined, kind: "word" | "spelling" | "description" = "word") {
  const length = text?.trim().length ?? 0;
  if (kind === "description") {
    if (length <= 160) return "text-lg sm:text-2xl";
    if (length <= 360) return "text-base sm:text-lg";
    return "text-sm sm:text-base";
  }
  if (length <= 18) return kind === "spelling" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl";
  if (length <= 42) return "text-2xl sm:text-4xl";
  if (length <= 90) return "text-xl sm:text-3xl";
  if (length <= 180) return "text-lg sm:text-2xl";
  return "text-base sm:text-xl";
}
