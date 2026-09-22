"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { IconPicker } from "./icon-picker";
import { updateNodeIconsAction } from "@/lib/actions/materials";
import { IconPencil, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

export type BulkIconNode = { id: string; name: string; icon: string | null };

/**
 * Смена иконок у нескольких элементов сразу.
 * Два режима: одна иконка на всех и «каждому своя» — во втором
 * после выбора окно само переходит к следующему элементу,
 * чтобы список проставлялся в один проход.
 */
export function BulkIconEditor({
  nodes,
  onClose,
}: {
  nodes: BulkIconNode[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"all" | "each">("all");
  const [oneIcon, setOneIcon] = useState<string | null>(null);
  const [icons, setIcons] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(nodes.map((n) => [n.id, n.icon])),
  );
  const [activeId, setActiveId] = useState<string>(nodes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  if (nodes.length === 0) return null;

  const changed = nodes.filter((n) => icons[n.id] && icons[n.id] !== n.icon);
  const entries =
    tab === "all"
      ? oneIcon
        ? nodes.map((n) => ({ id: n.id, icon: oneIcon }))
        : []
      : changed.map((n) => ({ id: n.id, icon: icons[n.id]! }));

  function pickForActive(icon: string) {
    setIcons((prev) => ({ ...prev, [activeId]: icon }));
    // Сразу переходим к следующему — так список проставляется в один проход.
    const i = nodes.findIndex((n) => n.id === activeId);
    const next = nodes[i + 1];
    if (next) setActiveId(next.id);
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateNodeIconsAction(entries);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  const tabCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl border p-3 text-left transition",
      active ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2",
    );

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Иконки: ${nodes.length} элементов`}
      icon={<IconPencil className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("all")} className={tabCls(tab === "all")}>
            <span className="block text-sm font-semibold text-content">Одна на всех</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              выбранная иконка встанет всем
            </span>
          </button>
          <button type="button" onClick={() => setTab("each")} className={tabCls(tab === "each")}>
            <span className="block text-sm font-semibold text-content">Каждому своя</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              выбрал — переходит к следующему
            </span>
          </button>
        </div>

        {/* Список выбранного: в режиме «каждому своя» он же и переключатель. */}
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-surface-2 p-2.5">
          {nodes.map((n) => {
            const shown = tab === "all" ? oneIcon ?? n.icon : icons[n.id];
            const isActive = tab === "each" && n.id === activeId;
            return (
              <button
                key={n.id}
                type="button"
                disabled={tab === "all"}
                onClick={() => setActiveId(n.id)}
                className={cn(
                  "flex max-w-[180px] items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition",
                  isActive
                    ? "bg-accent text-white"
                    : "bg-surface text-content ring-1 ring-line",
                  tab === "all" ? "cursor-default" : "hover:opacity-80",
                )}
              >
                <span className="text-sm leading-none">{shown ?? "—"}</span>
                <span className="truncate">{n.name}</span>
              </button>
            );
          })}
        </div>

        {tab === "each" && (
          <p className="text-[11px] text-faint">
            Сейчас настраивается:{" "}
            <span className="font-semibold text-content">
              {nodes.find((n) => n.id === activeId)?.name}
            </span>
          </p>
        )}

        <IconPicker
          value={tab === "all" ? oneIcon : icons[activeId] ?? null}
          onChange={(icon) => (tab === "all" ? setOneIcon(icon) : pickForActive(icon))}
        />

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
            disabled={saving || entries.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              "Сохраняю…"
            ) : (
              <>
                <IconCheck className="h-4 w-4" /> Применить ({entries.length})
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
