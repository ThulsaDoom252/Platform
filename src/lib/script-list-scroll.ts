/** Scroll only the scripts list, never its page or an open lesson editor. */
export function scrollScriptListToToday(list: HTMLElement, today: string): boolean {
  // The list may be hidden behind the editor on a phone; retry when it opens.
  if (list.clientHeight <= 0) return false;
  const day = [...list.querySelectorAll<HTMLElement>("[data-script-day]")]
    .find((element) => element.dataset.scriptDay === today);
  if (!day) return false;
  list.scrollTop = Math.max(0,
    list.scrollTop + day.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientTop,
  );
  return true;
}
