"use client";

/**
 * «Наполнить из» — взять готовую страницу и перенести её содержимое сюда.
 *
 * Источник выбирается в два шага: сначала чьи материалы (общая база, свои
 * или конкретного ученика), затем сама страница. Копия самостоятельная:
 * правки в источнике до неё не доходят.
 */
import { useEffect, useState, useTransition } from "react";
import {
  listCopyTargetsAction,
  fillPageFromAction,
  type CopyTree,
  type CopyNode,
} from "@/lib/actions/materials";
import { IconX, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

export type FillTarget = { id: string; name: string };

/** Страница со своим путём — чтобы одинаковые названия не путались. */
type Choice = { id: string; label: string; path: string };

/** Разворачивает дерево в список страниц с путём до каждой. */
function pages(nodes: CopyNode[]): Choice[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const pathOf = (node: CopyNode): string => {
    const parts: string[] = [];
    let current: CopyNode | undefined = node;
    // Ограничение на случай, если дерево вдруг замкнулось само на себя.
    for (let i = 0; current && i < 12; i++) {
      current = current.parentId ? byId.get(current.parentId) : undefined;
      if (current) parts.unshift(current.name);
    }
    return parts.join(" / ");
  };

  return nodes
    .filter((n) => n.type === "FILE")
    .map((n) => ({ id: n.id, label: `${n.icon ?? ""} ${n.name}`.trim(), path: pathOf(n) }));
}

export function FillFromDialog({
  target,
  onClose,
  onDone,
}: {
  target: FillTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [trees, setTrees] = useState<CopyTree[] | null>(null);
  const [treeKey, setTreeKey] = useState<string>("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!target) return;
    let alive = true;
    listCopyTargetsAction()
      .then((list) => {
        if (!alive) return;
        setTrees(list);
        setTreeKey((prev) => prev || list[0]?.key || "");
      })
      .catch(() => alive && setError("Не удалось загрузить список материалов"));
    return () => {
      alive = false;
    };
  }, [target]);

  if (!target) return null;

  const tree = trees?.find((t) => t.key === treeKey) ?? null;
  const all = tree ? pages(tree.nodes) : [];
  const needle = query.trim().toLowerCase();
  const list = needle
    ? all.filter((p) => `${p.path} ${p.label}`.toLowerCase().includes(needle))
    : all;

  function fill() {
    if (!picked) return;
    setError(null);
    startBusy(async () => {
      const res = await fillPageFromAction(target!.id, picked);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Страница наполнена");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">Наполнить из другой страницы</h2>
            <p className="mt-1 text-sm text-muted">
              Содержимое добавится в «{target.name}». То, что там уже есть,
              останется; точные повторы пропускаются.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {!trees && !error && <p className="mt-4 text-sm text-faint">Загружаю…</p>}

        {trees && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {trees.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTreeKey(t.key);
                    setPicked(null);
                  }}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[12px] font-semibold transition",
                    t.key === treeKey
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-muted hover:text-content",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="relative mt-3 flex items-center">
              <IconSearch className="absolute left-3 h-4 w-4 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию или папке…"
                className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
              />
            </label>

            <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl bg-surface-2 p-1.5">
              {list.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-faint">
                  {all.length === 0 ? "Здесь нет страниц." : "Ничего не нашлось."}
                </p>
              )}
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPicked(p.id)}
                  disabled={p.id === target.id}
                  className={cn(
                    "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left transition",
                    p.id === target.id && "opacity-40",
                    picked === p.id ? "bg-accent text-white" : "hover:bg-surface",
                  )}
                >
                  <span className="text-sm font-semibold">{p.label}</span>
                  {p.path && (
                    <span
                      className={cn(
                        "text-[11px]",
                        picked === p.id ? "text-white/70" : "text-faint",
                      )}
                    >
                      {p.path}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fill}
            disabled={!picked || busy}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Переношу…" : "Наполнить"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-faint transition hover:text-content"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
