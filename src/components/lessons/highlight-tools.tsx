"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { HighlightColor } from "@/lib/lesson-unit";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export type HighlightTool = "word" | "select";
export function useHighlightTools() {
  const [enabled, setEnabled] = useState(false);
  const [tool, setTool] = useState<HighlightTool>("word");
  const [color, setColor] = useState<HighlightColor>("yellow");
  const pending = useRef<((color: HighlightColor) => void) | null>(null);
  return {
    enabled, tool, color,
    toggle() { pending.current = null; setEnabled((value) => !value); },
    chooseTool(next: HighlightTool) { pending.current = null; setTool(next); },
    select(apply: (color: HighlightColor) => void) { pending.current = apply; },
    chooseColor(next: HighlightColor) {
      setColor(next);
      if (enabled && tool === "select" && pending.current) {
        const apply = pending.current;
        pending.current = null;
        apply(next);
        window.getSelection()?.removeAllRanges();
      }
    },
  };
}
export type HighlightTools = ReturnType<typeof useHighlightTools>;
export const HighlightToolsContext = createContext<HighlightTools | null>(null);
export const useSharedHighlightTools = () => useContext(HighlightToolsContext);

/** Every control stays mounted and the hint stays identical in both modes. */
export function HighlightToolButtons({ tools }: { tools: HighlightTools }) {
  const { t } = useT();
  return <>
    <button type="button" onClick={tools.toggle} aria-pressed={tools.enabled}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold ring-1 transition",
        tools.enabled ? "bg-yellow-300 text-slate-950 ring-yellow-500" : "bg-surface text-muted ring-line hover:text-content")}>
      <span aria-hidden>🖍️</span>{t.interactiveHomework.highlightToggle}
    </button>
    <div className="flex h-9 shrink-0 items-center rounded-lg bg-surface p-1 ring-1 ring-line">
      {(["word", "select"] as const).map((tool) => <button key={tool} type="button" disabled={!tools.enabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => tools.chooseTool(tool)}
        aria-pressed={tools.tool === tool} className={cn("h-7 rounded-md px-2 text-[11px] font-bold transition disabled:opacity-45",
          tools.tool === tool ? "bg-accent text-white" : "text-muted hover:text-content")}>
        {tool === "word" ? t.interactiveHomework.highlightWords : t.interactiveHomework.highlightSelect}
      </button>)}
    </div>
    <div className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-2 ring-1 ring-line", !tools.enabled && "opacity-45")}>
      {(["yellow", "green", "red"] as const).map((color) => <button key={color} type="button" disabled={!tools.enabled}
        onMouseDown={(event) => event.preventDefault()} onClick={() => tools.chooseColor(color)}
        aria-pressed={tools.color === color} aria-label={color === "yellow" ? t.lessonUnits.highlightYellow : color === "green" ? t.lessonUnits.highlightGreen : t.interactiveHomework.highlightRed}
        className={cn("h-5 w-5 rounded-full", color === "yellow" ? "bg-yellow-300" : color === "green" ? "bg-emerald-400" : "bg-rose-500",
          tools.color === color ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "ring-1 ring-black/10")} />)}
    </div>
  </>;
}
