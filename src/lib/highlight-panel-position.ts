export type HighlightPanelPoint = { x: number; y: number };
export type HighlightPanelBounds = { width: number; height: number; top?: number; bottom?: number };
export type HighlightPanelSize = { width: number; height: number };
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback;

/** Dragging/resizing never strands the controls outside the viewport or over the bottom launcher. */
export function clampHighlightPanelPosition(point: HighlightPanelPoint, bounds: HighlightPanelBounds, size: HighlightPanelSize): HighlightPanelPoint {
  const width = Math.max(24, finite(bounds.width, 1024));
  const height = Math.max(24, finite(bounds.height, 768));
  const bottom = Math.min(height - 12, Math.max(12, finite(bounds.bottom, height - 72)));
  const maxX = Math.max(12, width - Math.max(0, finite(size.width, 440)) - 12);
  const maxY = Math.max(12, bottom - Math.max(0, finite(size.height, 64)) - 12);
  const minY = Math.min(maxY, Math.max(12, finite(bounds.top, 12)));
  return { x: Math.min(maxX, Math.max(12, finite(point.x, maxX))), y: Math.min(maxY, Math.max(minY, finite(point.y, minY))) };
}

export function initialHighlightPanelPosition(bounds: HighlightPanelBounds, size: HighlightPanelSize, headerBottom = 0) {
  return clampHighlightPanelPosition({ x: bounds.width - size.width - 12, y: Math.max(12, finite(headerBottom, 0) + 12) }, bounds, size);
}
