"use client";

/**
 * Просмотр скороговорки во весь экран.
 *
 * Снимок карточки мелким не читается, поэтому фокус — это не украшение,
 * а рабочий режим: на уроке смотрят ровно на одну картинку. Соседние
 * листаются стрелками, чтобы не возвращаться в пул за каждой.
 */
import Image from "next/image";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { IconChevronLeft, IconChevronRight, IconX } from "@/components/icons";
import type { Twister } from "@/lib/actions/tongue-twisters";

export function TwisterViewer({
  items,
  startId,
  onClose,
}: {
  items: Twister[];
  startId: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const [at, setAt] = useState(() => Math.max(0, items.findIndex((i) => i.id === startId)));

  const current = items[at];
  const many = items.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setAt((v) => (v + 1) % items.length);
      if (e.key === "ArrowLeft") setAt((v) => (v - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {current.title || t.twisters.untitled}
        </span>
        {many && (
          <span className="shrink-0 font-mono text-[12px] text-white/60">
            {at + 1} / {items.length}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.twisters.exitFocus}
          title={t.twisters.exitFocus}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-14">
        <Image
          key={current.id}
          src={current.imageUrl}
          alt={current.title ?? t.twisters.untitled}
          fill
          sizes="100vw"
          priority
          className="object-contain p-2"
        />

        {many && (
          <>
            <button
              type="button"
              onClick={() => setAt((v) => (v - 1 + items.length) % items.length)}
              aria-label="←"
              className="absolute left-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-3"
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setAt((v) => (v + 1) % items.length)}
              aria-label="→"
              className="absolute right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-3"
            >
              <IconChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
