"use client";

/**
 * Правка картинки словаря прямо на странице.
 *
 * Учитель жмёт на картинку — открывается это окно. Масштаб меняет только
 * то, как она показана, и откатывается одним щелчком. Обрезка и поворот
 * меняют саму картинку: результат собирается в браузере и уходит на
 * сервер как новый файл, поэтому прежний вид уже не вернуть — об этом
 * сказано прямо в окне.
 */
import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import {
  setVocabularyImageScaleAction,
  updateVocabularyCoverAction,
} from "@/lib/actions/materials";
import { IconCheck, IconTrash, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

type Mode = "scale" | "crop";

/** Рамка обрезки в долях от картинки. */
type Rect = { x: number; y: number; w: number; h: number };

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function ImageEditor({
  nodeId,
  imageUrl,
  scale,
  maxScale,
  onClose,
  onDone,
}: {
  nodeId: string;
  imageUrl: string;
  scale: number;
  /** Выше этого увеличивать нечего: обложка и так во всю ширину. */
  maxScale: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("scale");
  const [draft, setDraft] = useState(scale);
  const [rect, setRect] = useState<Rect>(FULL);
  const [turn, setTurn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: string; startX: number; startY: number; from: Rect } | null>(null);

  /** Двигаем угол рамки: считаем в долях, чтобы не зависеть от размера окна. */
  function onPointerDown(corner: string, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    drag.current = { corner, startX: event.clientX, startY: event.clientY, from: rect };
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    const box = boxRef.current;
    if (!state || !box) return;

    const bounds = box.getBoundingClientRect();
    const dx = (event.clientX - state.startX) / bounds.width;
    const dy = (event.clientY - state.startY) / bounds.height;
    const from = state.from;
    const min = 0.08;

    const next: Rect = { ...from };
    if (state.corner === "move") {
      next.x = clamp01(Math.min(from.x + dx, 1 - from.w));
      next.y = clamp01(Math.min(from.y + dy, 1 - from.h));
    } else {
      if (state.corner.includes("w")) {
        const x = clamp01(Math.min(from.x + dx, from.x + from.w - min));
        next.w = from.w + (from.x - x);
        next.x = x;
      }
      if (state.corner.includes("e")) {
        next.w = Math.max(min, Math.min(1 - from.x, from.w + dx));
      }
      if (state.corner.includes("n")) {
        const y = clamp01(Math.min(from.y + dy, from.y + from.h - min));
        next.h = from.h + (from.y - y);
        next.y = y;
      }
      if (state.corner.includes("s")) {
        next.h = Math.max(min, Math.min(1 - from.y, from.h + dy));
      }
    }
    setRect(next);
  }

  function onPointerUp() {
    drag.current = null;
  }

  function saveScale() {
    setError(null);
    startBusy(async () => {
      const res = await setVocabularyImageScaleAction(nodeId, draft);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Размер сохранён");
      onClose();
    });
  }

  /** Собрать обрезанную и повёрнутую картинку и отправить её как новую. */
  function applyPixels() {
    const img = imgRef.current;
    if (!img) return;
    setError(null);

    const sx = Math.round(rect.x * img.naturalWidth);
    const sy = Math.round(rect.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));

    const canvas = document.createElement("canvas");
    const quarter = ((turn % 4) + 4) % 4;
    const swapped = quarter % 2 === 1;
    canvas.width = swapped ? sh : sw;
    canvas.height = swapped ? sw : sh;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Браузер не дал обработать картинку");
      return;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((quarter * Math.PI) / 2);
    ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);

    startBusy(async () => {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92),
      );
      if (!blob) {
        setError("Не удалось собрать картинку");
        return;
      }

      const data = new FormData();
      data.set("coverImage", new File([blob], "cover.webp", { type: "image/webp" }));
      const res = await updateVocabularyCoverAction(nodeId, {}, data);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Картинка обновлена");
      onClose();
    });
  }

  function replaceWith(file: File) {
    setError(null);
    startBusy(async () => {
      const data = new FormData();
      data.set("coverImage", file);
      const res = await updateVocabularyCoverAction(nodeId, {}, data);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Картинка заменена");
      onClose();
    });
  }

  function remove() {
    if (!confirm("Убрать картинку со страницы?")) return;
    setError(null);
    startBusy(async () => {
      const data = new FormData();
      data.set("removeCover", "on");
      const res = await updateVocabularyCoverAction(nodeId, {}, data);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Картинка убрана");
      onClose();
    });
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "h-9 rounded-xl px-3.5 text-sm font-semibold transition",
        mode === value ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content",
      )}
    >
      {label}
    </button>
  );

  const handle = (corner: string, className: string) => (
    <span
      onPointerDown={(e) => onPointerDown(corner, e)}
      className={cn(
        "absolute h-4 w-4 rounded-full border-2 border-white bg-accent shadow",
        className,
      )}
    />
  );

  return (
    <Modal open onClose={onClose} wide title="Картинка словаря">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {tab("scale", "Размер")}
          {tab("crop", "Обрезать и повернуть")}

          <label className="ml-auto flex h-9 cursor-pointer items-center rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent">
            Заменить
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) replaceWith(file);
              }}
            />
          </label>

          <button
            type="button"
            onClick={remove}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-rose-400 hover:text-rose-500"
          >
            <IconTrash className="h-4 w-4" /> Убрать
          </button>
        </div>

        {/* Картинка с рамкой обрезки */}
        <div
          ref={boxRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto max-h-[52vh] w-full touch-none overflow-hidden rounded-xl bg-surface-2"
          style={mode === "scale" ? { width: `${draft}%` } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Картинка словаря"
            style={{ transform: `rotate(${turn * 90}deg)` }}
            className="block max-h-[52vh] w-full object-contain"
          />

          {mode === "crop" && (
            <>
              {/* Затемняем всё, кроме выбранного куска. */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.x * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${(rect.x + rect.w) * 100}% ${rect.y * 100}%, ${rect.x * 100}% ${rect.y * 100}%)`,
                }}
              />
              <div
                onPointerDown={(e) => onPointerDown("move", e)}
                className="absolute cursor-move ring-2 ring-accent"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
              >
                {handle("nw", "-left-2 -top-2 cursor-nwse-resize")}
                {handle("ne", "-right-2 -top-2 cursor-nesw-resize")}
                {handle("sw", "-bottom-2 -left-2 cursor-nesw-resize")}
                {handle("se", "-bottom-2 -right-2 cursor-nwse-resize")}
              </div>
            </>
          )}
        </div>

        {mode === "scale" && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="range"
              min={30}
              max={maxScale}
              step={5}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="h-2 min-w-[200px] flex-1 accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-sm font-bold text-content">
              {draft}%
            </span>
            <button
              type="button"
              onClick={() => setDraft(100)}
              disabled={draft === 100}
              className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Обычный
            </button>
            <button
              type="button"
              onClick={saveScale}
              disabled={busy}
              className="h-9 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </div>
        )}

        {mode === "crop" && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTurn((v) => v + 1)}
              className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              ↻ Повернуть
            </button>
            <button
              type="button"
              onClick={() => {
                setRect(FULL);
                setTurn(0);
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              <IconX className="h-4 w-4" /> Сбросить рамку
            </button>
            <span className="text-[12px] text-faint">
              Обрезка меняет сам файл — вернуть прежнюю картинку будет нельзя.
            </span>
            <button
              type="button"
              onClick={applyPixels}
              disabled={busy}
              className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <IconCheck className="h-4 w-4" />
              {busy ? "Сохраняю…" : "Применить"}
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>
        )}
      </div>
    </Modal>
  );
}
