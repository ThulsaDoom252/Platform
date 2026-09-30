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
  width: number;
  height: number;
};

export const DEFAULT_CLASS_PANEL_LAYOUT: Record<ClassUtilityPanel, ClassPanelPlacement> = {
  dictionary: { floating: false, x: 16, y: 88, width: 360, height: 620 },
  chat: { floating: false, x: 760, y: 88, width: 360, height: 420 },
  verbs: { floating: false, x: 760, y: 528, width: 360, height: 360 },
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
    width: Math.max(280, finite(value?.width, fallback.width)),
    height: Math.max(220, finite(value?.height, fallback.height)),
  };
}

export function DockablePanel({
  title,
  placement,
  dockedClassName,
  detachLabel,
  dockLabel,
  resizeLabel,
  onDetach,
  onDock,
  onMove,
  onResize,
  children,
}: {
  title: string;
  placement: ClassPanelPlacement;
  dockedClassName: string;
  detachLabel: string;
  dockLabel: string;
  resizeLabel: string;
  onDetach: () => void;
  onDock: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const onMoveRef = useRef(onMove);
  const onResizeRef = useRef(onResize);
  const drag = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
  } | null>(null);
  const resize = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    width: number;
    height: number;
  } | null>(null);
  const [position, setPosition] = useState({ x: placement.x, y: placement.y });
  const [size, setSize] = useState({ width: placement.width, height: placement.height });
  const positionRef = useRef(position);
  const sizeRef = useRef(size);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    if (drag.current) return;
    const next = { x: placement.x, y: placement.y };
    positionRef.current = next;
    setPosition(next);
  }, [placement.x, placement.y]);

  useEffect(() => {
    if (resize.current) return;
    const next = { width: placement.width, height: placement.height };
    sizeRef.current = next;
    setSize(next);
  }, [placement.height, placement.width]);

  useEffect(() => {
    if (!placement.floating) return;
    const keepOnScreen = () => {
      const box = panel.current?.getBoundingClientRect();
      if (!box) return;
      const nextSize = {
        width: Math.min(
          Math.max(280, window.innerWidth - 24),
          Math.max(280, sizeRef.current.width),
        ),
        height: Math.min(
          Math.max(220, window.innerHeight - 84),
          Math.max(220, sizeRef.current.height),
        ),
      };
      const maxX = Math.max(12, window.innerWidth - nextSize.width - 12);
      const maxY = Math.max(12, window.innerHeight - nextSize.height - 72);
      const current = positionRef.current;
      const next = {
        x: Math.min(maxX, Math.max(12, current.x)),
        y: Math.min(maxY, Math.max(12, current.y)),
      };
      if (nextSize.width !== sizeRef.current.width || nextSize.height !== sizeRef.current.height) {
        sizeRef.current = nextSize;
        setSize(nextSize);
        onResizeRef.current(nextSize.width, nextSize.height);
      }
      if (next.x !== current.x || next.y !== current.y) {
        positionRef.current = next;
        setPosition(next);
        onMoveRef.current(next.x, next.y);
      }
    };
    const frame = requestAnimationFrame(keepOnScreen);
    window.addEventListener("resize", keepOnScreen);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", keepOnScreen);
    };
  }, [placement.floating]);

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const box = panel.current?.getBoundingClientRect();
    const width = box?.width ?? size.width;
    const height = box?.height ?? size.height;
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

  const grow = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = resize.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const maxWidth = Math.max(280, window.innerWidth - positionRef.current.x - 12);
    const maxHeight = Math.max(220, window.innerHeight - positionRef.current.y - 72);
    const width = Math.min(maxWidth, Math.max(280, active.startWidth + event.clientX - active.startX));
    const height = Math.min(maxHeight, Math.max(220, active.startHeight + event.clientY - active.startY));
    active.width = width;
    active.height = height;
    sizeRef.current = { width, height };
    setSize(sizeRef.current);
  };

  const stopGrowing = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = resize.current;
    if (!active || active.pointerId !== event.pointerId) return;
    resize.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onResize(active.width, active.height);
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
          ? "fixed z-[60] shadow-2xl ring-2 ring-accent/30"
          : dockedClassName,
      )}
      style={
        placement.floating
          ? {
              left: position.x,
              top: position.y,
              width: size.width,
              height: size.height,
              maxWidth: "calc(100vw - 24px)",
              maxHeight: "calc(100dvh - 84px)",
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
      {placement.floating && (
        <button
          type="button"
          aria-label={resizeLabel}
          title={resizeLabel}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            resize.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              startWidth: sizeRef.current.width,
              startHeight: sizeRef.current.height,
              width: sizeRef.current.width,
              height: sizeRef.current.height,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={grow}
          onPointerUp={stopGrowing}
          onPointerCancel={stopGrowing}
          className="absolute bottom-0 right-0 flex h-8 w-8 touch-none cursor-se-resize items-end justify-end rounded-tl-xl p-1 text-faint transition hover:bg-accent-soft hover:text-accent"
        >
          <IconGrip className="h-4 w-4 -rotate-45" />
        </button>
      )}
    </section>
  );
}
