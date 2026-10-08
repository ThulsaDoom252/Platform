"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { dialogueHighlights, type HighlightColor } from "@/lib/lesson-unit";
import { lessonSnippetColors, toggleLessonTextFragments, type LessonHighlightSnippet, type LessonHighlightFragment } from "@/lib/lesson-text-highlights";
import { rangeContainsPoint } from "@/lib/text-highlight-dom";
import { createHighlightGestureGuard } from "@/lib/highlight-gesture";
import { cn } from "@/lib/utils";

type WordRange = {
  key: string;
  node: Text;
  start: number;
  end: number;
  range: Range;
};
type TextSnippet = LessonHighlightSnippet & { node: Text; ranges: WordRange[] };

type HighlightRegistry = {
  set: (name: string, value: unknown) => void;
  delete: (name: string) => boolean;
};

const HIGHLIGHT_NAMES: Record<HighlightColor, string> = {
  yellow: "lesson-word-yellow",
  green: "lesson-word-green",
  red: "lesson-word-red",
};

// Kept as a runtime style because the current CSS optimizer does not yet
// understand the standards-based ::highlight() pseudo-element.
const HIGHLIGHT_STYLES = `
::highlight(lesson-word-yellow) {
  color: #172033;
  background-color: #fde047;
  text-decoration: underline 2px rgb(202 138 4 / 0.72);
  text-underline-offset: 0.12em;
}
::highlight(lesson-word-green) {
  color: #102a22;
  background-color: #6ee7b7;
  text-decoration: underline 2px rgb(5 150 105 / 0.72);
  text-underline-offset: 0.12em;
}
::highlight(lesson-word-red) {
  color: #3f1019;
  background-color: #fda4af;
  text-decoration: underline 2px rgb(225 29 72 / 0.78);
  text-underline-offset: 0.12em;
}`;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'’-][\p{L}\p{N}]+)*/gu;

function hash32(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function ignoredText(node: Text) {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest(
    "[data-no-lesson-highlight], input, textarea, select, option, script, style, svg, canvas, video, audio",
  ));
}

/**
 * Build deterministic word ranges without changing the React DOM.
 *
 * Keys depend on a named lesson scope, the original text node and the
 * occurrence of an identical snippet. Teacher-only controls are outside a
 * scope (or explicitly ignored), so the same lesson word receives the same
 * key for teacher and student.
 */
function collectTextSnippets(root: HTMLElement): TextSnippet[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const collisions = new Map<string, number>();
  const snippets: TextSnippet[] = [];
  const snippetCollisions = new Map<string, number>();
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    const scope = node.parentElement?.closest<HTMLElement>("[data-lesson-highlight-scope]");
    if (scope && root.contains(scope) && !ignoredText(node)) {
      const text = node.data;
      const scopeName = scope.dataset.lessonHighlightScope ?? "lesson";
      const snippetFingerprint = `${scopeName}\u0000${text}`;
      const snippetOccurrence = snippetCollisions.get(snippetFingerprint) ?? 0;
      snippetCollisions.set(snippetFingerprint, snippetOccurrence + 1);
      const words: WordRange[] = [];
      for (const match of text.matchAll(WORD_PATTERN)) {
        const start = match.index;
        const end = start + match[0].length;
        const fingerprint = `${scopeName}\u0000${text}\u0000${start}\u0000${match[0].toLocaleLowerCase()}`;
        const occurrence = collisions.get(fingerprint) ?? 0;
        collisions.set(fingerprint, occurrence + 1);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        words.push({
          key: node.parentElement?.closest<HTMLElement>("[data-lesson-highlight-key]")?.dataset.lessonHighlightKey ?? `text:${hash32(scopeName)}:${hash32(fingerprint)}:${occurrence}`,
          node,
          start,
          end,
          range,
        });
      }
      snippets.push({ key: `text-range:${hash32(scopeName)}:${hash32(snippetFingerprint)}:${snippetOccurrence}`, text, node, words, ranges: words });
    }
    current = walker.nextNode();
  }

  return snippets;
}

function cssHighlightApi() {
  const registry = (globalThis.CSS as typeof CSS & { highlights?: HighlightRegistry } | undefined)
    ?.highlights;
  const Constructor = (globalThis as typeof globalThis & {
    Highlight?: new (...ranges: Range[]) => unknown;
  }).Highlight;
  return registry && Constructor ? { registry, Constructor } : null;
}

export function LessonTextHighlighter({
  children,
  marks,
  enabled,
  color,
  onHighlight,
  onReplaceHighlights,
  className,
}: {
  children: ReactNode;
  marks: Record<string, string>;
  enabled: boolean;
  color: HighlightColor;
  onHighlight?: (key: string | string[]) => void;
  onReplaceHighlights?: (layer: Record<string, HighlightColor>) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const snippetsRef = useRef<TextSnippet[]>([]);
  const marksRef = useRef(marks);
  const gesture = useRef(createHighlightGestureGuard());
  const hovered = useRef<{ element: HTMLElement; cursor: string } | null>(null);

  const paint = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    marksRef.current = marks;
    snippetsRef.current = collectTextSnippets(root);
    const api = cssHighlightApi();
    if (!api) return;

    const grouped: Record<HighlightColor, Range[]> = {
      yellow: [],
      green: [],
      red: [],
    };
    for (const snippet of snippetsRef.current) {
      const colors = lessonSnippetColors(marks, snippet);
      for (let start = 0; start < colors.length;) {
        const mark = colors[start];
        let end = start + 1;
        while (end < colors.length && colors[end] === mark) end += 1;
        if (mark) {
          const range = document.createRange();
          range.setStart(snippet.node, start); range.setEnd(snippet.node, end);
          grouped[mark].push(range);
        }
        start = end;
      }
    }
    for (const markColor of Object.keys(HIGHLIGHT_NAMES) as HighlightColor[]) {
      api.registry.set(
        HIGHLIGHT_NAMES[markColor],
        new api.Constructor(...grouped[markColor]),
      );
    }
  }, [marks]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = requestAnimationFrame(paint);
    const observer = new MutationObserver((records) => {
      if (records.every(({ target }) => {
        const element = target instanceof Element ? target : target.parentElement;
        return element?.closest("[data-no-lesson-highlight]");
      })) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["open", "hidden", "aria-hidden"],
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      const api = cssHighlightApi();
      if (api) {
        Object.values(HIGHLIGHT_NAMES).forEach((name) => api.registry.delete(name));
      }
    };
  }, [paint]);

  const wordUnderPointer = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const scope = target?.closest("[data-lesson-highlight-scope]");
    if (!scope || target?.closest("[data-no-lesson-highlight]")) return null;
    for (const snippet of snippetsRef.current) {
      if (!scope.contains(snippet.node.parentElement)) continue;
      const word = snippet.ranges.find((entry) => rangeContainsPoint(entry.range, event.clientX, event.clientY));
      if (word) return { snippet, word };
    }
    return null;
  };
  const chooseWord = (event: MouseEvent<HTMLDivElement>) => {
    if (!enabled || (!onHighlight && !onReplaceHighlights)) return;
    if (gesture.current.consumeClick(event.detail > 0)) {
      event.preventDefault(); event.stopPropagation();
      return;
    }
    const hit = wordUnderPointer(event);
    if (!hit) return; // Empty space must keep its normal editing/focus behavior.
    event.preventDefault();
    event.stopPropagation();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    if (event.detail > 1) return;
    if (onReplaceHighlights) {
      const next = toggleLessonTextFragments(dialogueHighlights(marksRef.current), [{ snippet: hit.snippet, start: hit.word.start, end: hit.word.end }], color, true);
      marksRef.current = next;
      onReplaceHighlights(next);
    }
    else onHighlight?.(hit.word.key);
  };

  const chooseSelection = (event: SyntheticEvent<HTMLDivElement>) => {
    if (!enabled || !onReplaceHighlights || !rootRef.current) return;
    if (event.target instanceof Element && event.target.closest("[data-no-lesson-highlight], input, textarea, select")) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const selected = selection.getRangeAt(0);
    if (
      !rootRef.current.contains(selected.startContainer) ||
      !rootRef.current.contains(selected.endContainer)
    ) return;
    const fragments: LessonHighlightFragment[] = [];
    for (const snippet of snippetsRef.current) {
      if (!selected.intersectsNode(snippet.node)) continue;
      const contents = document.createRange(); contents.selectNodeContents(snippet.node);
      const intersection = selected.cloneRange();
      if (selected.compareBoundaryPoints(Range.START_TO_START, contents) < 0) intersection.setStart(snippet.node, 0);
      if (selected.compareBoundaryPoints(Range.END_TO_END, contents) > 0) intersection.setEnd(snippet.node, snippet.text.length);
      const start = intersection.startOffset; const end = intersection.endOffset;
      if (end > start && snippet.text.slice(start, end).trim()) fragments.push({ snippet, start, end });
    }
    if (!fragments.length) return;
    gesture.current.selected();
    event.stopPropagation();
    const next = toggleLessonTextFragments(dialogueHighlights(marksRef.current), fragments, color);
    marksRef.current = next;
    onReplaceHighlights(next);
    selection.removeAllRanges();
  };

  const clearCursor = () => {
    if (hovered.current) hovered.current.element.style.cursor = hovered.current.cursor;
    hovered.current = null;
  };
  useEffect(() => () => {
    if (hovered.current) hovered.current.element.style.cursor = hovered.current.cursor;
    hovered.current = null;
  }, [enabled]);

  return (
    <div
      ref={rootRef}
      data-highlight-active={enabled ? "true" : undefined}
      onMouseDownCapture={() => gesture.current.begin()}
      onClickCapture={chooseWord}
      onMouseUpCapture={chooseSelection}
      onKeyUpCapture={(event) => { if (event.key === "Shift") chooseSelection(event); }}
      onInputCapture={(event) => { if (event.target instanceof HTMLElement && event.target.isContentEditable) paint(); }}
      onMouseLeave={clearCursor}
      onMouseMoveCapture={(event) => {
        clearCursor();
        if (!enabled || !wordUnderPointer(event) || !(event.target instanceof HTMLElement)) return;
        hovered.current = { element: event.target, cursor: event.target.style.cursor };
        event.target.style.cursor = "pointer";
      }}
      data-highlight-color={enabled ? color : undefined}
      className={cn(enabled && "lesson-word-highlight-active", className)}
    >
      <style data-no-lesson-highlight>{HIGHLIGHT_STYLES}</style>
      {children}
    </div>
  );
}
