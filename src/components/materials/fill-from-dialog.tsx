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

/** Ветка дерева источника. */
type Branch = CopyNode & { children: Branch[] };

const withIcon = (n: CopyNode) => `${n.icon ?? ""} ${n.name}`.trim();

/** Собирает плоский список узлов в дерево, сохраняя порядок. */
function build(nodes: CopyNode[]): Branch[] {
  const byId = new Map<string, Branch>(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots: Branch[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Разворачивает дерево в список страниц с путём до каждой — для поиска. */
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
    .map((n) => ({ id: n.id, label: withIcon(n), path: pathOf(n) }));
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
  /** Свёрнутые папки. По умолчанию дерево раскрыто целиком. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!target) return;
    let alive = true;
    listCopyTargetsAction()
      .then((list) => {
        if (!alive) return;
        // Ошибки — это разбор промахов, а не учебный материал: наполнять
        // страницу из них незачем, поэтому такие деревья не показываем.
        const usable = list.filter((tree) => tree.scope !== "MISTAKE");
        setTrees(usable);
        setTreeKey((prev) => prev || usable[0]?.key || "");
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
  const found = needle
    ? all.filter((p) => `${p.path} ${p.label}`.toLowerCase().includes(needle))
    : [];
  const roots = tree ? build(tree.nodes) : [];

  /** Ветка дерева: папки раскрываются, страницы выбираются. */
  const branch = (node: Branch, depth: number): React.ReactNode => {
    const isFolder = node.type === "FOLDER";
    const isOpen = !collapsed.has(node.id);
    const isSelf = node.id === target.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() =>
            isFolder
              ? setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                })
              : setPicked(node.id)
          }
          disabled={isSelf}
          style={{ paddingLeft: `${depth * 16 + 10}px` }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left transition",
            isSelf && "opacity-40",
            picked === node.id ? "bg-accent text-white" : "hover:bg-surface",
          )}
        >
          <span
            className={cn(
              "w-3 shrink-0 text-[10px]",
              picked === node.id ? "text-white/70" : "text-faint",
            )}
          >
            {isFolder ? (isOpen ? "▾" : "▸") : ""}
          </span>
          <span
            className={cn(
              "truncate",
              isFolder ? "text-sm font-semibold" : "text-[13px]",
            )}
          >
            {withIcon(node)}
          </span>
        </button>

        {isFolder && isOpen && node.children.map((c) => branch(c, depth + 1))}
      </div>
    );
  };

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

            {/* Без поиска — всё дерево целиком, с поиском — только совпавшие
                страницы с путём до них: так быстрее, чем раскрывать папки. */}
            <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-xl bg-surface-2 p-1.5">
              {all.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-faint">Здесь нет страниц.</p>
              )}

              {all.length > 0 && !needle && roots.map((n) => branch(n, 0))}

              {needle && found.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-faint">Ничего не нашлось.</p>
              )}

              {needle &&
                found.map((p) => (
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
