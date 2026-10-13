"use client";
import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconGrip, IconX } from "@/components/icons";
import { useT } from "@/components/i18n-provider";
import { useAppView } from "@/components/app-view-provider";
import { clampHighlightPanelPosition, initialHighlightPanelPosition, type HighlightPanelPoint } from "@/lib/highlight-panel-position";
import { cn } from "@/lib/utils";
import type { HighlightTools } from "./highlight-tools";

/** One controller per highlight scope; its launcher portals into the teacher's class utility bar. */
export function FloatingHighlightToolbar({ tools, liveClass = false, children }: { tools: HighlightTools; liveClass?: boolean; children: ReactNode }) {
  const { t } = useT();
  const { view } = useAppView();
  const id = useId();
  const [target, setTarget] = useState<HTMLElement | null | undefined>(undefined);
  const [position, setPosition] = useState<HighlightPanelPoint | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const positionRef = useRef<HighlightPanelPoint | null>(null);
  const drag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    // The parent class utility bar is committed before child effects, including lazy lesson mounts.
    const frame = requestAnimationFrame(() => setTarget(liveClass ? document.querySelector<HTMLElement>("[data-class-highlight-launcher]") : null));
    return () => cancelAnimationFrame(frame);
  }, [liveClass]);

  const bounds = () => {
    const header = document.querySelector<HTMLElement>("[data-classic-header]");
    const headerBottom = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect().bottom : 0;
    return {
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
      top: Math.max(12, headerBottom + 12),
      bottom: target?.closest(".class-utility-bar")?.getBoundingClientRect().top ?? launcher.current?.getBoundingClientRect().top ?? window.innerHeight - 72,
    };
  };
  const moveTo = (next: HighlightPanelPoint) => {
    if (next.x === positionRef.current?.x && next.y === positionRef.current?.y) return;
    positionRef.current = next; setPosition(next);
  };
  const initialPosition = (size: { width: number; height: number }) => {
    const limits = bounds();
    return initialHighlightPanelPosition(limits, size, limits.top - 12);
  };
  useEffect(() => {
    if (!tools.enabled || target === undefined) return;
    const keepOnScreen = () => {
      const box = panel.current?.getBoundingClientRect(); if (!box) return;
      const next = positionRef.current
        ? clampHighlightPanelPosition(positionRef.current, bounds(), box)
        : initialPosition(box);
      moveTo(next);
    };
    const frame = requestAnimationFrame(keepOnScreen);
    const observer = new ResizeObserver(keepOnScreen); if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", keepOnScreen);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", keepOnScreen); drag.current = null; };
    // Recalculate when view geometry changes, not on every pointer-move render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.enabled, target, view]);

  if (target === undefined) return null;
  const close = () => { if (tools.enabled) tools.toggle(); launcher.current?.focus({ preventScroll: true }); };
  const stopDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <>
    {createPortal(<button ref={launcher} type="button" data-highlight-controls data-highlight-launcher
      aria-label={t.interactiveHomework.highlightToggle} title={t.interactiveHomework.highlightToggle}
      aria-pressed={tools.enabled} aria-expanded={tools.enabled} aria-controls={tools.enabled ? id : undefined}
      onClick={tools.toggle}
      className={cn("flex h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
        tools.enabled ? "bg-accent text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-content",
        !target && "fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-30 border border-line shadow-lg lg:bottom-4")}>
      <span aria-hidden>🖍️</span><span className={target ? "hidden sm:inline" : undefined}>{t.interactiveHomework.highlightToggle}</span>
    </button>, target ?? document.body)}
    {tools.enabled && createPortal(<div ref={panel} id={id} role="toolbar" aria-label={t.lessonUnits.highlightMode}
      data-floating-highlight-panel data-highlight-controls data-no-lesson-highlight
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}
      className="fixed z-30 flex w-max max-h-[calc(100dvh-24px)] max-w-[calc(100%-24px)] flex-wrap items-center gap-2 overflow-y-auto rounded-2xl border border-line bg-surface p-2.5 shadow-xl"
      style={position ? { left: position.x, top: position.y } : { right: 12, top: view === "UPDATED" ? 12 : 88 }}>
      <button type="button" data-highlight-drag-handle aria-label={t.lessonUnits.highlightMoveHint} title={t.lessonUnits.highlightMoveHint}
        className="flex h-11 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-content active:cursor-grabbing"
        onPointerDown={event => {
          if (event.button !== 0) return;
          const box = panel.current?.getBoundingClientRect(); if (!box) return;
          event.preventDefault(); positionRef.current = { x: box.left, y: box.top };
          drag.current = { pointerId: event.pointerId, offsetX: event.clientX - box.left, offsetY: event.clientY - box.top };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const active = drag.current, box = panel.current?.getBoundingClientRect();
          if (!active || active.pointerId !== event.pointerId || !box) return;
          moveTo(clampHighlightPanelPosition({ x: event.clientX - active.offsetX, y: event.clientY - active.offsetY }, bounds(), box));
        }}
        onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => {
          const box = panel.current?.getBoundingClientRect(); if (!box) return;
          const step = event.shiftKey ? 32 : 8, current = { x: box.left, y: box.top };
          const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[event.key];
          if (!delta && event.key !== "Home") return;
          event.preventDefault();
          moveTo(delta ? clampHighlightPanelPosition({ x: current.x + delta[0], y: current.y + delta[1] }, bounds(), box) : initialPosition(box));
        }}><IconGrip className="h-5 w-5" /></button>
      {children}
      <button type="button" onClick={close} aria-label={t.common.close} title={t.common.close}
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-content"><IconX className="h-5 w-5" /></button>
    </div>, document.body)}
  </>;
}
