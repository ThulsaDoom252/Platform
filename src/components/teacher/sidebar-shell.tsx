"use client";

/**
 * Боковая панель, которую можно убрать с глаз.
 *
 * В свёрнутом виде от неё остаётся кружок в левом нижнем углу — нажатие
 * возвращает панель обратно. Выбор запоминается в браузере: это привычка
 * учителя, а не свойство данных, и на сервер ему незачем.
 *
 * Всё это касается только широких экранов: на телефоне панели нет вовсе,
 * там своя нижняя навигация.
 */
import { useLocalFlag } from "@/lib/use-local-flag";
import { IconCap, IconChevronLeft } from "@/components/icons";

const KEY = "lingora.sidebar.collapsed";

export function SidebarShell({
  children,
  expandLabel,
  collapseLabel,
}: {
  children: React.ReactNode;
  expandLabel: string;
  collapseLabel: string;
}) {
  const [collapsed, setCollapsed] = useLocalFlag(KEY);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title={expandLabel}
        aria-label={expandLabel}
        /* Сдвинут вправо: в левом нижнем углу в режиме разработки сидит
           значок Next.js, и кружок оказывался прямо под ним. */
        className="fixed bottom-6 left-20 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-1 ring-black/10 transition hover:opacity-90 lg:flex"
      >
        <IconCap className="h-6 w-6" />
      </button>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col gap-6 border-r border-line bg-surface px-5 py-6 lg:flex relative">
      {children}

      <button
        type="button"
        onClick={() => setCollapsed(true)}
        title={collapseLabel}
        aria-label={collapseLabel}
        className="absolute right-3 top-6 flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
      >
        <IconChevronLeft className="h-4 w-4" />
      </button>
    </aside>
  );
}
