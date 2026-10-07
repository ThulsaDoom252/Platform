/** Reveal every collapsed bonus ancestor before the caller scrolls to the target. */
export function revealHomeworkFocusTarget(root: ParentNode, focusId: string) {
  const target = [...root.querySelectorAll<HTMLElement>("[data-homework-focus]")]
    .find((node) => node.dataset.homeworkFocus === focusId);
  if (!target) return null;
  let details = target.closest("details");
  while (details) {
    details.open = true;
    details = details.parentElement?.closest("details") ?? null;
  }
  return target;
}
