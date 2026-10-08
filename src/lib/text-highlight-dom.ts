/** Geometry only: never inserts wrappers or changes text layout. */
export function rangeContainsPoint(range: Range, x: number, y: number) {
  return [...range.getClientRects()].some((rect) =>
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
}

export function wordAtPoint(root: HTMLElement, x: number, y: number): { start: number; end: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ text: Text; offset: number }> = [];
  let text = "";
  let node = walker.nextNode();
  while (node) {
    nodes.push({ text: node as Text, offset: text.length });
    text += (node as Text).data;
    node = walker.nextNode();
  }
  // A previously selected fragment can split one word into several text nodes.
  // Hit-test the original word across all of them, not just the colored piece.
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:[’'ʼ-][\p{L}\p{M}\p{N}]+)*/gu)) {
    const start = match.index; const end = start + match[0].length;
    const first = nodes.find((entry) => start >= entry.offset && start < entry.offset + entry.text.data.length);
    const last = nodes.find((entry) => end > entry.offset && end <= entry.offset + entry.text.data.length);
    if (!first || !last) continue;
    const range = document.createRange();
    range.setStart(first.text, start - first.offset); range.setEnd(last.text, end - last.offset);
    if (rangeContainsPoint(range, x, y)) return { start, end };
  }
  return null;
}

export function selectedOffsets(root: HTMLElement, selected: Range) {
  const contents = document.createRange();
  contents.selectNodeContents(root);
  if (!selected.intersectsNode(root)) return null;
  const intersection = selected.cloneRange();
  if (selected.compareBoundaryPoints(Range.START_TO_START, contents) < 0) intersection.setStart(contents.startContainer, contents.startOffset);
  if (selected.compareBoundaryPoints(Range.END_TO_END, contents) > 0) intersection.setEnd(contents.endContainer, contents.endOffset);
  const prefix = contents.cloneRange();
  prefix.setEnd(intersection.startContainer, intersection.startOffset);
  const start = prefix.toString().length;
  const end = start + intersection.toString().length;
  return end > start && root.textContent?.slice(start, end).trim() ? { start, end } : null;
}
