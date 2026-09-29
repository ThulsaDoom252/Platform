"use client";

/**
 * Доска в классе.
 *
 * Сама доска — отдельная страница в public/whiteboard.html: тысяча строк
 * работы с canvas, собственные горячие клавиши и свой цикл отрисовки.
 * Внутри iframe она получает настоящее окно — position:fixed, innerWidth
 * и события клавиатуры работают так, как она их писала, — и при этом не
 * лезет своими стилями и обработчиками в остальную страницу.
 *
 * Роль передаётся адресом: у ученика панель инструментов скрыта.
 *
 * Доска пока живёт в памяти браузера каждого: общего холста на двоих
 * ещё нет, и то, что рисует учитель, у ученика не появляется.
 */
import { useT } from "@/components/i18n-provider";

export function ClassBoard({
  teacher,
  onClose,
}: {
  teacher: boolean;
  onClose?: () => void;
}) {
  const { t } = useT();

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-sm font-semibold text-content">
          {t.classRoom.board}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-7 rounded-lg px-2 text-[12px] font-semibold text-muted transition hover:bg-surface-2 hover:text-content"
          >
            {t.common.close}
          </button>
        )}
      </div>

      <iframe
        src={`/whiteboard.html?role=${teacher ? "teacher" : "student"}`}
        title={t.classRoom.board}
        /* Своё окно, но без доступа к нашему: доска лежит на том же
           домене только ради простой раздачи файла. */
        className="h-[70vh] min-h-[420px] w-full border-0 bg-white"
      />
    </section>
  );
}
