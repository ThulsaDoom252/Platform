export type GlobalSearchPosition = { left: number; top: number; width: number; maxHeight: number };

/** Align to the search button, not to a different coordinate system than the app shell. */
export function globalSearchPosition(anchor: { right: number; bottom: number }, viewport: { width: number; height: number }): GlobalSearchPosition {
  const width = Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : 320;
  const height = Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : 480;
  const gap = Math.min(width >= 640 ? 32 : 12, Math.max(0, (width - 1) / 2));
  const panelWidth = Math.min(672, width - gap * 2);
  const right = Number.isFinite(anchor.right) ? anchor.right : width - gap;
  const bottom = Number.isFinite(anchor.bottom) ? anchor.bottom : 64;
  const left = Math.max(gap, Math.min(right - panelWidth, width - gap - panelWidth));
  // Keep the input reachable even on a short landscape viewport.
  const top = Math.max(0, Math.min(bottom + 8, Math.max(0, height - 12 - 48)));
  const maxHeight = Math.max(0, Math.min(680, height * 0.76, height - top - 12));
  return { left, top, width: panelWidth, maxHeight };
}
