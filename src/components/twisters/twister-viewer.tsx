"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useT } from "@/components/i18n-provider";
import {
  addTwisterStrokeAction,
  clearTwisterStrokesAction,
  closeTwisterInClassAction,
  focusTwisterInClassAction,
  setStudentTwisterDrawingAction,
  twisterSessionAction,
  undoTwisterStrokeAction,
  type ClassTwisterSession,
  type Twister,
} from "@/lib/actions/tongue-twisters";
import {
  strokeStyle,
  type TwisterDrawTool,
  type TwisterPoint,
  type TwisterStroke,
} from "@/lib/twister-drawing";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
  IconTrash,
  IconUser,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const COLORS = ["#facc15", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#111827", "#ffffff"];
const TOOLS: { id: TwisterDrawTool; symbol: string }[] = [
  { id: "pencil", symbol: "✎" },
  { id: "brush", symbol: "🖌" },
  { id: "marker", symbol: "▰" },
];

type Draft = {
  id: string;
  pointerId: number;
  pointerType: string;
  startedAt: number;
  startX: number;
  startY: number;
  points: TwisterPoint[];
};

export function TwisterViewer({
  items,
  startId,
  teacher = false,
  initialSession = null,
  onClose,
}: {
  items: Twister[];
  startId: string;
  teacher?: boolean;
  initialSession?: ClassTwisterSession | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const [at, setAt] = useState(() => Math.max(0, items.findIndex((i) => i.id === startId)));
  const [tool, setTool] = useState<TwisterDrawTool>("marker");
  const [color, setColor] = useState("#facc15");
  const [localStrokes, setLocalStrokes] = useState<TwisterStroke[]>(initialSession?.strokes ?? []);
  const [session, setSession] = useState<ClassTwisterSession | null>(initialSession);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const closeRef = useRef(onClose);
  const sessionRef = useRef<ClassTwisterSession | null>(initialSession);
  const imageAreaRef = useRef<HTMLDivElement | null>(null);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [drawBox, setDrawBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => () => {
    const active = sessionRef.current;
    if (teacher && active) void closeTwisterInClassAction(active.id);
  }, [teacher]);

  // Ученик получает текущую карточку из общей сессии: так стрелка
  // учителя переключает изображение за один короткий такт, не за общий
  // четырёхсекундный опрос класса.
  const current = !teacher && session ? session.twister : items[at];
  const many = teacher && items.length > 1;
  const author = teacher ? "TEACHER" : "STUDENT";
  const strokes = session?.strokes ?? localStrokes;
  const canDraw = teacher || !session || session.studentDrawingAllowed;

  const go = useCallback(
    (delta: number) => setAt((value) => (value + delta + items.length) % items.length),
    [items.length],
  );

  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    const sync = () => {
      twisterSessionAction()
        .then((next) => {
          if (!alive) return;
          if (!next) {
            setSession(null);
            if (!teacher) closeRef.current();
            return;
          }
          setSession(next);
          if (teacher) {
            const index = items.findIndex((item) => item.id === next.twisterId);
            if (index >= 0) setAt(index);
          }
        })
        .catch(() => {});
    };
    const id = setInterval(sync, 900);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [items, sessionId, teacher]);

  useEffect(() => {
    if (!teacher || !session || !current || session.twisterId === current.id) return;
    let alive = true;
    focusTwisterInClassAction(current.id).then((result) => {
      if (alive && result.session) setSession(result.session);
    });
    return () => {
      alive = false;
    };
  }, [current, session, teacher]);

  const close = useCallback(() => {
    const sharedId = session?.id;
    if (teacher && sharedId) void closeTwisterInClassAction(sharedId);
    closeRef.current();
  }, [session?.id, teacher]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" && items.length > 1) go(1);
      if (event.key === "ArrowLeft" && items.length > 1) go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go, items.length]);

  const shownStrokes = useMemo(
    () => strokes.filter((stroke) => stroke.twisterId === current?.id),
    [current?.id, strokes],
  );

  useEffect(() => {
    const area = imageAreaRef.current;
    if (!area || !imageRatio) return;
    const measure = () => {
      const { width, height } = area.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      if (width / height > imageRatio) {
        const fittedWidth = height * imageRatio;
        setDrawBox({ left: (width - fittedWidth) / 2, top: 0, width: fittedWidth, height });
      } else {
        const fittedHeight = width / imageRatio;
        setDrawBox({ left: 0, top: (height - fittedHeight) / 2, width, height: fittedHeight });
      }
    };
    const first = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => {
      cancelAnimationFrame(first);
      observer.disconnect();
    };
  }, [imageRatio]);

  const pointOf = (event: ReactPointerEvent<SVGSVGElement>): TwisterPoint => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / Math.max(1, box.width)) * 1000,
      y: ((event.clientY - box.top) / Math.max(1, box.height)) * 1000,
    };
  };

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!canDraw || !current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOf(event);
    setDraft({
      id: crypto.randomUUID(),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startedAt: Date.now(),
      startX: event.clientX,
      startY: event.clientY,
      points: [point],
    });
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = pointOf(event);
    setDraft((value) => value && ({ ...value, points: [...value.points, point].slice(-800) }));
  };

  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft || draft.pointerId !== event.pointerId || !current) return;
    const dx = event.clientX - draft.startX;
    const dy = event.clientY - draft.startY;
    const swipe =
      draft.pointerType === "touch" &&
      Date.now() - draft.startedAt < 650 &&
      Math.abs(dx) > 80 &&
      Math.abs(dx) > Math.abs(dy) * 1.4;
    if (swipe && many) {
      go(dx < 0 ? 1 : -1);
      setDraft(null);
      return;
    }

    const next: TwisterStroke = {
      id: draft.id,
      twisterId: current.id,
      author,
      tool,
      color,
      points: draft.points,
    };
    setDraft(null);
    if (next.points.length < 2) return;
    if (session) {
      setSession({ ...session, strokes: [...session.strokes, next] });
      void addTwisterStrokeAction(session.id, next);
    } else {
      setLocalStrokes((value) => [...value, next]);
    }
  };

  const undo = () => {
    const list = [...strokes];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (list[index].author !== author) continue;
      list.splice(index, 1);
      break;
    }
    if (session) {
      setSession({ ...session, strokes: list });
      void undoTwisterStrokeAction(session.id);
    } else {
      setLocalStrokes(list);
    }
  };

  const clear = () => {
    if (session) {
      setSession({ ...session, strokes: [] });
      void clearTwisterStrokesAction(session.id);
    } else {
      setLocalStrokes([]);
    }
  };

  const focusStudent = () => {
    if (!current) return;
    startTransition(async () => {
      const result = await focusTwisterInClassAction(current.id, localStrokes);
      if (result.session) setSession(result.session);
    });
  };

  if (!current) return null;

  const renderStroke = (stroke: TwisterStroke, key = stroke.id) => {
    const style = strokeStyle(stroke.tool);
    return (
      <polyline
        key={key}
        points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={stroke.color}
        strokeWidth={style.width}
        strokeOpacity={style.opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-white sm:px-4">
        <span className="min-w-[8rem] flex-1 truncate text-sm font-semibold">
          {current.title || t.twisters.untitled}
        </span>
        {many && <span className="font-mono text-[12px] text-white/60">{at + 1} / {items.length}</span>}

        {teacher && (
          <button
            type="button"
            disabled={busy}
            onClick={focusStudent}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50",
              session ? "bg-amber-400 text-slate-950" : "bg-white/10 hover:bg-white/20",
            )}
          >
            <IconUser className="h-4 w-4" />
            {session ? t.twisters.studentFocused : t.twisters.focusStudent}
          </button>
        )}

        {teacher && session && (
          <button
            type="button"
            onClick={() => {
              const allowed = !session.studentDrawingAllowed;
              setSession({ ...session, studentDrawingAllowed: allowed });
              void setStudentTwisterDrawingAction(session.id, allowed);
            }}
            className="h-9 rounded-xl bg-white/10 px-3 text-xs font-bold transition hover:bg-white/20"
          >
            {session.studentDrawingAllowed ? t.twisters.lockStudentDrawing : t.twisters.unlockStudentDrawing}
          </button>
        )}

        <button
          type="button"
          onClick={close}
          aria-label={t.twisters.exitFocus}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 border-b border-white/10 px-2 py-2 text-white">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canDraw}
            onClick={() => setTool(item.id)}
            title={t.twisters[item.id]}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-35",
              tool === item.id ? "bg-white text-slate-950" : "bg-white/10 hover:bg-white/20",
            )}
          >
            {item.id === "pencil" ? <IconPencil className="h-4 w-4" /> : item.symbol}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" />
        {COLORS.map((item) => (
          <button
            key={item}
            type="button"
            disabled={!canDraw}
            onClick={() => setColor(item)}
            aria-label={item}
            className={cn(
              "h-7 w-7 rounded-full border-2 transition disabled:opacity-35",
              color === item ? "scale-110 border-white" : "border-white/25",
            )}
            style={{ backgroundColor: item }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" />
        <button type="button" onClick={undo} className="h-9 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20">
          ↶ {t.twisters.undoDrawing}
        </button>
        <button type="button" onClick={clear} className="flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20">
          <IconTrash className="h-3.5 w-3.5" /> {t.twisters.clearDrawing}
        </button>
        {!canDraw && <span className="text-xs font-semibold text-amber-300">{t.twisters.drawingLocked}</span>}
      </div>

      <div ref={imageAreaRef} className="relative flex min-h-0 flex-1 items-center justify-center px-1 pb-2 sm:px-14">
        <Image
          key={current.id}
          src={current.imageUrl}
          alt={current.title ?? t.twisters.untitled}
          fill
          sizes="100vw"
          priority
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setImageRatio(image.naturalWidth / image.naturalHeight);
            }
          }}
          className="pointer-events-none select-none object-contain"
        />
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className={cn("absolute touch-none", canDraw ? "cursor-crosshair" : "cursor-not-allowed")}
          style={drawBox ?? { inset: 0, width: "100%", height: "100%" }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => setDraft(null)}
        >
          {shownStrokes.map((stroke) => renderStroke(stroke))}
          {draft && renderStroke({
            id: draft.id,
            twisterId: current.id,
            author,
            tool,
            color,
            points: draft.points,
          }, "draft")}
        </svg>

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute bottom-3 left-2 z-10 flex h-11 items-center gap-1 rounded-full bg-black/65 px-3 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-black/85 sm:bottom-auto sm:left-3"
            >
              <IconChevronLeft className="h-5 w-5" /> {t.twisters.back}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute bottom-3 right-2 z-10 flex h-11 items-center gap-1 rounded-full bg-black/65 px-3 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-black/85 sm:bottom-auto sm:right-3"
            >
              {t.twisters.next} <IconChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
