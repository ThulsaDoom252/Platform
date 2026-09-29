"use client";

/**
 * Доска в классе — во весь экран.
 *
 * Сама доска — отдельная страница в public/whiteboard.html: тысяча строк
 * работы с canvas, собственные горячие клавиши и свой цикл отрисовки.
 * Внутри iframe она получает настоящее окно — position:fixed, innerWidth
 * и события клавиатуры работают так, как она их писала, — и при этом не
 * лезет своими стилями и обработчиками в остальную страницу.
 *
 * На четверти экрана рисовать нечем, поэтому доска перекрывает всё:
 * когда она открыта, урок идёт на ней.
 *
 * Роль передаётся адресом: у ученика панель инструментов скрыта.
 *
 * Доска пока живёт в памяти браузера каждого: общего холста на двоих
 * ещё нет, и то, что рисует учитель, у ученика не появляется.
 */
import { useEffect } from "react";
import { useT } from "@/components/i18n-provider";
import { IconX } from "@/components/icons";

export function ClassBoard({
  teacher,
  onClose,
}: {
  teacher: boolean;
  onClose: () => void;
}) {
  const { t } = useT();

  // Escape закрывает доску: искать крестик посреди урока некогда.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <iframe
        src={`/whiteboard.html?role=${teacher ? "teacher" : "student"}`}
        title={t.classRoom.board}
        className="h-full w-full flex-1 border-0"
      />

      {/*
       * Крестик поверх холста, в углу без инструментов: панель доски
       * стоит сверху по центру, увеличение — справа внизу.
       */}
      <button
        type="button"
        onClick={onClose}
        title={t.common.close}
        aria-label={t.common.close}
        className="absolute right-3 top-3 flex h-10 items-center gap-1.5 rounded-xl bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg ring-1 ring-slate-300 transition hover:text-rose-600"
      >
        <IconX className="h-4 w-4" />
        {t.classRoom.board}
      </button>
    </div>
  );
}
