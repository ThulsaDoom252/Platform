export type TwisterDrawTool = "pencil" | "brush" | "marker";

export type TwisterPoint = {
  /** Координаты нормализованы к 0…1000, поэтому рисунок совпадает на разных экранах. */
  x: number;
  y: number;
};

export type TwisterStroke = {
  id: string;
  twisterId: string;
  author: "TEACHER" | "STUDENT";
  tool: TwisterDrawTool;
  color: string;
  points: TwisterPoint[];
};

export type TwisterDrawingSession = {
  id: string;
  twisterId: string;
  strokes: TwisterStroke[];
  studentDrawingAllowed: boolean;
};

const TOOLS = new Set<TwisterDrawTool>(["pencil", "brush", "marker"]);
const COLORS = new Set([
  "#facc15",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#111827",
  "#ffffff",
]);

export function sanitizeTwisterStroke(
  input: unknown,
  author: "TEACHER" | "STUDENT",
): TwisterStroke | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<TwisterStroke>;
  const id = String(raw.id ?? "").slice(0, 80);
  const twisterId = String(raw.twisterId ?? "").slice(0, 80);
  const tool = TOOLS.has(raw.tool as TwisterDrawTool)
    ? (raw.tool as TwisterDrawTool)
    : "marker";
  const color = COLORS.has(String(raw.color)) ? String(raw.color) : "#facc15";
  const points = Array.isArray(raw.points)
    ? raw.points.slice(0, 800).flatMap((point) => {
        if (!point || typeof point !== "object") return [];
        const x = Math.min(1000, Math.max(0, Number((point as TwisterPoint).x)));
        const y = Math.min(1000, Math.max(0, Number((point as TwisterPoint).y)));
        return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
      })
    : [];
  if (!id || !twisterId || points.length < 2) return null;
  return { id, twisterId, author, tool, color, points };
}

export function strokeStyle(tool: TwisterDrawTool) {
  if (tool === "pencil") return { width: 3, opacity: 0.95 };
  if (tool === "brush") return { width: 10, opacity: 0.9 };
  return { width: 24, opacity: 0.35 };
}
