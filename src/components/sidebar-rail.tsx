/**
 * Боковая панель: полоса иконок, раскрывающаяся под курсором.
 *
 * Место под полосу занято всегда, а раскрывается она поверх страницы —
 * иначе каждое движение мышью двигало бы всю вёрстку, и текст под
 * курсором уезжал бы из-под него.
 *
 * Раскрытие сделано на :hover без единой строчки скрипта: состояние
 * панели не переживает перезагрузку и никому, кроме курсора, не нужно.
 * focus-within добавлен ради клавиатуры — иначе до пунктов табом не
 * добраться, они за краем.
 *
 * На телефоне панели нет вовсе, там своя нижняя навигация.
 */
const OPEN =
  "hover:w-[272px] hover:shadow-xl focus-within:w-[272px] focus-within:shadow-xl";

/** Что видно только в раскрытой панели: подписи, цитата, карточка. */
export const RAIL_ONLY_OPEN =
  "opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100";

export function SidebarRail({ children }: { children: React.ReactNode }) {
  return (
    // Ширина полосы в потоке не меняется — колонка с контентом стоит на месте.
    <div className="sticky top-0 z-40 hidden h-screen w-20 shrink-0 lg:block">
      <aside
        className={`group/rail absolute left-0 top-0 h-screen w-20 overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-150 ease-out ${OPEN}`}
      >
        {/* Содержимое всегда в полную ширину: при раскрытии оно не
            перевёрстывается, а просто перестаёт обрезаться. */}
        <div className="flex h-full w-[272px] flex-col gap-6 px-4 py-6">
          {children}
        </div>
      </aside>
    </div>
  );
}
