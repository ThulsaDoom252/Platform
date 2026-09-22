"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import {
  copyNodesAction,
  listCopyTargetsAction,
  type CopyNode,
  type CopyTree,
} from "@/lib/actions/materials";
import { IconChevronRight, IconFolder, IconFile, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Узел исходного дерева — ровно то, что нужно окну. */
export type CopySource = {
  id: string;
  name: string;
  icon: string | null;
  type: "FOLDER" | "FILE";
  children: CopySource[];
};

function collect(nodes: CopySource[], acc: string[] = []): string[] {
  for (const n of nodes) {
    acc.push(n.id);
    collect(n.children, acc);
  }
  return acc;
}

/** Чекбокс-дерево: что именно взять с собой. */
function SourceTree({
  nodes,
  depth = 0,
  checked,
  toggle,
}: {
  nodes: CopySource[];
  depth?: number;
  checked: Set<string>;
  toggle: (n: CopySource) => void;
}) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.id}>
          <label
            className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-2 text-sm transition hover:bg-surface-2"
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <input
              type="checkbox"
              checked={checked.has(n.id)}
              onChange={() => toggle(n)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            <span className="text-sm leading-none">
              {n.icon ?? (n.type === "FOLDER" ? "📁" : "📄")}
            </span>
            <span className="truncate text-content">{n.name}</span>
          </label>
          {n.children.length > 0 && (
            <SourceTree
              nodes={n.children}
              depth={depth + 1}
              checked={checked}
              toggle={toggle}
            />
          )}
        </div>
      ))}
    </>
  );
}

/** Выбор папки назначения внутри одного дерева. */
function TargetTree({
  nodes,
  parentId,
  depth,
  selected,
  onSelect,
}: {
  nodes: CopyNode[];
  parentId: string | null;
  depth: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const level = nodes.filter((n) => (n.parentId ?? null) === parentId && n.type === "FOLDER");
  if (level.length === 0) return null;

  return (
    <>
      {level.map((n) => (
        <div key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg py-1 pr-2 text-left text-sm transition",
              selected === n.id ? "bg-accent-soft font-semibold text-accent" : "hover:bg-surface-2",
            )}
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <IconChevronRight className="h-3 w-3 shrink-0 text-faint" />
            <span className="text-sm leading-none">{n.icon ?? "📁"}</span>
            <span className="truncate text-content">{n.name}</span>
          </button>
          <TargetTree
            nodes={nodes}
            parentId={n.id}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
          />
        </div>
      ))}
    </>
  );
}

/**
 * Копирование материалов в любое дерево: общую библиотеку или ошибки ученика.
 * Оригиналы остаются на месте.
 */
export function CopyDialog({
  sources,
  onClose,
  onDone,
}: {
  sources: CopySource[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const allIds = useMemo(() => collect(sources), [sources]);
  const rootIds = useMemo(() => sources.map((s) => s.id), [sources]);

  // По умолчанию берём всё вложенное — так чаще всего и надо.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(allIds));
  const [trees, setTrees] = useState<CopyTree[] | null>(null);
  const [treeKey, setTreeKey] = useState("material");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [keepPath, setKeepPath] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    listCopyTargetsAction()
      .then(setTrees)
      .catch(() => setError("Не удалось загрузить список деревьев"));
  }, []);

  const tree = trees?.find((t) => t.key === treeKey) ?? null;
  const onlyFolders = sources.every((s) => s.type === "FOLDER");

  function toggle(n: CopySource) {
    setChecked((prev) => {
      const next = new Set(prev);
      const ids = collect([n]);
      // Снимаем галочку — уходит вся ветка, иначе останутся сироты.
      if (next.has(n.id)) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function run() {
    if (!tree) return;
    setError(null);
    startSave(async () => {
      const res = await copyNodesAction({
        ids: rootIds,
        includeIds: [...checked],
        targetParentId: targetId,
        targetScope: tree.scope,
        targetOwnerId: tree.ownerId,
        keepPath,
      });
      if (res.error) setError(res.error);
      else {
        onDone(res.message ?? "Скопировано");
        onClose();
      }
    });
  }

  const count = allIds.filter((id) => checked.has(id) || rootIds.includes(id)).length;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        sources.length === 1
          ? `Копировать: ${sources[0].name}`
          : `Копировать: ${sources.length} элементов`
      }
      icon={<IconFolder className="h-5 w-5" />}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Что берём */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-content">Что копируем</p>
            <p className="text-[11px] text-faint">
              Выбранное сверху берётся всегда. Снимай галочки с того, что не нужно.
            </p>
            <div className="max-h-[38vh] overflow-y-auto rounded-xl border border-line py-1.5">
              <SourceTree nodes={sources} checked={checked} toggle={toggle} />
            </div>
          </div>

          {/* Куда */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-content">Куда</p>
            <select
              value={treeKey}
              onChange={(e) => {
                setTreeKey(e.target.value);
                setTargetId(null);
              }}
              className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:border-accent"
            >
              {(trees ?? []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>

            <div className="max-h-[32vh] overflow-y-auto rounded-xl border border-line py-1.5">
              <button
                type="button"
                onClick={() => setTargetId(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition",
                  targetId === null
                    ? "bg-accent-soft font-semibold text-accent"
                    : "hover:bg-surface-2",
                )}
              >
                <IconFile className="h-3.5 w-3.5 text-faint" />
                В корень дерева
              </button>
              {tree && (
                <TargetTree
                  nodes={tree.nodes}
                  parentId={null}
                  depth={0}
                  selected={targetId}
                  onSelect={setTargetId}
                />
              )}
              {!trees && (
                <p className="px-3 py-4 text-center text-xs text-faint">Загружаю…</p>
              )}
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5">
          <input
            type="checkbox"
            checked={keepPath}
            onChange={(e) => setKeepPath(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-[12px] text-muted">
            Повторить путь папок
            <span className="block text-[11px] text-faint">
              {onlyFolders
                ? "Над копией появится та же цепочка родительских папок, что и у оригинала."
                : "Файлы лягут в такие же папки, как у оригинала. Без галочки — прямо в выбранную папку."}
            </span>
          </span>
        </label>

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
            onClick={run}
            disabled={saving || !tree}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              "Копирую…"
            ) : (
              <>
                <IconCheck className="h-4 w-4" /> Копировать ({count})
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
