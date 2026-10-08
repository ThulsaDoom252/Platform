"use client";

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { homeworkHighlightSegments, type HomeworkHighlightColor } from "@/lib/lesson-homework";
import { wordAtPoint } from "@/lib/text-highlight-dom";
import { createHighlightGestureGuard, isHighlightPointerClick } from "@/lib/highlight-gesture";
import { useSharedHighlightTools } from "./highlight-tools";
import { cn } from "@/lib/utils";

/** The real native field is always mounted. A non-interactive mirror paints only its text. */
export function HighlightableAnswerField({
  value, colors, onChange, onCommit, onHighlight, label, placeholder, className,
  multiline = false, disabled = false, choices,
}: {
  value: string;
  colors: Array<HomeworkHighlightColor | null>;
  onChange: (value: string) => void;
  onCommit: (value?: string) => void;
  onHighlight?: (start: number, end: number, color: HomeworkHighlightColor, word?: boolean) => void;
  label: string;
  placeholder: string;
  className: string;
  multiline?: boolean;
  disabled?: boolean;
  choices?: string[];
}) {
  const tools = useSharedHighlightTools();
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const gesture = useRef(createHighlightGestureGuard());
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [metrics, setMetrics] = useState<{ style: CSSProperties; width: number } | null>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const active = Boolean(tools?.enabled && onHighlight);
  const shown = Boolean(metrics && value && !focused && (colors.some(Boolean) || active));

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    const measure = () => {
      const style = getComputedStyle(control);
      setMetrics({
        style: {
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
          textAlign: style.textAlign as CSSProperties["textAlign"], textTransform: style.textTransform as CSSProperties["textTransform"],
          padding: style.padding, borderWidth: style.borderWidth, borderStyle: "solid", borderColor: "transparent",
          boxSizing: "border-box", color: style.color === "rgba(0, 0, 0, 0)" || style.color === "transparent" ? "var(--color-content)" : style.color, background: "transparent",
        },
        width: control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      });
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(control);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [className]);

  const commitBeforeHighlight = () => {
    const control = controlRef.current;
    // blur synchronously starts the usual save before the following highlight action.
    if (control && document.activeElement === control) control.blur();
    else { if (value !== value.trim()) onChange(value.trim()); onCommit(value); }
  };
  const highlight = (start: number, end: number, color: HomeworkHighlightColor, word = false) => {
    // Answers are trimmed on save; the selection must address the saved text.
    const prefix = value.length - value.trimStart().length;
    const trimmedStart = Math.max(0, start - prefix);
    const trimmedEnd = Math.min(value.trim().length, end - prefix);
    if (trimmedEnd > trimmedStart) onHighlight?.(trimmedStart, trimmedEnd, color, word);
  };
  const highlightSelection = (event: SyntheticEvent<HTMLDivElement>) => {
    if (!active || !tools) return;
    const control = controlRef.current;
    if (!control || control instanceof HTMLSelectElement) return;
    const start = control.selectionStart ?? 0;
    const end = control.selectionEnd ?? 0;
    if (end <= start || !value.slice(start, end).trim()) return;
    gesture.current.selected();
    event.stopPropagation();
    control.setSelectionRange(end, end);
    commitBeforeHighlight();
    highlight(start, end, tools.color);
  };
  const shared = {
    value, disabled, "aria-label": label,
    className,
    style: shown ? { color: "transparent", caretColor: "var(--color-content)" } : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => { setFocused(false); if (value !== value.trim()) onChange(value.trim()); onCommit(value); },
    onScroll: () => { const control = controlRef.current; if (control) setScroll({ left: control.scrollLeft, top: control.scrollTop }); },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (event.key !== "Enter" || (multiline && event.shiftKey) || choices) return;
      event.preventDefault(); event.currentTarget.blur();
    },
  };

  return <div className={cn("relative min-w-0", multiline ? "w-full" : "w-56 max-w-full")}
    data-homework-answer-field data-no-lesson-highlight
    onMouseMove={(event) => {
      const control = controlRef.current;
      if (!control) return;
      control.style.cursor = active && textRef.current && wordAtPoint(textRef.current, event.clientX, event.clientY) ? "pointer" : "";
    }}
    onMouseLeave={() => { if (controlRef.current) controlRef.current.style.cursor = ""; }}
    onMouseDownCapture={(event) => {
      gesture.current.begin();
      pointerStart.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
      // Text fields must receive mousedown so native drag selection and typing work.
      // A select has no drag selection; keep its existing word-click behavior.
      if (!choices || !active || !tools || event.button !== 0 || !textRef.current) return;
      const word = wordAtPoint(textRef.current, event.clientX, event.clientY);
      if (!word) return; // Blank space belongs to the native editor, not to highlighting.
      event.preventDefault(); event.stopPropagation();
      gesture.current.selected();
      commitBeforeHighlight();
      highlight(word.start, word.end, tools.color, true);
    }}
    onClickCapture={(event) => {
      if (!active || !tools) return;
      if (gesture.current.consumeClick(event.detail > 0)) {
        event.preventDefault(); event.stopPropagation();
        return;
      }
      if (choices || event.detail > 1 || !textRef.current ||
        !isHighlightPointerClick(pointerStart.current, event.clientX, event.clientY)) return;
      const word = wordAtPoint(textRef.current, event.clientX, event.clientY);
      if (!word) return;
      event.preventDefault(); event.stopPropagation();
      commitBeforeHighlight();
      highlight(word.start, word.end, tools.color, true);
    }}
    onMouseUp={highlightSelection}
    onKeyUp={(event) => { if (event.key === "Shift") highlightSelection(event); }}>
    {choices ? <select {...shared} ref={(node) => { controlRef.current = node; }} onChange={(event) => { onChange(event.target.value); onCommit(event.target.value); }}>
      <option value="" disabled>{placeholder}</option>
      {value && !choices.includes(value) && <option value={value}>{value}</option>}
      {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
    </select> : multiline ? <textarea {...shared} ref={(node) => { controlRef.current = node; }}
      onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> :
      <input {...shared} ref={(node) => { controlRef.current = node; }} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    <div ref={mirrorRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ ...metrics?.style, opacity: shown ? 1 : 0, display: multiline ? "block" : "flex", alignItems: "center" }}>
      <span ref={textRef} style={{ display: "block", width: metrics?.width, flexShrink: 0,
        whiteSpace: multiline ? "pre-wrap" : "pre", overflowWrap: "break-word", transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
        {homeworkHighlightSegments(value, colors).map((segment, index) => <span key={index}
          style={segment.color ? { backgroundColor: segment.color === "yellow" ? "#fde047" : segment.color === "green" ? "#6ee7b7" : "#fda4af", color: "#172033" } : undefined}>{segment.text}</span>)}
      </span>
    </div>
  </div>;
}
