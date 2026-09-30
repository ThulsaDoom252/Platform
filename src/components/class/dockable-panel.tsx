"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { IconGrip } from "@/components/icons";
import { cn } from "@/lib/utils";

export type ClassUtilityPanel = "dictionary" | "chat" | "verbs";

export type ClassPanelPlacement = {
  floating: boolean;
  x: number;
  y: number;
};

export const DEFAULT_CLASS_PANEL_LAYOUT: Record<ClassUtilityPanel, ClassPanelPlacement> = {
  dictionary: { floating: false, x: 16, y: 88 },
  chat: { floating: false, x: 760, y: 88 },
  verbs: { floating: false, x: 760, y: 528 },
};

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Старые или повреждённые настройки не могут утащить окно за экран. */
export function normalizeClassPanelPlacement(
  value: Partial<ClassPanelPlacement> | null | undefined,
  fallback: ClassPanelPlacement,
): ClassPanelPlacement {
  return {
    floating: value?.floating === true,
    x: Math.max(12, finite(value?.x, fallback.x)),
    y: Math.max(12, finite(value?.y, fallback.y)),
  };
}

export function DockablePanel({
  title,
  placement,
  dockedClassName,
  floatingHeight,
  detachLabel,
  dockLabel,
  onDetach,
  onDock,
  onMove,
  children,
}: {
  title: string;
  placement: ClassPanelPlacement;
  dockedClassName: string;
  floatingHeight: number;
  detachLabel: string;
  dockLabel: string;
  onDetach: () => void;
  onDock: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const onMoveRef = useRef(onMove);
  const drag = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
  } | null>(null);
  const [position, setPosition] = useState({ x: placement.x, y: placement.y });
  const positionRef = useRef(position);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (drag.current) return;
    const next = { x: placement.x, y: placement.y };
    positionRef.current = next;
    setPosition(next);
  }, [placement.x, placement.y]);

  useEffect(() => {
    if (!placement.floating) return;
    const keepOnScreen = () => {
      const box = panel.current?.getBoundingClientRect();
      if (!box) return;
      const maxX = Math.max(12, window.innerWidth - box.width - 12);
      const maxY = Math.max(12, window.innerHeight - box.height - 72);
      const current = positionRef.current;
      const next = {
        x: Math.min(maxX, Math.max(12, current.x)),
        y: Math.min(maxY, Math.max(12, current.y)),
      };
      if (next.x === current.x && next.y === current.y) return;
      positionRef.current = next;
      setPosition(next);
      onMoveRef.current(next.x, next.y);
    };
    const frame = requestAnimationFrame(keepOnScreen);
    window.addEventListener("resize", keepOnScreen);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepOnScreen);
    };
  }, [floatingHeight, placement.floating]);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const box = panel.current?.getBoundingClientRect();
    const width = box?.width ?? 360;
    const height = box?.height ?? floatingHeight;
    const maxX = Math.max(12, window.innerWidth - width - 12);
    // Нижняя панель класса остаётся доступной даже у перемещённого окна.
    const maxY = Math.max(12, window.innerHeight - height - 72);
    const x = Math.min(maxX, Math.max(12, event.clientX - active.offsetX));
    const y = Math.min(maxY, Math.max(12, event.clientY - active.offsetY));
    active.x = x;
    active.y = y;
    positionRef.current = { x, y };
    setPosition(positionRef.current);
  };

  const stop = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onMove(active.x, active.y);
  };

  return (
    <section
      ref={panel}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line",
        placement.floating
          ? "fixed z-[60] w-[min(360px,calc(100vw-24px))] shadow-2xl ring-2 ring-accent/30"
          : dockedClassName,
      )}
      style={
        placement.floating
          ? {
              left: position.x,
              top: position.y,
              height: floatingHeight,
              maxHeight: "calc(100dvh - 7rem)",
            }
          : undefined
      }
    >
      <header
        onPointerDown={(event) => {
          if (!placement.floating || event.button !== 0) return;
          drag.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - position.x,
            offsetY: event.clientY - position.y,
            x: position.x,
            y: position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onDoubleClick={() => placement.floating && onDock()}
        className={cn(
          "flex h-10 shrink-0 select-none items-center gap-2 border-b border-line px-3",
          placement.floating && "touch-none cursor-move",
        )}
      >
        {placement.floating && <IconGrip className="h-4 w-4 shrink-0 text-faint" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-content">
          {title}
        </span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={placement.floating ? onDock : onDetach}
          title={placement.floating ? dockLabel : detachLabel}
          aria-label={placement.floating ? dockLabel : detachLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base font-bold text-muted transition hover:bg-surface-2 hover:text-accent"
        >
          {placement.floating ? "↩" : "↗"}
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
