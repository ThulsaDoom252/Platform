"use client";
import { useEffect, type RefObject } from "react";
let locks = 0;
let previousOverflow = "";
export function trapModalTab(event: KeyboardEvent, element: HTMLElement | null) {
  if (event.key !== "Tab" || !element) return;
  const nodes = Array.from(
    element.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
    ),
  ).filter((node) => node.getClientRects().length > 0);
  const first = nodes[0],
    last = nodes.at(-1);
  if (!first) {
    event.preventDefault();
    element.focus();
    return;
  }
  if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) {
    event.preventDefault();
    last!.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}
/** Nested search/drawer overlays share the lock and restore the original body style. */
export function useModalLayer(enabled: boolean, ref: RefObject<HTMLElement | null>, close: () => void, priority = 1) {
  useEffect(() => {
    if (!enabled) return;
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("a[href],button:not([disabled]),input")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (
        Array.from(document.querySelectorAll<HTMLElement>("[data-modal-layer]")).some(
          (layer) => Number(layer.dataset.modalLayer) > priority,
        )
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else trapModalTab(event, ref.current);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (--locks === 0) document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [enabled, ref, close, priority]);
}
