/** A drag selection is one action: its following browser click must not undo it. */
export function createHighlightGestureGuard() {
  let selectionApplied = false;
  return {
    begin() { selectionApplied = false; },
    selected() { selectionApplied = true; },
    consumeClick(pointer = true) {
      if (!pointer) return false; // Enter/Space must still activate toolbar controls.
      const suppress = selectionApplied;
      selectionApplied = false;
      return suppress;
    },
  };
}

/** Small hand movement is a click; an actual drag must keep native text selection. */
export function isHighlightPointerClick(start: { x: number; y: number } | null, x: number, y: number) {
  return Boolean(start && Math.hypot(x - start.x, y - start.y) <= 5);
}
