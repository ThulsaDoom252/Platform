"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import { createNodesAction } from "@/lib/actions/materials";
import { IconPlus, IconX } from "@/components/icons";
import type { TreeScope } from "./node-editor";
import { suggestIcon } from "@/lib/icon-suggest";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export type CreateTarget = {
  parentId: string | null;
  kind: "FOLDER" | "PAGE";
  scope?: TreeScope;
  ownerId?: string;
};

/** `auto` — иконку подставили по названию, её можно молча заменить. */
type Row = { key: string; name: string; icon: string | null; auto: boolean };

/**
 * Создание папок и страниц списком: сколько угодно за раз.
 * Иконку можно поставить одну на всех либо каждой строке свою —
 * во втором режиме выбор сам переходит к следующей строке.
 */
export function NodeCreator({
  target,
  onClose,
}: {
  target: CreateTarget | null;
  onClose: () => void;
}) {
  const isPage = target?.kind === "PAGE";
  const defaultIcon = isPage ? "📄" : "📁";

  const nextKey = useRef(1);
  const makeRow = (): Row => ({
    key: `r${nextKey.current++}`,
    name: "",
    icon: defaultIcon,
    auto: true,
  });

  const [rows, setRows] = useState<Row[]>(() => [makeRow()]);
  const [tab, setTab] = useState<"all" | "each">("all");
  const [oneIcon, setOneIcon] = useState<string | null>(defaultIcon);
  /** Общую иконку тоже подбираем, пока её не выбрали руками. */
  const [oneAuto, setOneAuto] = useState(true);
  const [activeKey, setActiveKey] = useState<string>(() => rows[0]?.key ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Фокус ставим после отрисовки строки, иначе поля ещё нет в DOM.
  useEffect(() => {
    if (!focusKey) return;
    inputs.current[focusKey]?.focus();
    setFocusKey(null);
  }, [focusKey]);

  if (!target) return null;

  const filled = rows.filter((r) => r.name.trim());

  function addRow(after?: string) {
    const row = makeRow();
    setRows((prev) => {
      if (!after) return [...prev, row];
      const i = prev.findIndex((r) => r.key === after);
      const next = [...prev];
      next.splice(i + 1, 0, row);
      return next;
    });
    setActiveKey(row.key);
    setFocusKey(row.key);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function setName(key: string, name: string) {
    if (oneAuto) setOneIcon(suggestIcon(name) ?? defaultIcon);
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        // Пока иконку не выбрали руками, подбираем её по названию.
        if (!r.auto) return { ...r, name };
        return { ...r, name, icon: suggestIcon(name) ?? defaultIcon };
      }),
    );
  }

  function pickIcon(icon: string) {
    if (tab === "all") {
      setOneIcon(icon);
      setOneAuto(false);
      return;
    }
    // Выбрали руками — автоподбор для этой строки больше не вмешивается.
    setRows((prev) =>
      prev.map((r) => (r.key === activeKey ? { ...r, icon, auto: false } : r)),
    );
    const i = rows.findIndex((r) => r.key === activeKey);
    const next = rows[i + 1];
    if (next) setActiveKey(next.key);
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await createNodesAction(
        filled.map((r, i) => ({
          name: r.name.trim(),
          icon: tab === "all" ? oneIcon : r.icon,
          // Подзаголовок имеет смысл, только когда создаём одну страницу.
          description: isPage && filled.length === 1 && i === 0 ? description.trim() : null,
        })),
        {
          parentId: target!.parentId,
          kind: target!.kind,
          scope: target!.scope,
          ownerId: target!.ownerId ?? null,
        },
      );
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl border p-2.5 text-left transition",
      active ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
    );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={isPage ? "Новые страницы" : "Новые папки"}
      icon={<IconPlus className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("all")} className={tabCls(tab === "all")}>
            <span className="block text-sm font-semibold text-content">Одна иконка на всех</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("each");
              // Начинаем с первой строки: пока набирали названия,
              // активной оставалась последняя добавленная.
              if (rows[0]) setActiveKey(rows[0].key);
            }}
            className={tabCls(tab === "each")}
          >
            <span className="block text-sm font-semibold text-content">Каждой своя</span>
          </button>
        </div>

        {/* Строки будущих элементов */}
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const shown = tab === "all" ? oneIcon : r.icon;
            const isActive = tab === "each" && r.key === activeKey;
            return (
              <div key={r.key} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tab === "all"}
                  onClick={() => setActiveKey(r.key)}
                  title={tab === "all" ? "Иконка общая для всех" : "Настроить иконку этой строки"}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition",
                    isActive
                      ? "bg-accent-soft ring-2 ring-accent"
                      : "bg-surface-2 ring-1 ring-line",
                    tab === "all" ? "cursor-default" : "hover:opacity-80",
                  )}
                >
                  {shown ?? "—"}
                </button>

                <input
                  ref={(el) => {
                    inputs.current[r.key] = el;
                  }}
                  value={r.name}
                  onChange={(e) => setName(r.key, e.target.value)}
                  onFocus={() => tab === "each" && setActiveKey(r.key)}
                  onKeyDown={(e) => {
                    // Enter добавляет следующую строку — так список набивается подряд.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (r.name.trim()) addRow(r.key);
                    }
                  }}
                  autoFocus={i === 0}
                  placeholder={isPage ? "Например: Sport" : "Например: Vocabulary"}
                  className={inputCls}
                />

                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  disabled={rows.length === 1}
                  title="Убрать строку"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content disabled:opacity-30"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => addRow()}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          >
            <IconPlus className="h-4 w-4" /> Добавить ещё
          </button>
        </div>

        {isPage && rows.length === 1 && (
          <div>
            <label className="text-sm font-medium text-content">Подзаголовок</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Короткое описание страницы"
              className={`${inputCls} mt-1.5`}
            />
          </div>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-content">
            {tab === "all" ? "Иконка для всех" : "Иконка выбранной строки"}
          </p>
          <IconPicker
            value={tab === "all" ? oneIcon : rows.find((r) => r.key === activeKey)?.icon ?? null}
            onChange={pickIcon}
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || filled.length === 0}
            className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Создаю…" : `Создать (${filled.length})`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
