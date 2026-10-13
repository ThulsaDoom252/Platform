"use client";

import { createContext, useContext, useState } from "react";
import type { HighlightColor } from "@/lib/lesson-unit";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function useHighlightTools() {
  const [enabled, setEnabled] = useState(false);
  const [color, setColor] = useState<HighlightColor>("yellow");
  return {
    enabled, color,
    toggle() { setEnabled((value) => !value); },
    chooseColor(next: HighlightColor) { setColor(next); },
  };
}
export type HighlightTools = ReturnType<typeof useHighlightTools>;
export const HighlightToolsContext = createContext<HighlightTools | null>(null);
export const useSharedHighlightTools = () => useContext(HighlightToolsContext);

/** Every control stays mounted and the hint stays identical in both modes. */
export function HighlightToolButtons({ tools, showToggle = true, large = false }: { tools: HighlightTools; showToggle?: boolean; large?: boolean }) {
  const { t } = useT();
  return <>
    {showToggle && <button type="button" onClick={tools.toggle} aria-pressed={tools.enabled}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold ring-1 transition",
        tools.enabled ? "bg-yellow-300 text-slate-950 ring-yellow-500" : "bg-surface text-muted ring-line hover:text-content")}>
      <span aria-hidden>🖍️</span>{t.interactiveHomework.highlightToggle}
    </button>}
    <div className={cn("flex shrink-0 items-center rounded-lg bg-surface ring-1 ring-line", large ? "h-11 gap-2 px-3" : "h-9 gap-1.5 px-2", !tools.enabled && "opacity-45")}>
      {(["yellow", "green", "red"] as const).map((color) => <button key={color} type="button" disabled={!tools.enabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => tools.chooseColor(color)}
        aria-pressed={tools.color === color} aria-label={color === "yellow" ? t.lessonUnits.highlightYellow : color === "green" ? t.lessonUnits.highlightGreen : t.interactiveHomework.highlightRed}
        className={cn("rounded-full", large ? "h-8 w-8" : "h-5 w-5", color === "yellow" ? "bg-yellow-300" : color === "green" ? "bg-emerald-400" : "bg-rose-500",
          tools.color === color ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "ring-1 ring-black/10")} />)}
    </div>
  </>;
}
