"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { HighlightColor } from "@/lib/lesson-unit";
import { cn } from "@/lib/utils";

type WordRange = {
  key: string;
  node: Text;
  start: number;
  end: number;
  range: Range;
};

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
    "[data-no-lesson-highlight], input, textarea, select, option, script, style, svg, canvas, video, audio, [contenteditable='true']",
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
function collectWordRanges(root: HTMLElement): WordRange[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const collisions = new Map<string, number>();
  const words: WordRange[] = [];
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    const scope = node.parentElement?.closest<HTMLElement>("[data-lesson-highlight-scope]");
    if (scope && root.contains(scope) && !ignoredText(node)) {
      const text = node.data;
      for (const match of text.matchAll(WORD_PATTERN)) {
        const start = match.index;
        const end = start + match[0].length;
        const scopeName = scope.dataset.lessonHighlightScope ?? "lesson";
        const fingerprint = `${scopeName}\u0000${text}\u0000${start}\u0000${match[0].toLocaleLowerCase()}`;
        const occurrence = collisions.get(fingerprint) ?? 0;
        collisions.set(fingerprint, occurrence + 1);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        words.push({
          key: `text:${hash32(scopeName)}:${hash32(fingerprint)}:${occurrence}`,
          node,
          start,
          end,
          range,
        });
      }
    }
    current = walker.nextNode();
  }

  return words;
}

function cssHighlightApi() {
  const registry = (globalThis.CSS as typeof CSS & { highlights?: HighlightRegistry } | undefined)
    ?.highlights;
  const Constructor = (globalThis as typeof globalThis & {
    Highlight?: new (...ranges: Range[]) => unknown;
  }).Highlight;
  return registry && Constructor ? { registry, Constructor } : null;
}

function caretAtPoint(x: number, y: number) {
  const modern = document as Document & {
    caretPositionFromPoint?: (left: number, top: number) => {
      offsetNode: Node;
      offset: number;
    } | null;
    caretRangeFromPoint?: (left: number, top: number) => Range | null;
  };
  const position = modern.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = modern.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

export function LessonTextHighlighter({
  children,
  marks,
  enabled,
  color,
  onHighlight,
  className,
}: {
  children: ReactNode;
  marks: Record<string, string>;
  enabled: boolean;
  color: HighlightColor;
  onHighlight?: (key: string) => void;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const paint = useCallback(() => {
    const root = rootRef.current;
    const api = cssHighlightApi();
    if (!root || !api) return;

    const grouped: Record<HighlightColor, Range[]> = {
      yellow: [],
      green: [],
      red: [],
    };
    for (const word of collectWordRanges(root)) {
      const mark = marks[word.key];
      if (mark === "yellow" || mark === "green" || mark === "red") {
        grouped[mark].push(word.range);
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
    const observer = new MutationObserver(() => {
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

  const chooseWord = (event: MouseEvent<HTMLDivElement>) => {
    if (!enabled || !onHighlight) return;
    const target = event.target instanceof Element ? event.target : null;
    const scope = target?.closest("[data-lesson-highlight-scope]");
    if (!scope || target?.closest("[data-no-lesson-highlight]")) return;

    const words = rootRef.current ? collectWordRanges(rootRef.current) : [];
    const caret = caretAtPoint(event.clientX, event.clientY);
    let word = caret
      ? words.find((entry) => (
          entry.node === caret.node && caret.offset >= entry.start && caret.offset <= entry.end
        ))
      : undefined;

    if (!word) {
      word = words.find((entry) => {
        if (!scope.contains(entry.node.parentElement)) return false;
        return [...entry.range.getClientRects()].some((rect) => (
          event.clientX >= rect.left - 2 &&
          event.clientX <= rect.right + 2 &&
          event.clientY >= rect.top - 2 &&
          event.clientY <= rect.bottom + 2
        ));
      });
    }
    if (!word) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;
    onHighlight(word.key);
  };

  return (
    <div
      ref={rootRef}
      onClickCapture={chooseWord}
      data-highlight-color={enabled ? color : undefined}
      className={cn(enabled && "lesson-word-highlight-active", className)}
    >
      <style data-no-lesson-highlight>{HIGHLIGHT_STYLES}</style>
      {children}
    </div>
  );
}
