"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  IconChevronRight,
  IconChevronDown,
  IconDots,
  IconGrid,
  IconList,
  IconFolder,
  IconFile,
  IconSprout,
  IconPlus,
} from "@/components/icons";

import { PhraseReader, type MaterialPhrase } from "./phrase-reader";
import { RuleReader } from "./rule-reader";
import type { RuleBlock } from "@/lib/rule-parser";
import { NodeEditor, type EditorTarget } from "./node-editor";
import { ContentImporter } from "./content-importer";
import { RuleImporter } from "./rule-importer";
import { deleteNodeAction } from "@/lib/actions/materials";

export type MaterialNode = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  type: "FOLDER" | "FILE";
  fileKind: string | null;
  category: string | null;
  sizeLabel: string | null;
  phrases: MaterialPhrase[];
  blocks: RuleBlock[];
  children: MaterialNode[];
};

const kindTint: Record<string, string> = {
  PDF: "tint-rose",
  PPT: "tint-orange",
  DOC: "tint-sky",
  MP3: "tint-violet",
};

function collectIds(nodes: MaterialNode[], acc: string[] = []) {
  for (const n of nodes) {
    acc.push(n.id);
    if (n.children.length) collectIds(n.children, acc);
  }
  return acc;
}

function countFiles(node: MaterialNode): number {
  if (node.type === "FILE") return 1;
  return node.children.reduce((s, c) => s + countFiles(c), 0);
}

export function MaterialsExplorer({
  tree,
  progress,
  editable = false,
  scope = "MATERIAL",
  ownerId,
  emptyText,
}: {
  tree: MaterialNode[];
  progress?: number;
  /** Текст пустого состояния (у ошибок он свой). */
  emptyText?: string;
  /** Конструктор доступен только учителю. */
  editable?: boolean;
  /** MATERIAL — общая библиотека, MISTAKE — личное дерево ошибок ученика. */
  scope?: "MATERIAL" | "MISTAKE";
  /** Владелец личного дерева (для scope MISTAKE). */
  ownerId?: string;
}) {
  const { t } = useT();
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [importNode, setImportNode] = useState<{ id: string; name: string } | null>(null);
  const [ruleNode, setRuleNode] = useState<{
    id: string;
    name: string;
    icon: string | null;
  } | null>(null);

  const { byId, pathById } = useMemo(() => {
    const byId = new Map<string, MaterialNode>();
    const pathById = new Map<string, MaterialNode[]>();
    const walk = (nodes: MaterialNode[], path: MaterialNode[]) => {
      for (const n of nodes) {
        byId.set(n.id, n);
        pathById.set(n.id, [...path, n]);
        if (n.children.length) walk(n.children, [...path, n]);
      }
    };
    walk(tree, []);
    return { byId, pathById };
  }, [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.length ? [tree[0].id] : []),
  );
  const [selectedId, setSelectedId] = useState<string | null>(tree[0]?.id ?? null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pathOpen, setPathOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openNode(node: MaterialNode) {
    setSelectedId(node.id);
    if (node.type === "FOLDER") setExpanded((prev) => new Set(prev).add(node.id));
  }

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const breadcrumb = selectedId ? pathById.get(selectedId) ?? [] : [];
  // Страница материала (FILE без типа файла) открывается как читалка фраз,
  // а обычный файл (PDF/DOC/MP3) остаётся элементом списка папки.
  const isPhrasePage = selected?.type === "FILE" && !selected.fileKind;
  const contentNode =
    selected?.type === "FILE" ? breadcrumb[breadcrumb.length - 2] ?? null : selected;
  const items = contentNode?.children ?? [];

  if (tree.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center ring-1 ring-line shadow-sm">
          <p className="text-sm text-faint">{emptyText ?? t.materials.noMaterials}</p>
          {editable && (
            <button
              type="button"
              onClick={() =>
                setEditorTarget({
                  mode: "create",
                  parentId: null,
                  kind: "FOLDER",
                  scope,
                  ownerId,
                })
              }
              className="flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <IconPlus className="h-4 w-4" /> Создать раздел
            </button>
          )}
        </div>
        <NodeEditor
          key={editorTarget ? "create-root" : "editor-idle"}
          target={editorTarget}
          onClose={() => setEditorTarget(null)}
        />
      </>
    );
  }

  /** Меню «три точки». */
  const dotsMenu = (n: MaterialNode, isOpen: boolean, hasChildren: boolean) => (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuFor(menuFor === n.id ? null : n.id);
        }}
        aria-label="..."
        className={cn(
          "flex h-7 w-6 shrink-0 items-center justify-center rounded text-faint transition hover:text-content",
          menuFor === n.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <IconDots className="h-4 w-4" />
      </button>

      {menuFor === n.id && (
        <div
          ref={menuRef}
          className="absolute right-1 top-9 z-20 w-48 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl"
        >
          <button
            type="button"
            onClick={() => {
              openNode(n);
              setMenuFor(null);
            }}
            className="block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2"
          >
            {t.materials.open}
          </button>
          {hasChildren && (
            <button
              type="button"
              onClick={() => {
                const ids = collectIds([n]);
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (isOpen) ids.forEach((id) => next.delete(id));
                  else ids.forEach((id) => next.add(id));
                  return next;
                });
                setMenuFor(null);
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2"
            >
              {isOpen ? t.materials.collapseAll : t.materials.expandAll}
            </button>
          )}

          {editable && (
            <>
              <div className="my-1 border-t border-line" />
              {n.type === "FILE" && !n.fileKind && (
                <button
                  type="button"
                  onClick={() => {
                    setImportNode({ id: n.id, name: n.name });
                    setMenuFor(null);
                  }}
                  className="block w-full px-3.5 py-2 text-left text-sm font-medium text-accent transition hover:bg-surface-2"
                >
                  Словник из текста
                </button>
              )}
              {n.type === "FILE" && !n.fileKind && (
                <button
                  type="button"
                  onClick={() => {
                    setRuleNode({ id: n.id, name: n.name, icon: n.icon });
                    setMenuFor(null);
                  }}
                  className="block w-full px-3.5 py-2 text-left text-sm font-medium text-accent transition hover:bg-surface-2"
                >
                  Вставить правило
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditorTarget({
                    mode: "edit",
                    nodeId: n.id,
                    name: n.name,
                    icon: n.icon,
                    description: n.description,
                    isPage: n.type === "FILE" && !n.fileKind,
                  });
                  setMenuFor(null);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2"
              >
                Переименовать / иконка
              </button>
              {n.type === "FOLDER" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditorTarget({
                        mode: "create",
                        parentId: n.id,
                        kind: "FOLDER",
                        scope,
                        ownerId,
                      });
                      setMenuFor(null);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2"
                  >
                    + Подпапка
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditorTarget({
                        mode: "create",
                        parentId: n.id,
                        kind: "PAGE",
                        scope,
                        ownerId,
                      });
                      setMenuFor(null);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2"
                  >
                    + Страница
                  </button>
                </>
              )}
              <form
                action={deleteNodeAction}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `Удалить «${n.name}»${hasChildren ? " вместе со всем содержимым" : ""}? Это необратимо.`,
                    )
                  ) {
                    e.preventDefault();
                    return;
                  }
                  setMenuFor(null);
                }}
              >
                <input type="hidden" name="nodeId" value={n.id} />
                <button
                  type="submit"
                  className="block w-full px-3.5 py-2 text-left text-sm text-rose-500 transition hover:bg-surface-2"
                >
                  Удалить
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );

  /** Подкатегории: точка-маркер + линия-связка. */
  const renderSub = (n: MaterialNode) => {
    const isOpen = expanded.has(n.id);
    const isSelected = selectedId === n.id;
    const hasChildren = n.children.length > 0;

    return (
      <div key={n.id}>
        <div
          className={cn(
            "group relative flex items-center gap-1 rounded-lg pr-1 transition",
            isSelected ? "bg-accent-soft" : "hover:bg-surface-2",
          )}
        >
          <button
            type="button"
            onClick={() => openNode(n)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full border-2 transition",
                isSelected
                  ? "border-accent bg-accent"
                  : "border-line bg-surface group-hover:border-faint",
              )}
            />
            {n.icon && <span className="shrink-0 text-sm leading-none">{n.icon}</span>}
            <span
              className={cn(
                "truncate text-[13px] transition",
                isSelected ? "font-semibold text-accent" : "text-muted",
              )}
            >
              {n.name}
            </span>
          </button>

          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(n.id)}
              aria-label={n.name}
              className="flex h-7 w-5 shrink-0 items-center justify-center text-faint transition hover:text-content"
            >
              <IconChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          )}

          {dotsMenu(n, isOpen, hasChildren)}
        </div>

        {hasChildren && isOpen && (
          <div className="ml-[13px] border-l border-line pl-3">
            {n.children.map(renderSub)}
          </div>
        )}
      </div>
    );
  };

  /** Категории верхнего уровня: плитка с иконкой. */
  const renderCategory = (n: MaterialNode) => {
    const isOpen = expanded.has(n.id);
    const isSelected = selectedId === n.id;
    const hasChildren = n.children.length > 0;

    return (
      <div key={n.id} className="mb-1.5">
        <div
          className={cn(
            "group relative flex items-center gap-2 rounded-xl px-2 py-2 transition",
            isSelected
              ? "bg-accent-soft ring-1 ring-accent/25"
              : "hover:bg-surface-2",
          )}
        >
          <button
            type="button"
            onClick={() => {
              openNode(n);
              if (hasChildren && !isOpen) toggle(n.id);
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition",
                isSelected ? "bg-surface shadow-sm" : "bg-surface-2",
              )}
            >
              {n.icon ?? "📁"}
            </span>
            <span
              className={cn(
                "truncate text-sm font-semibold transition",
                isSelected ? "text-accent" : "text-content",
              )}
            >
              {n.name}
            </span>
          </button>

          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(n.id)}
              aria-label={n.name}
              className="flex h-7 w-5 shrink-0 items-center justify-center text-faint transition hover:text-content"
            >
              <IconChevronRight
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          )}

          {dotsMenu(n, isOpen, hasChildren)}
        </div>

        {hasChildren && isOpen && (
          <div className="ml-5 mt-1 border-l border-line pl-3">
            {n.children.map(renderSub)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* ---------- Путь обучения ---------- */}
      <aside className="flex flex-col gap-4 rounded-2xl bg-surface p-3.5 ring-1 ring-line shadow-sm sm:p-4">
        <button
          type="button"
          onClick={() => setPathOpen((v) => !v)}
          className="flex items-center gap-2 px-1"
        >
          <IconSprout className="h-4.5 w-4.5 text-accent" />
          <span className="flex-1 text-left text-sm font-bold text-content">
            {t.materials.learningPath}
          </span>
          <IconChevronDown
            className={cn(
              "h-4 w-4 text-faint transition-transform",
              !pathOpen && "-rotate-90",
            )}
          />
        </button>

        {pathOpen && (
          <div className="max-h-[60vh] overflow-y-auto pr-0.5">
            {tree.map(renderCategory)}
          </div>
        )}

        {editable && pathOpen && (
          <button
            type="button"
            onClick={() =>
              setEditorTarget({
                mode: "create",
                parentId: null,
                kind: "FOLDER",
                scope,
                ownerId,
              })
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          >
            <IconPlus className="h-4 w-4" /> Новый раздел
          </button>
        )}

        {typeof progress === "number" && (
          <div className="rounded-2xl bg-accent-soft p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-content">
              <IconSprout className="h-4 w-4 text-accent" />
              {t.materials.keepGoing}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              {t.materials.keepGoingHint}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="grad-accent h-full rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-accent">{progress}%</span>
            </div>
          </div>
        )}
      </aside>

      {/* ---------- Содержимое ---------- */}
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1">
                {i > 0 && <IconChevronRight className="h-3.5 w-3.5 text-faint" />}
                <button
                  type="button"
                  onClick={() => openNode(b)}
                  className={cn(
                    "truncate transition",
                    i === breadcrumb.length - 1
                      ? "font-semibold text-content"
                      : "text-muted hover:text-content",
                  )}
                >
                  {b.icon} {b.name}
                </button>
              </span>
            ))}
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-xl bg-surface-2 p-1",
              isPhrasePage && "hidden",
            )}
          >
            <button
              type="button"
              onClick={() => setView("grid")}
              title={t.materials.viewGrid}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                view === "grid" ? "bg-accent text-white" : "text-muted hover:text-content",
              )}
            >
              <IconGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              title={t.materials.viewList}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                view === "list" ? "bg-accent text-white" : "text-muted hover:text-content",
              )}
            >
              <IconList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isPhrasePage && selected && (
          <>
            {editable && (
              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setImportNode({ id: selected.id, name: selected.name })}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                >
                  <IconPlus className="h-4 w-4" /> Словник из текста
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRuleNode({
                      id: selected.id,
                      name: selected.name,
                      icon: selected.icon,
                    })
                  }
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                >
                  <IconPlus className="h-4 w-4" /> Вставить правило
                </button>
              </div>
            )}
            {selected.blocks.length > 0 ? (
              <RuleReader
                title={selected.name}
                icon={selected.icon}
                description={selected.description}
                blocks={selected.blocks}
              />
            ) : (
              <PhraseReader
                title={selected.name}
                icon={selected.icon}
                description={selected.description}
                phrases={selected.phrases}
              />
            )}
          </>
        )}

        {!isPhrasePage && !contentNode && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.selectFolder}</p>
        )}

        {!isPhrasePage && contentNode && items.length === 0 && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.emptyFolder}</p>
        )}

        {!isPhrasePage && view === "grid" && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNode(n)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                  selectedId === n.id
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-surface-2",
                )}
              >
                <span className="text-2xl leading-none">
                  {n.icon ?? (n.type === "FOLDER" ? "📁" : "📄")}
                </span>
                <span className="w-full truncate text-sm font-semibold text-content">
                  {n.name}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-faint">
                  {n.type === "FOLDER" ? (
                    <>
                      <IconFolder className="h-3.5 w-3.5" />
                      {fmt(t.materials.itemsCount, { n: countFiles(n) })}
                    </>
                  ) : (
                    <>
                      <IconFile className="h-3.5 w-3.5" />
                      {n.fileKind} · {n.sizeLabel}
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {!isPhrasePage && view === "list" && items.length > 0 && (
          <div className="flex flex-col divide-y divide-line">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNode(n)}
                className="flex items-center gap-3 py-2.5 text-left transition hover:bg-surface-2"
              >
                <span className="w-7 shrink-0 text-center text-lg leading-none">
                  {n.icon ?? (n.type === "FOLDER" ? "📁" : "📄")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
                  {n.name}
                </span>
                {n.type === "FILE" && n.fileKind && (
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold sm:inline",
                      kindTint[n.fileKind] ?? "tint-accent",
                    )}
                  >
                    {n.fileKind}
                  </span>
                )}
                <span className="w-24 shrink-0 text-right text-[11px] text-faint">
                  {n.type === "FOLDER"
                    ? fmt(t.materials.itemsCount, { n: countFiles(n) })
                    : n.sizeLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {editable && (
        <>
          {/* key пересоздаёт окно на каждую новую цель, иначе состояние
              прошлого успешного действия закрыло бы его сразу. */}
          <NodeEditor
            key={
              editorTarget
                ? editorTarget.mode === "edit"
                  ? `edit-${editorTarget.nodeId}`
                  : `create-${editorTarget.parentId ?? "root"}-${editorTarget.kind}`
                : "editor-idle"
            }
            target={editorTarget}
            onClose={() => setEditorTarget(null)}
          />
          <ContentImporter
            key={importNode ? `import-${importNode.id}` : "import-idle"}
            node={importNode}
            onClose={() => setImportNode(null)}
            scope={scope}
          />
          <RuleImporter
            key={ruleNode ? `rule-${ruleNode.id}` : "rule-idle"}
            node={ruleNode}
            onClose={() => setRuleNode(null)}
          />
        </>
      )}
    </div>
  );
}
