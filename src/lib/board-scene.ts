/** Безопасный формат сцены доски, которая проходит через сервер. */

export type BoardObject = Record<string, unknown> & {
  id: number;
  type: "text" | "rect" | "ellipse" | "line" | "arrow" | "pen" | "image";
};

export type BoardScene = {
  version: 1;
  name: string;
  objects: BoardObject[];
};

const TYPES = new Set<BoardObject["type"]>([
  "text",
  "rect",
  "ellipse",
  "line",
  "arrow",
  "pen",
  "image",
]);
const FONTS = new Set([
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
]);
const MAX_OBJECTS = 2_000;
const MAX_POINTS = 25_000;
const MAX_SCENE_BYTES = 10 * 1024 * 1024;

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const number = (value: unknown, fallback = 0, min = -1_000_000, max = 1_000_000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const color = (value: unknown, fallback: string) => {
  const text = String(value ?? "").trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent|none)$/i.test(text)
    ? text.slice(0, 64)
    : fallback;
};

function sanitizeObject(value: unknown, fallbackId: number): BoardObject | null {
  if (!record(value) || !TYPES.has(value.type as BoardObject["type"])) return null;
  const type = value.type as BoardObject["type"];
  const base: BoardObject = {
    id: Math.max(1, Math.trunc(number(value.id, fallbackId, 1, 2_000_000_000))),
    type,
  };
  const stroke = {
    color: color(value.color, "#111111"),
    lw: number(value.lw, 2, 0, 80),
  };

  if (type === "text") {
    return {
      ...base,
      x: number(value.x),
      y: number(value.y),
      text: String(value.text ?? "").slice(0, 20_000),
      color: color(value.color, "#111111"),
      size: number(value.size, 16, 4, 400),
      font: FONTS.has(String(value.font)) ? String(value.font) : "Arial",
      bold: value.bold === true,
      italic: value.italic === true,
      underline: value.underline === true,
      strike: value.strike === true,
    };
  }
  if (type === "rect" || type === "ellipse") {
    return {
      ...base,
      x: number(value.x),
      y: number(value.y),
      w: number(value.w),
      h: number(value.h),
      ...stroke,
      fill: color(value.fill, "none"),
    };
  }
  if (type === "line" || type === "arrow") {
    return {
      ...base,
      x1: number(value.x1),
      y1: number(value.y1),
      x2: number(value.x2),
      y2: number(value.y2),
      ...stroke,
    };
  }
  if (type === "pen") {
    const points = Array.isArray(value.pts)
      ? value.pts.slice(0, MAX_POINTS).flatMap((point) =>
          Array.isArray(point) && point.length >= 2
            ? [[number(point[0]), number(point[1])]]
            : [],
        )
      : [];
    if (points.length < 2) return null;
    return { ...base, pts: points, ...stroke };
  }

  const source = String(value._imgSrc ?? "");
  if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)) {
    return null;
  }
  return {
    ...base,
    x: number(value.x),
    y: number(value.y),
    w: number(value.w, 1, 1),
    h: number(value.h, 1, 1),
    _imgSrc: source,
  };
}
export function sanitizeBoardScene(value: unknown): BoardScene | null {
  if (!record(value) || !Array.isArray(value.objects)) return null;
  let rawSize = 0;
  try {
    rawSize = Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
  if (rawSize > MAX_SCENE_BYTES || value.objects.length > MAX_OBJECTS) return null;

  const objects = value.objects.flatMap((item, index) => {
    const object = sanitizeObject(item, index + 1);
    return object ? [object] : [];
  });
  return {
    version: 1,
    name: String(value.name ?? "whiteboard").trim().slice(0, 160) || "whiteboard",
    objects,
  };
}
