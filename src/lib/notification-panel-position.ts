/** A portalled panel cannot inherit the sidebar's scroll/clip boundary. */
export function notificationPanelPosition(
  anchor: { right: number; bottom: number },
  viewport: { width: number; height: number },
) {
  const width = Math.max(1, Math.min(340, viewport.width - 24));
  const left = Math.max(12, Math.min(viewport.width >= 1024 ? anchor.right + 8 : 12, viewport.width - width - 12));
  const top = Math.max(12, Math.min(anchor.bottom + 8, Math.max(12, viewport.height - 156)));
  return { left, top, width, maxHeight: Math.max(1, Math.min(480, viewport.height - top - 12)) };
}
