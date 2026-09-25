"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  IconGrip,
  IconMaterials,
  IconX,
  IconPencil,
} from "@/components/icons";
import { Modal } from "@/components/modal";

import { PhraseReader, type MaterialPhrase } from "./phrase-reader";
import { RuleReader } from "./rule-reader";
import type { RuleBlock } from "@/lib/rule-parser";
import { NodeEditor, type EditorTarget, type TreeScope } from "./node-editor";
import { NodeCreator } from "./node-creator";
import { TreeImporter, type ImportTarget } from "./tree-importer";
import { ContentImporter } from "./content-importer";
import { VocabularyCoverActions } from "./vocabulary-cover";
import { RuleImporter } from "./rule-importer";
import { BulkIconEditor } from "./bulk-icon-editor";
import { WordAdder, PhraseEditor } from "./phrase-form";
import { RuleEditor } from "./rule-editor";
import { VocabularyEditor } from "./vocabulary-editor";
import { ExportDialog } from "./export-dialog";
import { CopyDialog, type CopySource } from "./copy-dialog";

/** Дерево для окна копирования — только то, что ему нужно показать. */
const toCopySource = (n: MaterialNode): CopySource => ({
  id: n.id,
  name: n.name,
  icon: n.icon,
  type: n.type,
  children: n.children.map(toCopySource),
});
import {
  changeMaterialPageKindAction,
  clearTreeFormattingMarksAction,
  clearPagesAction,
  deleteNodeAction,
  deleteNodesAction,
  moveNodeAction,
  reformatMaterialPageAction,
  repairPhraseIconsAction,
  reorderNodeAction,
  scanTreeFormattingAction,
  setMaterialsNeedsFixAction,
  toggleFormattingScanIgnoredAction,
  translateMaterialPageAction,
} from "@/lib/actions/materials";

/** Есть ли на странице что чистить: словник или разобранное правило. */
const hasContent = (n: MaterialNode) => n.phrases.length > 0 || n.blocks.length > 0;

/**
 * Чем страница была заполнена. У страниц, созданных до появления поля,
 * тип выводим из содержимого — переносить данные ради этого не нужно.
 */
const pageKind = (n: MaterialNode): "VOCAB" | "RULE" | null =>
  n.pageKind === "RULE" || n.pageKind === "VOCAB"
    ? n.pageKind
    : n.blocks.length > 0
      ? "RULE"
      : n.phrases.length > 0
        ? "VOCAB"
        : null;

const pageKindLabel = (kind: "VOCAB" | "RULE") =>
  kind === "RULE" ? "Правило" : "Словарь";

const pageBtn =
  "flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent";

/** Кнопка панели действий над открытой папкой. */
const toolBtn =
  "flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent";

/** Цель «в корень» у перетаскивания — папки с таким id не бывает. */
const ROOT_DROP = "__root__";

/** Куда попадёт перетаскиваемый узел относительно элемента под курсором. */
type DropWhere = "before" | "after" | "into";

export type MaterialNode = {
  id: string;
  name: string;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  type: "FOLDER" | "FILE";
  fileKind: string | null;
  category: string | null;
  sizeLabel: string | null;
  pageKind: string | null;
  translationLang: "RU" | "UK";
  needsFix: boolean;
  formattingIssue: boolean;
  formattingScanIgnored: boolean;
  mergeCount: number;
  sourceText: string | null;
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
  canExport = false,
}: {
  tree: MaterialNode[];
  progress?: number;
  /** Текст пустого состояния (у ошибок он свой). */
  emptyText?: string;
  /** Конструктор доступен только учителю. */
  editable?: boolean;
  /** Какому дереву принадлежит то, что здесь создаётся. */
  scope?: TreeScope;
  /** Владелец личного дерева (для scope MISTAKE). */
  ownerId?: string;
  /** Выгрузка страницы в текст и docx. Учитель может её отключить ученику. */
  canExport?: boolean;
}) {
  const { t } = useT();
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [importNode, setImportNode] = useState<{ id: string; name: string } | null>(null);
  const [ruleNode, setRuleNode] = useState<{
    id: string;
    name: string;
    icon: string | null;
  } | null>(null);
  const [addWordsTo, setAddWordsTo] = useState<{
    id: string;
    name: string;
    translationLang: "RU" | "UK";
  } | null>(null);
  const [ruleEditNode, setRuleEditNode] = useState<MaterialNode | null>(null);
  const [vocabularyEditNode, setVocabularyEditNode] = useState<MaterialNode | null>(null);
  const [copyNodes, setCopyNodes] = useState<MaterialNode[] | null>(null);
  const [importTree, setImportTree] = useState<ImportTarget | null>(null);
  const [exportPage, setExportPage] = useState<MaterialNode | null>(null);
  const [editPhrase, setEditPhrase] = useState<MaterialPhrase | null>(null);
  const [kindChange, setKindChange] = useState<{
    node: MaterialNode;
    next: "VOCAB" | "RULE";
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
  const [pathOpen, setPathOpen] = useState(true);
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  /** Контекстное меню: открывается у курсора, поэтому хранит координаты. */
  const [menu, setMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  /** Куда ляжет перетаскиваемый узел: внутрь элемента либо рядом с ним. */
  const [dropAt, setDropAt] = useState<{ id: string; where: DropWhere } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moving, startMove] = useTransition();

  /** Групповые операции: выбор галочками, Ctrl+клик выделяет диапазон. */
  const [selection, setSelection] = useState<Set<string>>(new Set());
  /** Точка отсчёта диапазона — последний элемент, тронутый без Ctrl. */
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [bulkIcons, setBulkIcons] = useState(false);
  /** Очередь наполнения: по выбранным страницам идём одна за другой. */
  const [fillQueue, setFillQueue] = useState<{ ids: string[]; index: number } | null>(null);

  // Дерево могло перестроиться (перенос, удаление) — чистим выбор от призраков.
  useEffect(() => {
    setSelection((prev) => {
      const next = new Set([...prev].filter((id) => byId.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [byId]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Меню висит в фиксированных координатах, при прокрутке оно «уедет».
    window.addEventListener("scroll", () => setMenu(null), { once: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (moving || (!moveError && !notice)) return;
    const t = setTimeout(() => {
      setMoveError(null);
      setNotice(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [moveError, moving, notice]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isAdaptiveLayout = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  function togglePathPanel() {
    const willOpen = !pathOpen;
    setPathOpen(willOpen);

    if (willOpen && isAdaptiveLayout()) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }

  function openNode(node: MaterialNode) {
    setSelectedId(node.id);
    if (node.type === "FOLDER") setExpanded((prev) => new Set(prev).add(node.id));

    // На узком экране дерево стоит над содержимым. После выбора файла
    // оставляем от панели только заголовок и сразу показываем сам материал.
    if (node.type === "FILE" && isAdaptiveLayout()) {
      setPathOpen(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    }
  }

  /** Открывает меню у курсора, не давая ему вылезти за край окна. */
  function openMenu(nodeId: string, clientX: number, clientY: number) {
    const x = Math.max(8, Math.min(clientX, window.innerWidth - 236));
    const y = Math.max(8, Math.min(clientY, window.innerHeight - 320));
    setMenu({ nodeId, x, y });
  }

  /**
   * Правая кнопка и двойной клик открывают меню конструктора.
   * У ученика меню редактирования нет, поэтому системное меню браузера
   * мы у него не перехватываем.
   */
  const menuHandlers = (n: MaterialNode) => (!editable ? {} : {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(n.id, e.clientX, e.clientY);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(n.id, e.clientX, e.clientY);
    },
  });


  /**
   * Можно ли поставить перетаскиваемый узел рядом с этим элементом.
   * Нельзя, если цель — он сам или лежит внутри него: ветка оторвалась бы.
   */
  function canPlaceNear(targetId: string): boolean {
    if (!dragId || targetId === dragId) return false;
    return !(pathById.get(targetId) ?? []).some((p) => p.id === dragId);
  }

  /** Внутрь принимает только папка. */
  function canDropInto(targetId: string): boolean {
    return canPlaceNear(targetId) && byId.get(targetId)?.type === "FOLDER";
  }

  const canDropRoot = !!dragId && !tree.some((n) => n.id === dragId);

  /**
   * Край элемента означает «поставить рядом», середина папки — «положить внутрь».
   * В дереве и списке делим по высоте, в сетке плиток — по ширине.
   */
  function zoneAt(e: React.DragEvent, n: MaterialNode, axis: "y" | "x"): DropWhere | null {
    const r = e.currentTarget.getBoundingClientRect();
    const near = canPlaceNear(n.id);
    const into = canDropInto(n.id);
    if (!near && !into) return null;

    const pos = axis === "y" ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    const edge = axis === "y" ? 0.3 : 0.25;

    if (into) {
      if (near && pos < edge) return "before";
      if (near && pos > 1 - edge) return "after";
      return "into";
    }
    return pos < 0.5 ? "before" : "after";
  }

  function finishDrag() {
    setDragId(null);
    setDropAt(null);
  }

  function performMove(nodeId: string, parentId: string | null) {
    finishDrag();
    startMove(async () => {
      const res = await moveNodeAction(nodeId, parentId);
      if (res.error) setMoveError(res.error);
    });
  }

  function performReorder(nodeId: string, targetId: string, where: "before" | "after") {
    finishDrag();
    startMove(async () => {
      const res = await reorderNodeAction(nodeId, targetId, where);
      if (res.error) setMoveError(res.error);
    });
  }

  /** Свойства перетаскивания для строки дерева, плитки или строки списка. */
  const dragProps = (n: MaterialNode, axis: "y" | "x" = "y") => {
    if (!editable) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", n.id);
        setDragId(n.id);
        setMenu(null);
      },
      onDragEnd: finishDrag,
      onDragOver: (e: React.DragEvent) => {
        const where = zoneAt(e, n, axis);
        if (!where) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (dropAt?.id !== n.id || dropAt.where !== where) setDropAt({ id: n.id, where });
      },
      onDragLeave: () => {
        if (dropAt?.id === n.id) setDropAt(null);
      },
      onDrop: (e: React.DragEvent) => {
        const where = zoneAt(e, n, axis);
        if (!where || !dragId) return;
        e.preventDefault();
        e.stopPropagation();
        if (where === "into") performMove(dragId, n.id);
        else performReorder(dragId, n.id, where);
      },
    };
  };

  /** Обводка, когда узел ляжет внутрь этого элемента. */
  const dropRing = (id: string) =>
    dropAt?.id === id && dropAt.where === "into"
      ? "ring-2 ring-accent ring-offset-1 ring-offset-surface"
      : "";

  /** Линия вставки, когда узел ляжет рядом с этим элементом. */
  const dropLine = (id: string, axis: "y" | "x" = "y") => {
    if (dropAt?.id !== id || dropAt.where === "into") return null;
    const before = dropAt.where === "before";
    return (
      <span
        className={cn(
          "pointer-events-none absolute z-10 rounded-full bg-accent",
          axis === "y"
            ? cn("left-0 right-0 h-0.5", before ? "-top-px" : "-bottom-px")
            : cn("bottom-0 top-0 w-0.5", before ? "-left-1" : "-right-1"),
        )}
      />
    );
  };

  /**
   * Ручка захвата. Строка дерева состоит из кнопок, а с кнопки браузер
   * перетаскивание начинает неохотно — за ручку оно работает всегда.
   * Событие всплывает до строки, там и стоит обработчик.
   */
  const gripHandle = () =>
    editable ? (
      <span
        draggable
        title="Перетащить"
        className="flex h-7 w-3.5 shrink-0 cursor-grab items-center justify-center text-faint opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <IconGrip className="h-3.5 w-3.5" />
      </span>
    ) : null;

  // ------------------------------------------------ групповой выбор

  function toggleSelect(id: string) {
    setAnchorId(id);
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * Выделяет всё от точки отсчёта до указанного элемента.
   * Порядок передаёт тот список, в котором кликнули: дерево и правая
   * панель расположены по-разному, диапазон считается внутри своего.
   */
  function selectRange(order: string[], toId: string) {
    const a = anchorId ? order.indexOf(anchorId) : -1;
    const b = order.indexOf(toId);
    if (a < 0 || b < 0) {
      toggleSelect(toId);
      return;
    }
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    setSelection(new Set(order.slice(lo, hi + 1)));
  }

  /** Ctrl/Shift+клик выделяет диапазон, обычный клик открывает элемент. */
  function handleOpenClick(e: React.MouseEvent, n: MaterialNode, order: string[]) {
    if (editable && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault();
      selectRange(order, n.id);
      return;
    }
    setAnchorId(n.id);
    openNode(n);
  }

  /** Окно переименования и смены иконки. */
  function openEditor(n: MaterialNode) {
    setEditorTarget({
      mode: "edit",
      nodeId: n.id,
      name: n.name,
      icon: n.icon,
      description: n.description,
      isPage: n.type === "FILE" && !n.fileKind,
    });
  }

  /**
   * Иконка сама по себе — кнопка: один клик открывает редактирование.
   * Внутри строки это <span>, потому что кнопка в кнопке недопустима.
   */
  const iconSlot = (n: MaterialNode, className: string, fallback = "") => {
    const content = n.icon ?? fallback;
    if (!editable) return <span className={className}>{content}</span>;
    return (
      <span
        role="button"
        tabIndex={-1}
        title="Изменить иконку и название"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openEditor(n);
        }}
        className={cn(className, "cursor-pointer transition hover:opacity-50")}
      >
        {content}
      </span>
    );
  };

  /**
   * Системный маркер типа не заменяет пользовательский emoji: в дереве
   * emoji всегда идёт первым, а папка / файл читаются вторым знаком.
   */
  const kindMarker = (n: MaterialNode) => (
    <span
      title={n.type === "FOLDER" ? "Папка" : "Файл"}
      aria-hidden="true"
      className={cn(
        "material-kind-marker",
        n.type === "FOLDER" ? "material-kind-folder" : "material-kind-file",
        "h-8 w-8 rounded-xl",
      )}
    >
      {n.type === "FOLDER" ? (
        <IconFolder className="h-4 w-4" />
      ) : (
        <IconFile className="h-4 w-4" />
      )}
    </span>
  );

  const selectBox = (n: MaterialNode) =>
    editable ? (
      <input
        type="checkbox"
        checked={selection.has(n.id)}
        onChange={() => toggleSelect(n.id)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Выбрать"
        className={cn(
          "h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--accent)] transition",
          selection.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      />
    ) : null;

  const selectedNodes = [...selection]
    .map((id) => byId.get(id))
    .filter((n): n is MaterialNode => !!n);

  const formattingIssueCount = [...byId.values()].filter(
    (node) => node.type === "FILE" && node.formattingIssue,
  ).length;
  const formattingIgnoredCount = [...byId.values()].filter(
    (node) => node.type === "FILE" && node.formattingScanIgnored,
  ).length;

  /** Наполнять можно только страницы: папка и файл с типом сюда не годятся. */
  const fillablePages = selectedNodes.filter((n) => n.type === "FILE" && !n.fileKind);

  function deleteNodes(nodes: MaterialNode[]) {
    if (nodes.length === 0) return;
    const names = nodes.map((n) => n.name).join(", ");
    const question =
      nodes.length === 1
        ? `Удалить «${names}» вместе со всем содержимым? Это необратимо.`
        : `Удалить ${nodes.length} элементов вместе со всем содержимым?\n\n${names}\n\nЭто необратимо.`;
    if (!confirm(question)) return;

    const ids = nodes.map((n) => n.id);
    setSelection(new Set());
    startMove(async () => {
      const res = await deleteNodesAction(ids);
      if (res.error) setMoveError(res.error);
    });
  }

  /** Убирает содержимое страниц, оставляя сами страницы. */
  function clearPages(nodes: MaterialNode[]) {
    const pages = nodes.filter(hasContent);
    if (pages.length === 0) return;

    const names = pages.map((n) => n.name).join(", ");
    const question =
      pages.length === 1
        ? `Очистить «${names}»? Страница останется, содержимое пропадёт.`
        : `Очистить ${pages.length} страниц?\n\n${names}\n\nСами страницы останутся.`;
    if (!confirm(question)) return;

    const ids = pages.map((n) => n.id);
    startMove(async () => {
      const res = await clearPagesAction(ids);
      if (res.error) setMoveError(res.error);
    });
  }

  /** Поставить или снять учительскую красную отметку у одного или нескольких материалов. */
  function setNeedsFix(nodes: MaterialNode[], marked: boolean) {
    if (nodes.length === 0) return;
    setNotice(marked ? "Отмечаю материалы красным…" : "Снимаю красную отметку…");
    startMove(async () => {
      const res = await setMaterialsNeedsFixAction(
        nodes.map((node) => node.id),
        marked,
      );
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? (marked ? "Отмечено красным" : "Отметка снята"));
      }
    });
  }

  /** Проверить формат словарей и правил во всём текущем дереве. */
  function scanFormatting() {
    setNotice("Робот проверяет форматирование всего дерева…");
    startMove(async () => {
      const res = await scanTreeFormattingAction(scope, ownerId ?? null);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Проверка форматирования завершена");
      }
    });
  }

  /** Снять результаты проверки; ручные исключения при этом сохраняются. */
  function clearFormattingMarks() {
    setNotice("Снимаю жёлтые отметки…");
    startMove(async () => {
      const res = await clearTreeFormattingMarksAction(scope, ownerId ?? null);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Жёлтые отметки сняты");
      }
    });
  }

  /** Включить или исключить один файл из будущих автоматических проверок. */
  function toggleFormattingIgnored(node: MaterialNode) {
    startMove(async () => {
      const res = await toggleFormattingScanIgnoredAction(node.id);
      if (res.error) setMoveError(res.error);
      else setNotice(res.message ?? null);
    });
  }

  /** Заново подобрать смысловые иконки всем словам открытого словаря. */
  function repairPhraseIcons(node: MaterialNode) {
    const count = node.phrases.filter((phrase) => phrase.kind !== "NOTE").length;
    if (count === 0) return;
    if (
      !confirm(
        `Заново подобрать иконки для ${count} записей в «${node.name}»?\n\n` +
          "Текущие иконки могут измениться. Любую из них потом можно заменить вручную.",
      )
    ) {
      return;
    }

    setNotice("Подбираю иконки по словам, переводам и примерам…");
    startMove(async () => {
      const res = await repairPhraseIconsAction(node.id);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Иконки исправлены");
      }
    });
  }

  /** Заново применить актуальный парсер к сохранённому исходнику страницы. */
  function reformatPage(node: MaterialNode) {
    const kind = pageKind(node);
    if (!kind) return;
    const label = kind === "RULE" ? "правило" : "словарь";
    if (
      !confirm(
        `Переформатировать ${label} «${node.name}» из сохранённого исходника?\n\n` +
          "Слова или блоки будут заново разобраны актуальным парсером. " +
          "Если новый разбор найдёт меньше данных, замена автоматически остановится.",
      )
    ) {
      return;
    }

    setNotice(`Переформатирую ${label}…`);
    startMove(async () => {
      const res = await reformatMaterialPageAction(node.id);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Переформатирование завершено");
      }
    });
  }

  /** Применить подтверждённую смену типа и, по возможности, перепарсить исходник. */
  function applyKindChange(reparse: boolean) {
    if (!kindChange) return;
    const { node, next } = kindChange;
    setKindChange(null);
    setNotice(
      reparse
        ? `Перепарсирую «${node.name}» как ${pageKindLabel(next).toLowerCase()}…`
        : `Меняю тип «${node.name}»…`,
    );
    startMove(async () => {
      const res = await changeMaterialPageKindAction(node.id, next, reparse);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Тип файла изменён");
      }
    });
  }

  function translatePage(node: MaterialNode, target: "RU" | "UK") {
    const language = target === "UK" ? "украинский" : "русский";
    if (node.translationLang === target) return;
    const containsMaterial = hasContent(node);
    if (
      !confirm(
        containsMaterial
          ? `Заменить перевод всей страницы «${node.name}» на ${language}?\n\n` +
              "DeepL переведёт существующие переводы и объяснения. Английский текст не изменится."
          : `Использовать ${language} для будущих переводов на странице «${node.name}»?`,
      )
    ) {
      return;
    }

    setNotice(
      containsMaterial
        ? `Перевожу всю страницу на ${language}…`
        : `Выбираю язык: ${language}…`,
    );
    startMove(async () => {
      const result = await translateMaterialPageAction(node.id, target);
      if (result.error) {
        setNotice(null);
        setMoveError(result.error);
      } else {
        setNotice(result.message ?? `Страница переведена на ${language}`);
      }
    });
  }

  /** Закрывает окно наполнения и, если идёт очередь, переходит к следующей странице. */
  function closeImporter() {
    setImportNode(null);
    setRuleNode(null);
    setFillQueue((q) => {
      if (!q) return null;
      const next = q.index + 1;
      return next >= q.ids.length ? null : { ...q, index: next };
    });
  }

  /** Разделы открытой страницы — подсказка при вводе «типа речи». */
  const pageSections = useMemo(() => {
    const node = selectedId ? byId.get(selectedId) : null;
    const seen = new Map<string, string | null>();
    for (const p of node?.phrases ?? []) {
      if (p.section && !seen.has(p.section)) seen.set(p.section, p.icon);
    }
    return [...seen].map(([name, icon]) => ({ name, icon }));
  }, [selectedId, byId]);

  const queueNode = fillQueue ? byId.get(fillQueue.ids[fillQueue.index]) ?? null : null;
  /** Окно выбора типа показываем, пока для текущей страницы не открыт импортёр. */
  const askFillKind = !!queueNode && !importNode && !ruleNode;

  // ------------------------------------------------ горячие клавиши

  /** Порядок строк дерева на экране — по нему считается диапазон. */
  const treeOrder = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: MaterialNode[]) => {
      for (const n of nodes) {
        out.push(n.id);
        if (n.children.length && expanded.has(n.id)) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, expanded]);

  const modalOpen = !!(
    editorTarget ||
    importNode ||
    ruleNode ||
    bulkIcons ||
    fillQueue ||
    menu
  );

  // Обработчик пересобирается на каждый рендер, поэтому держим его в ref —
  // так подписка ставится один раз, но всегда видит свежее состояние.
  const hotkeys = useRef<(e: KeyboardEvent) => void>(undefined);
  hotkeys.current = (e: KeyboardEvent) => {
    const el = document.activeElement as HTMLElement | null;
    // В полях ввода Delete и Backspace означают ровно то, что означают.
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
      return;
    }
    if (modalOpen) return;

    if (e.key === "Escape" && selection.size > 0) {
      e.preventDefault();
      setSelection(new Set());
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      const path = selectedId ? pathById.get(selectedId) ?? [] : [];
      const parent = path[path.length - 2];
      if (parent) {
        setAnchorId(parent.id);
        openNode(parent);
      }
      return;
    }

    if (!editable) return;

    if (e.key === "Delete") {
      e.preventDefault();
      deleteNodes(selectedNodes.length > 0 ? selectedNodes : selected ? [selected] : []);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const target = selectedNodes.length === 1 ? selectedNodes[0] : selected;
      if (target) openEditor(target);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => hotkeys.current?.(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const breadcrumb = selectedId ? pathById.get(selectedId) ?? [] : [];
  // Страница материала (FILE без типа файла) открывается как читалка фраз,
  // а обычный файл (PDF/DOC/MP3) остаётся элементом списка папки.
  const isPhrasePage = selected?.type === "FILE" && !selected.fileKind;
  const contentNode =
    selected?.type === "FILE" ? breadcrumb[breadcrumb.length - 2] ?? null : selected;
  const items = contentNode?.children ?? [];

  /** Красный статус существует только в учительском интерфейсе. */
  const fixMarker = (n: MaterialNode) =>
    editable && n.needsFix ? (
      <span
        title="Нужно исправить"
        aria-label="Нужно исправить"
        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white shadow-sm"
      >
        !
      </span>
    ) : null;

  /**
   * Жёлтый робот — найденная проблема; приглушённый зачёркнутый робот — файл
   * исключён из следующих проходов. Клик меняет только режим сканирования.
   */
  const formattingMarker = (n: MaterialNode) => {
    if (
      !editable ||
      n.type !== "FILE" ||
      (!n.formattingIssue && !n.formattingScanIgnored)
    ) {
      return null;
    }

    const ignored = n.formattingScanIgnored;
    const activate = (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFormattingIgnored(n);
    };

    return (
      <span
        role="button"
        tabIndex={0}
        title={
          ignored
            ? "Исключён из проверок — нажми, чтобы вернуть"
            : "Проблема форматирования — нажми, чтобы исключить из будущих проверок"
        }
        aria-label={
          ignored ? "Вернуть файл в проверки" : "Исключить файл из будущих проверок"
        }
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") activate(event);
        }}
        className={cn(
          "relative flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg px-1 text-sm shadow-sm transition hover:scale-105",
          ignored
            ? "bg-surface-2 text-faint ring-1 ring-line"
            : "bg-amber-400 text-slate-950 ring-1 ring-amber-300",
        )}
      >
        <span aria-hidden>🤖</span>
        {ignored && (
          <span className="absolute h-0.5 w-5 -rotate-45 rounded-full bg-rose-500" />
        )}
      </span>
    );
  };

  /** Жёлтая цифра показывает, сколько одноимённых файлов сведено в один. */
  const mergedMarker = (n: MaterialNode) =>
    editable && n.type === "FILE" && n.mergeCount > 1 ? (
      <span
        title={`Объединено одноимённых файлов: ${n.mergeCount}`}
        aria-label={`Объединено одноимённых файлов: ${n.mergeCount}`}
        className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400 px-1 text-sm font-black text-slate-950 ring-1 ring-amber-300"
      >
        {n.mergeCount}
      </span>
    ) : null;

  const mergedHighlight = (n: MaterialNode) =>
    editable && n.type === "FILE" && n.mergeCount > 1;

  /** Тип содержимого виден прямо в дереве, но только в редакторе учителя. */
  const pageTypeMarker = (n: MaterialNode) => {
    if (!editable || n.type !== "FILE") return null;
    const kind = pageKind(n);
    if (!kind) return null;
    return (
      <span
        title={`Тип файла: ${pageKindLabel(kind)}`}
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
          kind === "RULE" ? "tint-violet" : "tint-sky",
        )}
      >
        {pageKindLabel(kind)}
      </span>
    );
  };

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
          {editable && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setImportTree({
                    parentId: null,
                    parentName: "корень",
                    scope,
                    ownerId: ownerId ?? null,
                  })
                }
                className="flex h-11 items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-5 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/15"
              >
                <IconMaterials className="h-4 w-4" /> Перенести из Google Docs
              </button>
              <p className="text-xs text-faint">
                Вкладки, вложенность, названия и emoji
              </p>
            </div>
          )}
        </div>
        <TreeImporter
          key={importTree ? "tree-root" : "tree-root-idle"}
          target={importTree}
          onClose={() => setImportTree(null)}
          onDone={setNotice}
        />
        <NodeCreator
          key={editorTarget ? "create-root" : "creator-idle"}
          target={editorTarget?.mode === "create" ? editorTarget : null}
          onClose={() => setEditorTarget(null)}
        />
      </>
    );
  }

  /** Кнопка «три точки» — открывает то же меню, что правая кнопка мыши. */
  const dotsButton = (n: MaterialNode) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (menu?.nodeId === n.id) {
          setMenu(null);
          return;
        }
        const r = e.currentTarget.getBoundingClientRect();
        openMenu(n.id, r.right, r.bottom + 4);
      }}
      aria-label="..."
      className={cn(
        "flex h-7 w-6 shrink-0 items-center justify-center rounded text-faint transition hover:text-content",
        menu?.nodeId === n.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <IconDots className="h-4 w-4" />
    </button>
  );

  const menuNode = menu ? byId.get(menu.nodeId) ?? null : null;
  const menuItemClass =
    "block w-full px-3.5 py-2 text-left text-sm text-content transition hover:bg-surface-2";

  const contextMenu = (() => {
    if (!menu || !menuNode) return null;
    const n = menuNode;
    const isOpen = expanded.has(n.id);
    const hasChildren = n.children.length > 0;
    const path = pathById.get(n.id) ?? [];
    const parentId = path[path.length - 2]?.id ?? null;
    // Для папки добавляем внутрь неё, для файла — рядом с ним.
    const addInto = n.type === "FOLDER" ? n.id : parentId;
    const isPage = n.type === "FILE" && !n.fileKind;
    const close = () => setMenu(null);

    return (
      <div
        ref={menuRef}
        style={{ left: menu.x, top: menu.y }}
        className="fixed z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl"
      >
        <p className="truncate px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          {n.icon} {n.name}
        </p>
        <div className="mb-1 border-t border-line" />

        <button
          type="button"
          onClick={() => {
            openNode(n);
            close();
          }}
          className={menuItemClass}
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
              close();
            }}
            className={menuItemClass}
          >
            {isOpen ? t.materials.collapseAll : t.materials.expandAll}
          </button>
        )}

        {editable && (
          <>
            <div className="my-1 border-t border-line" />

            <button
              type="button"
              onClick={() => {
                setEditorTarget({
                  mode: "create",
                  parentId: addInto,
                  kind: "FOLDER",
                  scope,
                  ownerId,
                });
                close();
              }}
              className={menuItemClass}
            >
              Добавить папку
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorTarget({
                  mode: "create",
                  parentId: addInto,
                  kind: "PAGE",
                  scope,
                  ownerId,
                });
                close();
              }}
              className={menuItemClass}
            >
              Добавить файл
            </button>

            <div className="my-1 border-t border-line" />

            <button
              type="button"
              onClick={() => {
                openEditor(n);
                close();
              }}
              className={cn(menuItemClass, "flex items-center justify-between")}
            >
              Переименовать / иконка
              <span className="text-[10px] text-faint">Enter</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNeedsFix([n], !n.needsFix);
                close();
              }}
              className={cn(menuItemClass, n.needsFix && "font-semibold text-rose-600")}
            >
              {n.needsFix ? "Снять красную отметку" : "Отметить красным"}
            </button>

            {isPage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setImportNode({ id: n.id, name: n.name });
                    close();
                  }}
                  className={cn(menuItemClass, "font-medium text-accent")}
                >
                  Словник из текста
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRuleNode({ id: n.id, name: n.name, icon: n.icon });
                    close();
                  }}
                  className={cn(menuItemClass, "font-medium text-accent")}
                >
                  Вставить правило
                </button>
                {hasContent(n) && (
                  <button
                    type="button"
                    onClick={() => {
                      clearPages([n]);
                      close();
                    }}
                    className={menuItemClass}
                  >
                    Очистить содержимое
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setCopyNodes([n]);
                close();
              }}
              className={menuItemClass}
            >
              Копировать в…
            </button>

            {parentId && (
              <button
                type="button"
                onClick={() => {
                  performMove(n.id, null);
                  close();
                }}
                className={menuItemClass}
              >
                Перенести в корень
              </button>
            )}

            <div className="my-1 border-t border-line" />

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
                close();
              }}
            >
              <input type="hidden" name="nodeId" value={n.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-rose-500 transition hover:bg-surface-2"
              >
                Удалить
                <span className="text-[10px] text-faint">Delete</span>
              </button>
            </form>
          </>
        )}
      </div>
    );
  })();

  /** Подкатегории: точка-маркер + линия-связка + явный тип узла. */
  const renderSub = (n: MaterialNode) => {
    const isOpen = expanded.has(n.id);
    const isSelected = selectedId === n.id;
    const hasChildren = n.children.length > 0;

    return (
      <div key={n.id} className="py-0.5">
        <div
          {...menuHandlers(n)}
          {...dragProps(n)}
          className={cn(
            "material-tree-row group relative flex items-center gap-1.5 rounded-xl px-1.5 transition",
            n.type === "FOLDER" ? "material-tree-row-folder" : "material-tree-row-file",
            isSelected ? "is-selected" : "",
            mergedHighlight(n) && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
            editable && n.formattingIssue && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
            editable && n.needsFix && "bg-rose-500/10 ring-1 ring-inset ring-rose-400",
            dragId === n.id && "opacity-40",
            dropRing(n.id),
          )}
        >
          {dropLine(n.id)}
          {selectBox(n)}
          {gripHandle()}
          <button
            type="button"
            onClick={(e) => handleOpenClick(e, n, treeOrder)}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
          >
            <span
              className={cn(
                "material-tree-dot h-3 w-3 shrink-0 rounded-full border-2 transition",
                isSelected
                  ? "border-accent bg-accent"
                  : "border-line bg-surface group-hover:border-faint",
              )}
            />
            {n.icon &&
              iconSlot(
                n,
                "material-node-emoji flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none",
              )}
            {kindMarker(n)}
            <span
              className={cn(
                "truncate text-[15px] font-semibold leading-5 transition",
                isSelected ? "text-accent" : "text-content",
              )}
            >
              {n.name}
            </span>
            {pageTypeMarker(n)}
            {mergedMarker(n)}
            {formattingMarker(n)}
            {fixMarker(n)}
          </button>

          {hasChildren && (
            <button
              type="button"
              onClick={() => toggle(n.id)}
              aria-label={n.name}
              className="flex h-8 w-6 shrink-0 items-center justify-center text-faint transition hover:text-content"
            >
              <IconChevronRight
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
              />
            </button>
          )}

          {dotsButton(n)}
        </div>

        {hasChildren && isOpen && (
          <div className="ml-4 mt-1 border-l border-line pl-3">
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
      <div key={n.id} className="material-tree-root-wrap mb-2">
        <div
          {...menuHandlers(n)}
          {...dragProps(n)}
          className={cn(
            "material-tree-root group relative flex items-center gap-2 rounded-2xl px-2.5 py-2.5 transition",
            isSelected ? "is-selected" : "",
            mergedHighlight(n) && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
            editable && n.formattingIssue && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
            editable && n.needsFix && "bg-rose-500/10 ring-1 ring-inset ring-rose-400",
            dragId === n.id && "opacity-40",
            dropRing(n.id),
          )}
        >
          {dropLine(n.id)}
          {selectBox(n)}
          {gripHandle()}
          <button
            type="button"
            onClick={(e) => {
              if (editable && (e.ctrlKey || e.metaKey || e.shiftKey)) {
                e.preventDefault();
                selectRange(treeOrder, n.id);
                return;
              }
              setAnchorId(n.id);
              // openNode сам раскрывает папку; вызывать здесь ещё и toggle
              // нельзя — второе обновление отменяло первое.
              openNode(n);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {n.icon &&
              iconSlot(
                n,
                "material-root-emoji flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl leading-none transition",
              )}
            {/* Значка папки здесь нет намеренно: рядом уже эмодзи, справа
                стрелка-раскрывашка, а снизу счётчик материалов. Эти 32px
                нужнее названию — без них в строку не влезало даже
                «Vocabulary». */}
            <span className="min-w-0 flex-1">
              <span
                title={n.name}
                className={cn(
                  "block truncate text-sm font-bold transition",
                  isSelected ? "text-accent" : "text-content",
                )}
              >
                {n.name}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-faint">
                {n.description || fmt(t.materials.itemsCount, { n: countFiles(n) })}
              </span>
            </span>
            {pageTypeMarker(n)}
            {mergedMarker(n)}
            {formattingMarker(n)}
            {fixMarker(n)}
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

          {dotsButton(n)}
        </div>

        {hasChildren && isOpen && (
          <div className="material-tree-branch ml-5 mt-2 border-l border-line pl-3">
            {n.children.map(renderSub)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
      {/* ---------- Путь обучения ---------- */}
      <aside
        ref={panelRef}
        className={cn(
          "materials-tree-panel scroll-mt-20 flex flex-col gap-4 rounded-2xl p-3.5 sm:p-4",
          pathOpen && "lg:max-h-[calc(100dvh-6rem)]",
          !pathOpen && "is-collapsed",
        )}
      >
        <button
          type="button"
          onClick={togglePathPanel}
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
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
            <button
              type="button"
              onClick={scanFormatting}
              disabled={moving}
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
              title="Проверить все словари и правила в этом дереве"
            >
              <span aria-hidden>🤖</span>
              {moving ? "Проверяю…" : "Проверить форматирование"}
            </button>
            <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
              <span>
                {formattingIssueCount > 0
                  ? `Проблем: ${formattingIssueCount}`
                  : "Жёлтых отметок нет"}
                {formattingIgnoredCount > 0 ? ` · исключено: ${formattingIgnoredCount}` : ""}
              </span>
              {formattingIssueCount > 0 && (
                <button
                  type="button"
                  onClick={clearFormattingMarks}
                  disabled={moving}
                  className="shrink-0 font-semibold text-amber-600 transition hover:text-amber-500 disabled:opacity-50"
                >
                  Снять все
                </button>
              )}
            </div>
          </div>
        )}

        {pathOpen && (
          <div className="materials-tree-scroll min-h-0 flex-1 max-h-[70vh] overflow-y-auto pr-1 lg:max-h-none">
            {tree.map(renderCategory)}
          </div>
        )}

        {pathOpen && editable && selection.size > 0 && (
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          >
            <IconX className="h-4 w-4" /> Снять выделение ({selection.size})
          </button>
        )}

        {/* Зона появляется только во время перетаскивания — иначе она
            занимала бы место впустую. */}
        {pathOpen && editable && canDropRoot && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropAt?.id !== ROOT_DROP) setDropAt({ id: ROOT_DROP, where: "into" });
            }}
            onDragLeave={() => {
              if (dropAt?.id === ROOT_DROP) setDropAt(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              performMove(dragId!, null);
            }}
            className={cn(
              "flex h-11 items-center justify-center rounded-xl border-2 border-dashed text-xs font-semibold transition",
              dropAt?.id === ROOT_DROP
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-faint",
            )}
          >
            Перетащить в корень
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

        {pathOpen && typeof progress === "number" && (
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
      <section
        ref={contentRef}
        className={cn(
          "scroll-mt-36 rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6 lg:scroll-mt-20",
          editable && selected?.formattingIssue && "ring-2 ring-amber-400",
          editable && selected?.needsFix && "ring-2 ring-rose-400",
        )}
      >
        <div className="relative z-[8] lg:sticky lg:top-16 lg:-mx-6 lg:-mt-6 lg:mb-5 lg:border-b lg:border-line lg:bg-surface/95 lg:px-6 lg:pt-6 lg:pb-1 lg:backdrop-blur-md">
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
                {i === breadcrumb.length - 1 && formattingMarker(b)}
                {i === breadcrumb.length - 1 && fixMarker(b)}
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

        {/* Действия над открытой папкой — те же, что в контекстном меню,
            но на виду. */}
        {editable && !isPhrasePage && contentNode && (
          <div className="mb-4 flex flex-wrap gap-2 border-b border-line pb-4">
            <button
              type="button"
              onClick={() => setCopyNodes([contentNode])}
              className={toolBtn}
              title="Скопировать в другое дерево или папку"
            >
              Поделиться
            </button>
            <button
              type="button"
              onClick={() =>
                setEditorTarget({
                  mode: "create",
                  parentId: contentNode.id,
                  kind: "FOLDER",
                  scope,
                  ownerId,
                })
              }
              className={toolBtn}
            >
              <IconPlus className="h-4 w-4" /> Папка
            </button>
            <button
              type="button"
              onClick={() =>
                setEditorTarget({
                  mode: "create",
                  parentId: contentNode.id,
                  kind: "PAGE",
                  scope,
                  ownerId,
                })
              }
              className={toolBtn}
            >
              <IconPlus className="h-4 w-4" /> Файл
            </button>
            <button
              type="button"
              onClick={() =>
                setImportTree({
                  parentId: contentNode.id,
                  parentName: contentNode.name,
                  scope,
                  ownerId: ownerId ?? null,
                })
              }
              className={toolBtn}
              title="Вставить готовое дерево из Google Docs или со скриншота"
            >
              <IconPlus className="h-4 w-4" /> Структура
            </button>
            <button
              type="button"
              onClick={() => openEditor(contentNode)}
              className={toolBtn}
            >
              <IconPencil className="h-4 w-4" /> Переименовать
            </button>
            <button
              type="button"
              onClick={() => setNeedsFix([contentNode], !contentNode.needsFix)}
              disabled={moving}
              className={cn(
                toolBtn,
                contentNode.needsFix
                  ? "border-rose-400 bg-rose-500/10 text-rose-500"
                  : "hover:border-rose-400 hover:text-rose-500",
              )}
            >
              <span aria-hidden>🔴</span>
              {contentNode.needsFix ? "Снять отметку" : "Нужно исправить"}
            </button>
            <button
              type="button"
              onClick={() => deleteNodes([contentNode])}
              className={cn(toolBtn, "hover:border-rose-400 hover:text-rose-500")}
              title={`Удалить «${contentNode.name}» со всем содержимым`}
            >
              Удалить
            </button>
          </div>
        )}

        {isPhrasePage && selected && (
          <>
            {/* Выгрузка доступна и учителю, и ученику — если она ему открыта. */}
            {(editable || canExport) && hasContent(selected) && (
              <div className="mb-4 flex">
                <button
                  type="button"
                  onClick={() => setExportPage(selected)}
                  className={toolBtn}
                  title="Текстовая версия страницы: скопировать или скачать .docx"
                >
                  <IconFile className="h-4 w-4" /> Выгрузить в текст / .docx
                </button>
              </div>
            )}
            {editable && (
              <div className="mb-4 flex flex-wrap gap-2">
                {scope !== "MISTAKE" && (
                  <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm">
                    <span className="text-[11px] font-semibold text-faint">Тип файла</span>
                    <select
                      value={pageKind(selected) ?? ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "VOCAB" || next === "RULE") {
                          setKindChange({ node: selected, next });
                        }
                      }}
                      disabled={moving}
                      className="h-7 rounded-lg bg-surface-2 px-2 text-xs font-bold text-content outline-none ring-1 ring-line focus:ring-accent disabled:opacity-50"
                    >
                      <option value="" disabled>Не определён</option>
                      <option value="VOCAB">Словарь</option>
                      <option value="RULE">Правило</option>
                    </select>
                  </label>
                )}
                {/* Пока страница пустая — предлагаем оба способа наполнения.
                    Дальше она помнит, чем стала, и показывает своё. */}
                {pageKind(selected) === "VOCAB" && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddWordsTo({
                        id: selected.id,
                        name: selected.name,
                        translationLang: selected.translationLang,
                      })
                    }
                    className={pageBtn}
                  >
                    <IconPlus className="h-4 w-4" /> Дополнить
                  </button>
                )}

                {pageKind(selected) !== "RULE" && (
                  <button
                    type="button"
                    onClick={() => setImportNode({ id: selected.id, name: selected.name })}
                    className={pageBtn}
                    title={
                      pageKind(selected) === "VOCAB"
                        ? "Разобрать текст заново, заменив содержимое"
                        : undefined
                    }
                  >
                    {pageKind(selected) === "VOCAB" ? (
                      "Заменить текстом"
                    ) : (
                      <>
                        <IconPlus className="h-4 w-4" /> Словник из текста
                      </>
                    )}
                  </button>
                )}

                {pageKind(selected) === "VOCAB" && (
                  <button
                    type="button"
                    onClick={() => setVocabularyEditNode(selected)}
                    className={pageBtn}
                  >
                    <IconPencil className="h-4 w-4" /> Редактировать
                  </button>
                )}

                {pageKind(selected) === "VOCAB" && (
                  <button
                    type="button"
                    onClick={() => repairPhraseIcons(selected)}
                    disabled={moving || selected.phrases.length === 0}
                    className={pageBtn}
                    title="Подобрать каждой записи новую иконку по слову, переводу, категории и примерам"
                  >
                    <span aria-hidden>✨</span> Исправить иконки
                  </button>
                )}

                {pageKind(selected) === "VOCAB" && (
                  <VocabularyCoverActions
                    nodeId={selected.id}
                    currentUrl={selected.imageUrl}
                  />
                )}

                {pageKind(selected) === "RULE" && (
                  <button
                    type="button"
                    onClick={() => setRuleEditNode(selected)}
                    className={pageBtn}
                  >
                    <IconPencil className="h-4 w-4" /> Редактировать
                  </button>
                )}

                {(pageKind(selected) === "VOCAB" || pageKind(selected) === "RULE") && (
                  <button
                    type="button"
                    onClick={() => reformatPage(selected)}
                    disabled={moving || !selected.sourceText?.trim()}
                    className={pageBtn}
                    title={
                      selected.sourceText?.trim()
                        ? `Заново разобрать исходник как ${pageKind(selected) === "RULE" ? "правило" : "словарь"}`
                        : "У файла не сохранён исходный текст"
                    }
                  >
                    <span aria-hidden>↻</span> Переформатировать
                  </button>
                )}

                {pageKind(selected) !== "VOCAB" && (
                  <button
                    type="button"
                    onClick={() =>
                      setRuleNode({
                        id: selected.id,
                        name: selected.name,
                        icon: selected.icon,
                      })
                    }
                    className={pageBtn}
                  >
                    <IconPlus className="h-4 w-4" />
                    {pageKind(selected) === "RULE" ? "Вставить заново" : "Вставить правило"}
                  </button>
                )}

                <div className="flex h-10 items-center gap-1 rounded-xl border border-line px-1.5">
                    <span className="px-1.5 text-[11px] font-semibold text-faint">Перевод</span>
                    {(["UK", "RU"] as const).map((language) => (
                      <button
                        key={language}
                        type="button"
                        onClick={() => translatePage(selected, language)}
                        disabled={moving || selected.translationLang === language}
                        title={
                          selected.translationLang === language
                            ? "Текущий язык перевода"
                            : `Заменить перевод всей страницы на ${language === "UK" ? "украинский" : "русский"}`
                        }
                        className={cn(
                          "h-7 rounded-lg px-2 text-xs font-bold transition disabled:opacity-50",
                          selected.translationLang === language
                            ? "bg-accent text-white"
                            : "text-muted hover:bg-surface-2 hover:text-content",
                        )}
                      >
                        {language === "UK" ? "🇺🇦 UA" : "🇷🇺 RU"}
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setNeedsFix([selected], !selected.needsFix)}
                  disabled={moving}
                  className={cn(
                    pageBtn,
                    selected.needsFix
                      ? "border-solid border-rose-400 bg-rose-500/10 text-rose-500"
                      : "hover:border-rose-400 hover:text-rose-500",
                  )}
                >
                  <span aria-hidden>🔴</span>
                  {selected.needsFix ? "Снять отметку" : "Нужно исправить"}
                </button>

                {hasContent(selected) && (
                  <button
                    type="button"
                    onClick={() => clearPages([selected])}
                    title="Страница останется, содержимое пропадёт"
                    className={cn(pageBtn, "hover:border-rose-400 hover:text-rose-500")}
                  >
                    <IconX className="h-4 w-4" /> Очистить
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => deleteNodes([selected])}
                  title="Удалить страницу целиком"
                  className={cn(pageBtn, "hover:border-rose-400 hover:text-rose-500")}
                >
                  Удалить
                </button>
              </div>
            )}
          </>
        )}
        </div>

        {isPhrasePage && selected &&
          (selected.blocks.length > 0 ? (
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
              coverImageUrl={selected.imageUrl}
              phrases={selected.phrases}
              nodeId={selected.id}
              onEditPhrase={editable ? setEditPhrase : undefined}
            />
          ))}

        {!isPhrasePage && !contentNode && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.selectFolder}</p>
        )}

        {!isPhrasePage && contentNode && items.length === 0 && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.emptyFolder}</p>
        )}

        {!isPhrasePage && view === "grid" && items.length > 0 && (
          <div className="material-card-grid">
            {items.map((n) => (
              <div key={n.id} className="material-grid-item group relative">
                {dropLine(n.id, "x")}
                {editable && (
                  <input
                    type="checkbox"
                    checked={selection.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    title="Выбрать"
                    className={cn(
                      "absolute right-2.5 top-2.5 z-10 h-4 w-4 cursor-pointer accent-[var(--accent)] transition",
                      selection.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}
                  />
                )}
              <button
                type="button"
                onClick={(e) => handleOpenClick(e, n, items.map((x) => x.id))}
                {...menuHandlers(n)}
                {...dragProps(n, "x")}
                className={cn(
                  "material-content-card flex w-full flex-col items-start rounded-2xl border text-left transition",
                  n.type === "FOLDER" ? "material-folder-card" : "material-file-card",
                  selection.has(n.id)
                    ? "is-multi-selected ring-2 ring-accent"
                    : selectedId === n.id
                      ? "is-selected"
                      : "",
                  mergedHighlight(n) && "border-amber-400 bg-amber-400/10 ring-1 ring-amber-300",
                  editable && n.formattingIssue && "border-amber-400 bg-amber-400/10 ring-1 ring-amber-300",
                  editable && n.needsFix && "border-rose-400 bg-rose-500/10 ring-1 ring-rose-300",
                  dragId === n.id && "opacity-40",
                  dropRing(n.id),
                )}
              >
                <span className="material-card-visual relative flex w-full items-center justify-between overflow-hidden">
                  {n.type === "FOLDER" ? (
                    <IconFolder className="material-folder-watermark" />
                  ) : (
                    <IconFile className="material-file-watermark" />
                  )}
                  {iconSlot(
                    n,
                    "material-card-emoji relative z-[1] flex h-12 w-12 items-center justify-center rounded-2xl text-2xl leading-none",
                    n.type === "FOLDER" ? "📁" : "📄",
                  )}
                  {n.type === "FOLDER" && (
                    <IconChevronRight className="relative z-[1] h-5 w-5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-content" />
                  )}
                  {n.type === "FILE" && mergedMarker(n)}
                </span>
                <span className="mt-3 w-full truncate text-sm font-bold text-content">
                  {n.name}
                </span>
                {pageTypeMarker(n)}
                {editable && (n.formattingIssue || n.formattingScanIgnored || n.needsFix) && (
                  <span className="mt-1 flex w-full items-center justify-between gap-2">
                    {formattingMarker(n)}
                    {fixMarker(n)}
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                  {n.type === "FOLDER" ? (
                    <>
                      <IconFolder className="h-3.5 w-3.5" />
                      {fmt(t.materials.itemsCount, { n: countFiles(n) })}
                    </>
                  ) : (
                    <>
                      <IconFile className="h-3.5 w-3.5" />
                      {[n.fileKind, n.sizeLabel].filter(Boolean).join(" · ") || "Материал"}
                    </>
                  )}
                </span>
              </button>
              </div>
            ))}
          </div>
        )}

        {!isPhrasePage && view === "list" && items.length > 0 && (
          <div className="flex flex-col divide-y divide-line">
            {items.map((n) => (
              <div key={n.id} className="group relative flex items-center gap-2">
                {dropLine(n.id)}
                {selectBox(n)}
              <button
                type="button"
                onClick={(e) => handleOpenClick(e, n, items.map((x) => x.id))}
                {...menuHandlers(n)}
                {...dragProps(n)}
                className={cn(
                  "material-list-row flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2.5 text-left transition",
                  n.type === "FOLDER" ? "is-folder" : "is-file",
                  selection.has(n.id) && "is-selected",
                  mergedHighlight(n) && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
                  editable && n.formattingIssue && "bg-amber-400/15 ring-1 ring-inset ring-amber-400",
                  editable && n.needsFix && "bg-rose-500/10 ring-1 ring-inset ring-rose-400",
                  dragId === n.id && "opacity-40",
                  dropRing(n.id),
                )}
              >
                {n.icon &&
                  iconSlot(
                    n,
                    "material-node-emoji flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base leading-none",
                  )}
                {kindMarker(n)}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-content">
                  {n.name}
                </span>
                {pageTypeMarker(n)}
                {mergedMarker(n)}
                {formattingMarker(n)}
                {fixMarker(n)}
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
              </div>
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
              editorTarget?.mode === "edit" ? `edit-${editorTarget.nodeId}` : "editor-idle"
            }
            target={editorTarget?.mode === "edit" ? editorTarget : null}
            onClose={() => setEditorTarget(null)}
          />
          <NodeCreator
            key={
              editorTarget?.mode === "create"
                ? `create-${editorTarget.parentId ?? "root"}-${editorTarget.kind}`
                : "creator-idle"
            }
            target={editorTarget?.mode === "create" ? editorTarget : null}
            onClose={() => setEditorTarget(null)}
          />
          <TreeImporter
            key={
              importTree ? `tree-${importTree.parentId ?? "root"}` : "tree-idle"
            }
            target={importTree}
            onClose={() => setImportTree(null)}
            onDone={setNotice}
          />
          <ContentImporter
            key={importNode ? `import-${importNode.id}` : "import-idle"}
            node={importNode}
            onClose={closeImporter}
            scope={scope}
          />
          <RuleImporter
            key={ruleNode ? `rule-${ruleNode.id}` : "rule-idle"}
            node={ruleNode}
            onClose={closeImporter}
          />

          <WordAdder
            key={addWordsTo ? `add-${addWordsTo.id}` : "add-idle"}
            node={addWordsTo}
            sections={pageSections}
            onClose={() => setAddWordsTo(null)}
          />
          <PhraseEditor
            key={editPhrase ? `phrase-${editPhrase.id}` : "phrase-idle"}
            phrase={editPhrase}
            sections={pageSections}
            translationLang={selected?.translationLang ?? "UK"}
            onClose={() => setEditPhrase(null)}
          />
          <RuleEditor
            key={ruleEditNode ? `ruleedit-${ruleEditNode.id}` : "ruleedit-idle"}
            node={ruleEditNode}
            onClose={() => setRuleEditNode(null)}
          />
          <VocabularyEditor
            key={vocabularyEditNode ? `vocabedit-${vocabularyEditNode.id}` : "vocabedit-idle"}
            node={vocabularyEditNode}
            onClose={() => setVocabularyEditNode(null)}
          />

          {kindChange && (
            <Modal
              open
              onClose={() => setKindChange(null)}
              title={`Изменить тип на «${pageKindLabel(kindChange.next)}»?`}
              icon={<IconMaterials className="h-5 w-5" />}
            >
              <div className="flex flex-col gap-4">
                <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-content">
                  {kindChange.node.icon} <b>{kindChange.node.name}</b>
                  <span className="mt-1 block text-xs text-muted">
                    Сейчас: {pageKind(kindChange.node) ? pageKindLabel(pageKind(kindChange.node)!) : "тип не определён"}
                    {" → "}{pageKindLabel(kindChange.next)}
                  </span>
                </p>

                {kindChange.node.sourceText?.trim() ? (
                  <p className="text-sm leading-relaxed text-muted">
                    Сохранённый исходник будет заново разобран как {pageKindLabel(kindChange.next).toLowerCase()}.
                    Текущее разобранное содержимое заменится только после успешного результата;
                    сам исходник останется сохранён.
                  </p>
                ) : hasContent(kindChange.node) ? (
                  <p className="rounded-xl bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700">
                    У заполненного файла нет сохранённого исходника, поэтому безопасно
                    перепарсить его в другой тип сейчас нельзя. Сначала вставь исходный текст заново.
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    Файл пустой, поэтому будет изменён только его тип.
                  </p>
                )}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setKindChange(null)}
                    disabled={moving}
                    className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                  {(kindChange.node.sourceText?.trim() || !hasContent(kindChange.node)) && (
                    <button
                      type="button"
                      onClick={() => applyKindChange(!!kindChange.node.sourceText?.trim())}
                      disabled={moving}
                      className="h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {kindChange.node.sourceText?.trim()
                        ? "Сменить и перепарсить"
                        : "Сменить тип"}
                    </button>
                  )}
                </div>
              </div>
            </Modal>
          )}

          {copyNodes && copyNodes.length > 0 && (
            <CopyDialog
              sources={copyNodes.map(toCopySource)}
              onClose={() => setCopyNodes(null)}
              onDone={(message) => {
                setSelection(new Set());
                setNotice(message);
              }}
            />
          )}

          {bulkIcons && (
            <BulkIconEditor
              nodes={selectedNodes.map((n) => ({ id: n.id, name: n.name, icon: n.icon }))}
              onClose={() => setBulkIcons(false)}
            />
          )}

          {/* Очередь наполнения: тип выбираем для каждой страницы отдельно —
              в одной партии бывают и словники, и правила. */}
          {askFillKind && queueNode && (
            <Modal
              open
              onClose={() => setFillQueue(null)}
              title={`Наполнить ${fillQueue!.index + 1} из ${fillQueue!.ids.length}`}
              icon={<IconMaterials className="h-5 w-5" />}
            >
              <div className="flex flex-col gap-4">
                <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-content">
                  {queueNode.icon} <span className="font-semibold">{queueNode.name}</span>
                </p>
                <p className="text-sm text-muted">Чем заполнить эту страницу?</p>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setImportNode({ id: queueNode.id, name: queueNode.name })}
                    className="rounded-xl border border-line p-3 text-left transition hover:border-accent hover:bg-surface-2"
                  >
                    <span className="block text-sm font-semibold text-content">
                      {scope === "MISTAKE" ? "Ошибка" : "Словник"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      разбор текста из Google Docs
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRuleNode({
                        id: queueNode.id,
                        name: queueNode.name,
                        icon: queueNode.icon,
                      })
                    }
                    className="rounded-xl border border-line p-3 text-left transition hover:border-accent hover:bg-surface-2"
                  >
                    <span className="block text-sm font-semibold text-content">Правило</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      вставка с разметкой — таблицы и врезки сохранятся
                    </span>
                  </button>
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFillQueue(null)}
                    className="h-11 flex-1 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-surface-2"
                  >
                    Прервать
                  </button>
                  <button
                    type="button"
                    onClick={closeImporter}
                    className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-semibold text-content transition hover:opacity-90"
                  >
                    Пропустить
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {/* ---------- Панель группового выбора ---------- */}
      {editable && selection.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface px-3 py-2.5 shadow-xl ring-1 ring-line">
          <span className="px-1.5 text-sm font-semibold text-content">
            Выбрано: {selection.size}
          </span>
          <button
            type="button"
            onClick={() => setCopyNodes(selectedNodes)}
            className="h-9 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Копировать в…
          </button>
          <button
            type="button"
            onClick={() => setBulkIcons(true)}
            className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-content transition hover:bg-surface-2"
          >
            Иконки
          </button>
          <button
            type="button"
            onClick={() => {
              const clear = selectedNodes.every((node) => node.needsFix);
              setNeedsFix(selectedNodes, !clear);
            }}
            disabled={moving}
            className={cn(
              "h-9 rounded-xl border px-3.5 text-sm font-semibold transition",
              selectedNodes.every((node) => node.needsFix)
                ? "border-rose-400 bg-rose-500/10 text-rose-500"
                : "border-line text-content hover:border-rose-400 hover:text-rose-500",
            )}
          >
            🔴 {selectedNodes.every((node) => node.needsFix) ? "Снять отметку" : "Нужно исправить"}
          </button>
          <button
            type="button"
            disabled={fillablePages.length === 0}
            title={
              fillablePages.length === 0
                ? "Наполнять можно только страницы, не папки"
                : undefined
            }
            onClick={() => setFillQueue({ ids: fillablePages.map((n) => n.id), index: 0 })}
            className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-content transition hover:bg-surface-2 disabled:opacity-40"
          >
            Наполнить ({fillablePages.length})
          </button>
          {selectedNodes.some(hasContent) && (
            <button
              type="button"
              onClick={() => clearPages(selectedNodes)}
              title="Страницы останутся, содержимое пропадёт"
              className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-content transition hover:bg-surface-2"
            >
              Очистить ({selectedNodes.filter(hasContent).length})
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteNodes(selectedNodes)}
            title="Delete"
            className="h-9 rounded-xl px-3.5 text-sm font-semibold text-rose-500 transition hover:bg-surface-2"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            title="Escape"
            className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
          >
            Снять выделение
          </button>
          <span className="hidden px-1 text-[10px] leading-tight text-faint sm:block">
            Del — удалить
            <br />
            Ctrl+клик — диапазон
          </span>
        </div>
      )}

      <ExportDialog
        key={exportPage ? `export-${exportPage.id}` : "export-idle"}
        page={
          exportPage && {
            title: exportPage.name,
            description: exportPage.description,
            phrases: exportPage.phrases,
            blocks: exportPage.blocks,
          }
        }
        onClose={() => setExportPage(null)}
      />

      {contextMenu}

      {(moving || moveError || notice) && (
        <div
          className={cn(
            "fixed left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xl",
            // Не наезжаем на панель группового выбора.
            selection.size > 0 ? "bottom-20" : "bottom-5",
            moveError ? "bg-rose-500 text-white" : "bg-surface text-content ring-1 ring-line",
          )}
        >
          {moveError ?? notice ?? "Переношу…"}
        </div>
      )}
    </div>
  );
}
