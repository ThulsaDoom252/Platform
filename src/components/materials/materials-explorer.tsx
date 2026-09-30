"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLocalNumber } from "@/lib/use-local-number";
import { useLocalJson } from "@/lib/use-local-json";
import {
  descendantIds,
  selectRangeDeep,
  toggleWithChildren,
} from "@/lib/tree-selection";
import {
  DEFAULT_SORT,
  MAX_PRESETS,
  captureOrder,
  siblingsOf,
  sortInsideRoots,
  type SortMode,
  type TreePreset,
} from "@/lib/tree-sort";
import { TreeSorter } from "./tree-sorter";
import { ImageEditor } from "./image-editor";
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
  IconTrash,
  IconSearch,
  IconCap,
} from "@/components/icons";
import { Modal } from "@/components/modal";

import { PhraseReader, type MaterialPhrase } from "./phrase-reader";
import type { MaterialVerb } from "@/lib/materials";
import { RuleReader } from "./rule-reader";
import type { RuleBlock } from "@/lib/rule-parser";
import { NodeEditor, type EditorTarget, type TreeScope } from "./node-editor";
import { NodeCreator } from "./node-creator";
import { TreeImporter, type ImportTarget } from "./tree-importer";
import { FillFromDialog, type FillTarget } from "./fill-from-dialog";
import { VerbsReader } from "./verbs-reader";
import { VerbsShareDialog, type ShareVerbsTarget } from "./verbs-share-dialog";
import { VerbsFiller, type VerbsTarget } from "./verbs-filler";
import { ContentImporter } from "./content-importer";
import { PhraseImagesPanel } from "./phrase-images-panel";
import { RevisionSetup } from "@/components/revision/revision-setup";
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
  restoreMaterialContentAction,
  clearFolderAction,
  clearVerbsAction,
  clearPagesAction,
  deleteNodeAction,
  deleteNodesAction,
  fillVerbIconsAction,
  moveNodeAction,
  reformatMaterialPageAction,
  setVocabularyImageScaleAction,
  repairPhraseIconsAction,
  reorderNodeAction,
  reorderVerbGroupsAction,
  setMaterialsNeedsFixAction,
  translateMaterialPageAction,
} from "@/lib/actions/materials";

/** Ширина панели дерева: по умолчанию и допустимые пределы. */
const TREE_WIDTH_DEFAULT = 400;
const TREE_WIDTH_MIN = 280;
const TREE_WIDTH_MAX = 760;

/**
 * Обычная ширина для текущего экрана.
 *
 * До перетаскивания вёрстка давала 360 на обычном мониторе и 400 на
 * широком — возвращаем ровно это, а на совсем больших добавляем ещё,
 * потому что места там не жалко.
 */
function defaultTreeWidth(): number {
  if (typeof window === "undefined") return TREE_WIDTH_DEFAULT;
  const w = window.innerWidth;
  if (w >= 1920) return 480;
  if (w >= 1280) return 400;
  return 360;
}

const clampTreeWidth = (value: number) =>
  Math.round(Math.min(TREE_WIDTH_MAX, Math.max(TREE_WIDTH_MIN, value)));

/** Есть ли на странице что чистить: словник или разобранное правило. */
const hasContent = (n: MaterialNode) => n.phrases.length > 0 || n.blocks.length > 0;

/** То же, но с глаголами: у их страниц содержимое лежит отдельно. */
const hasAnything = (n: MaterialNode) => hasContent(n) || n.verbs.length > 0;

/**
 * Чем страница была заполнена. У страниц, созданных до появления поля,
 * тип выводим из содержимого — переносить данные ради этого не нужно.
 */
/** Страница неправильных глаголов — по типу или по уже залитым глаголам. */
const isVerbsPage = (n: MaterialNode) =>
  n.type === "FILE" && (n.pageKind === "VERBS" || n.verbs.length > 0);

/**
 * Как страница устроена внутри: словником или блоками.
 *
 * Лексика и времена — это те же блоки, что и у правила: одно хранилище,
 * одна читалка, один способ вставки. Отличается только разбор, поэтому
 * здесь они и считаются правилом.
 */
const pageKind = (n: MaterialNode): "VOCAB" | "RULE" | null =>
  n.pageKind === "RULE" || n.pageKind === "LEXIS" || n.pageKind === "TENSE"
    ? "RULE"
    : n.pageKind === "VOCAB"
      ? "VOCAB"
      : n.blocks.length > 0
        ? "RULE"
        : n.phrases.length > 0
          ? "VOCAB"
          : null;

/** Чем страница является для учителя — это и пишем на бейдже. */
const pageFlavour = (n: MaterialNode): PageFlavour | null =>
  n.pageKind === "LEXIS" || n.pageKind === "TENSE" ? n.pageKind : pageKind(n);

type PageFlavour = "VOCAB" | "RULE" | "LEXIS" | "TENSE";

const FLAVOUR_LABEL: Record<PageFlavour, string> = {
  VOCAB: "Словарь",
  RULE: "Правило",
  LEXIS: "Лексика",
  TENSE: "Время",
};

const pageKindLabel = (kind: PageFlavour) => FLAVOUR_LABEL[kind];

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
  mergeCount: number;
  /** Размер картинок слов в процентах; 100 — обычный. */
  imageScale: number;
  sourceText: string | null;
  /** Когда снят снимок перед перестройкой. Пусто — отменять нечего. */
  contentBackupAt: string | null;
  /** Когда раздел завели: по этому сортируется «порядок добавления». */
  createdAt: string;
  /** Неправильные глаголы, если страница про них. */
  verbs: MaterialVerb[];
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

function collectFolderIds(nodes: MaterialNode[], acc: string[] = []) {
  for (const node of nodes) {
    if (node.type !== "FOLDER") continue;
    acc.push(node.id);
    collectFolderIds(node.children, acc);
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
  ownerName,
  emptyText,
  canExport = false,
  initialNodeId,
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
  /** Его имя — нужно там, где ему что-то выдают. */
  ownerName?: string;
  /** Выгрузка страницы в текст и docx. Учитель может её отключить ученику. */
  canExport?: boolean;
  /** Узел, к которому привёл глобальный поиск. */
  initialNodeId?: string;
}) {
  const { t } = useT();
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [importNode, setImportNode] = useState<{
    id: string;
    name: string;
    sourceText?: string | null;
  } | null>(null);
  const [ruleNode, setRuleNode] = useState<{
    id: string;
    name: string;
    icon: string | null;
    sourceText?: string | null;
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
  const [fillFrom, setFillFrom] = useState<FillTarget | null>(null);
  const [fillVerbs, setFillVerbs] = useState<VerbsTarget | null>(null);
  const [shareVerbs, setShareVerbs] = useState<ShareVerbsTarget | null>(null);
  const [exportPage, setExportPage] = useState<MaterialNode | null>(null);
  const [editPhrase, setEditPhrase] = useState<MaterialPhrase | null>(null);
  /** Картинка, которую сейчас правят. */
  const [editImage, setEditImage] = useState<MaterialNode | null>(null);
  /**
   * Ширина панели дерева. Названия у разделов разной длины: одному
   * экрана хватает, другому нет — поэтому размер подбирает учитель, а
   * не вёрстка. Значение своё на каждом устройстве.
   */
  const [treeWidth, setTreeWidth] = useLocalNumber(
    "materials-tree-width",
    TREE_WIDTH_DEFAULT,
  );
  /**
   * Порядок дерева. Это взгляд, а не запись: ручной порядок разделов
   * лежит в базе и остаётся нетронутым, к нему возвращает «Свой порядок».
   * Настройка своя у каждого дерева — материалы ученика и общая база
   * раскладываются по-разному.
   */
  const sortKey = `materials-sort:${scope}:${ownerId ?? "-"}`;
  const [sortState, setSortState] = useLocalJson<{
    mode: SortMode;
    presetId: string | null;
    presets: TreePreset[];
  }>(sortKey, { mode: DEFAULT_SORT, presetId: null, presets: [] });

  const activePreset = sortState.presetId
    ? sortState.presets.find((p) => p.id === sortState.presetId)
    : undefined;

  const sortedTree = useMemo(
    () => sortInsideRoots(tree, sortState.mode, activePreset?.order),
    [tree, sortState.mode, activePreset],
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  /**
   * Пока тянем за полосу, ширину меняем прямо в разметке: перерисовывать
   * всё дерево на каждое движение мыши незачем. В состояние она уходит
   * один раз, когда полосу отпустили.
   */
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: treeWidth };
  }

  function onResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = clampTreeWidth(
      drag.current.startWidth + event.clientX - drag.current.startX,
    );
    gridRef.current?.style.setProperty("--tree-w", `${next}px`);
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const next = clampTreeWidth(
      drag.current.startWidth + event.clientX - drag.current.startX,
    );
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setTreeWidth(next);
  }

  /** Сохранить нынешнюю расстановку под именем. */
  function savePreset(name: string) {
    if (sortState.presets.length >= MAX_PRESETS) return;
    const preset: TreePreset = {
      id: `p${Date.now().toString(36)}`,
      name,
      savedAt: new Date().toISOString(),
      order: captureOrder(sortedTree),
    };
    setSortState({
      ...sortState,
      presetId: preset.id,
      presets: [...sortState.presets, preset],
    });
  }

  /** Размер картинок словника: хранится у страницы, а не в браузере. */
  function setImageScale(node: MaterialNode, scale: number) {
    startMove(async () => {
      const res = await setVocabularyImageScaleAction(node.id, scale);
      if (res.error) setMoveError(res.error);
      else setNotice(res.message ?? null);
    });
  }

  function resetResize() {
    const next = defaultTreeWidth();
    gridRef.current?.style.setProperty("--tree-w", `${next}px`);
    setTreeWidth(next);
  }

  // Редкие действия свёрнуты: на панели должно остаться то, чем
  // пользуются каждый урок.
  const [moreTools, setMoreTools] = useState(false);
  const [picturesFor, setPicturesFor] = useState<MaterialNode | null>(null);
  const [revisionFor, setRevisionFor] = useState<MaterialNode | null>(null);
  const [kindChange, setKindChange] = useState<{
    node: MaterialNode;
    next: PageFlavour;
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
    walk(sortedTree, []);
    return { byId, pathById };
  }, [sortedTree]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        initialNodeId && pathById.has(initialNodeId)
          ? pathById
              .get(initialNodeId)!
              .filter((node) => node.type === "FOLDER")
              .map((node) => node.id)
          : tree.length
            ? [tree[0].id]
            : [],
      ),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNodeId && byId.has(initialNodeId) ? initialNodeId : (tree[0]?.id ?? null),
  );
  const [view, setView] = useState<"grid" | "list" | "interactive">("grid");
  const [pathOpen, setPathOpen] = useState(true);
  const pathOpenBeforeInteractive = useRef(true);
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
  /** Отмеченное как есть; наружу отдаётся очищенный от призраков selection. */
  const [rawSelection, setSelection] = useState<Set<string>>(new Set());
  /** Точка отсчёта диапазона — последний элемент, тронутый без Ctrl. */
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [bulkIcons, setBulkIcons] = useState(false);
  /** Очередь наполнения: по выбранным страницам идём одна за другой. */
  const [fillQueue, setFillQueue] = useState<{ ids: string[]; index: number } | null>(null);

  /*
   * Дерево могло перестроиться (перенос, удаление), и в выборе остаются
   * призраки. Раньше их вычищал эффект, но это лишний проход отрисовки и
   * короткое окно, в котором выбор уже неверен. Теперь просто не считаем
   * выбранным то, чего в дереве нет.
   */
  const selection = useMemo(
    () => new Set([...rawSelection].filter((id) => byId.has(id))),
    [rawSelection, byId],
  );

  /**
   * Связи всего дерева плоским списком.
   *
   * Дерево хранится вложенным, а выбор считает по «кто чей родитель» —
   * обходим один раз и дальше работаем с плоским.
   */
  const links = useMemo(() => {
    const out: { id: string; parentId: string | null }[] = [];
    const walk = (list: MaterialNode[], parentId: string | null) => {
      for (const node of list) {
        out.push({ id: node.id, parentId });
        if (node.children.length) walk(node.children, node.id);
      }
    };
    walk(tree, null);
    return out;
  }, [tree]);

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

  function changeView(next: "grid" | "list" | "interactive") {
    if (next === "interactive") {
      pathOpenBeforeInteractive.current = pathOpen;
      setPathOpen(false);
      setSelectedId(null);
      setAnchorId(null);
    } else if (view === "interactive") {
      setPathOpen(pathOpenBeforeInteractive.current);
      setSelectedId((current) => current ?? sortedTree[0]?.id ?? null);
    }
    setView(next);
  }

  function openInteractiveRoot() {
    setSelectedId(null);
    setAnchorId(null);
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

  /**
   * Перестановка перетаскиванием.
   *
   * Работает при любой включённой сортировке. Вместе с переносом уходит
   * порядок соседей, каким он был на экране: иначе «после вот этого»
   * означало бы место в хранимом порядке, а он при сортировке другой.
   *
   * После этого вид переключается на свой порядок — учитель сложил
   * расстановку руками и должен её увидеть. Любая сортировка из меню
   * снова разложит всё по своему правилу, а расстановку можно сохранить.
   */
  function performReorder(nodeId: string, targetId: string, where: "before" | "after") {
    finishDrag();
    const seen = siblingsOf(sortedTree, targetId);

    startMove(async () => {
      const res = await reorderNodeAction(nodeId, targetId, where, seen);
      if (res.error) {
        setMoveError(res.error);
        return;
      }
      if (sortState.mode !== "manual" || sortState.presetId) {
        setSortState({ ...sortState, mode: "manual", presetId: null });
      }
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

  /** Обычное нажатие: папка берётся вместе со всем, что внутри. */
  function toggleSelect(id: string) {
    setAnchorId(id);
    setSelection((prev) => toggleWithChildren(prev, links, id));
  }

  /**
   * Нажатие по кружку.
   *
   * С Ctrl добирается всё между прошлым нажатием и нынешним, без него —
   * один узел со своим содержимым. Точка отсчёта не сдвигается при
   * протяжке: иначе следующий Ctrl мерил бы уже от другого места.
   */
  function pickNode(e: React.MouseEvent, id: string, order: string[]) {
    e.stopPropagation();
    e.preventDefault();

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelection((prev) => selectRangeDeep(prev, links, order, anchorId, id));
      return;
    }

    toggleSelect(id);
  }

  /**
   * Выделяет всё от точки отсчёта до указанного элемента.
   * Порядок передаёт тот список, в котором кликнули: дерево и правая
   * панель расположены по-разному, диапазон считается внутри своего.
   */
  function selectRange(order: string[], toId: string) {
    setSelection((prev) => selectRangeDeep(prev, links, order, anchorId, toId));
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

  /**
   * Кружок выбора.
   *
   * У папки он закрашен наполовину, когда внутри отмечено не всё: так
   * видно, что ветка тронута, хотя сама папка не выбрана.
   */
  const selectBox = (n: MaterialNode, order: string[] = treeOrder) => {
    if (!editable) return null;

    const on = selection.has(n.id);
    const inside = n.type === "FOLDER" ? descendantIds(links, n.id) : [];
    const partly = !on && inside.some((id) => selection.has(id));

    return (
      <button
        type="button"
        onClick={(e) => pickNode(e, n.id, order)}
        onDoubleClick={(e) => e.stopPropagation()}
        aria-pressed={on}
        title="Выбрать · Ctrl — до этого места"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
          on
            ? "border-accent bg-accent"
            : partly
              ? "border-accent bg-accent/30"
              : "border-faint hover:border-accent",
          selection.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </button>
    );
  };

  const selectedNodes = [...selection]
    .map((id) => byId.get(id))
    .filter((n): n is MaterialNode => !!n);

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

  /** Заново подобрать смысловые иконки всем словам открытого словаря. */
  /** Сохранить порядок групп неправильных глаголов после перетаскивания. */
  function reorderVerbGroups(node: MaterialNode, order: (string | null)[]) {
    startMove(async () => {
      const res = await reorderVerbGroupsAction(node.id, order);
      if (res.error) setMoveError(res.error);
    });
  }

  /** Подобрать иконки глаголам без них: всей странице или одной группе. */
  function fillVerbIcons(node: MaterialNode, category?: string | null) {
    setNotice("Подбираю иконки глаголам…");
    startMove(async () => {
      const res = await fillVerbIconsAction(node.id, category);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Иконки подобраны");
      }
    });
  }

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
  /** Страницы, которые есть из чего пересобрать. */
  const canReformat = (node: MaterialNode) =>
    node.type === "FILE" && !!node.sourceText?.trim() && hasContent(node);

  function reformatPage(node: MaterialNode) {
    const kind = pageFlavour(node);
    if (!kind) return;
    const label = pageKindLabel(kind).toLowerCase();
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

  /** Убрать со страницы все глаголы. */
  function clearVerbs(node: MaterialNode) {
    if (!confirm(`Убрать все глаголы со страницы «${node.name}»? Это не отменить.`)) return;

    setNotice(`Очищаю «${node.name}»…`);
    startMove(async () => {
      const res = await clearVerbsAction(node.id);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Глаголы убраны");
      }
    });
  }

  /** Убрать из папки всё содержимое, саму папку оставить. */
  function clearFolder(node: MaterialNode) {
    const inside = countFiles(node);
    if (
      !confirm(
        `Очистить «${node.name}»?\n\n` +
          `Всё внутри (${inside === 1 ? "1 материал" : `${inside} материалов`}) уедет в архив — ` +
          "папка останется пустой. Вернуть можно кнопкой восстановления.",
      )
    ) {
      return;
    }

    setNotice(`Очищаю «${node.name}»…`);
    startMove(async () => {
      const res = await clearFolderAction(node.id);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Папка очищена");
      }
    });
  }

  /** Вернуть содержимое страницы к снимку, снятому перед перестройкой. */
  function restorePage(node: MaterialNode) {
    if (!confirm(`Вернуть «${node.name}» к содержимому до перестройки?`)) return;

    setNotice(`Возвращаю «${node.name}»…`);
    startMove(async () => {
      const res = await restoreMaterialContentAction(node.id);
      if (res.error) {
        setNotice(null);
        setMoveError(res.error);
      } else {
        setNotice(res.message ?? "Содержимое возвращено");
      }
    });
  }

  /** Вставить исходник: окно зависит от того, чем страница является. */
  function fillPage(node: MaterialNode) {
    if (isVerbsPage(node)) {
      setFillVerbs({ id: node.id, name: node.name, verbs: node.verbs });
      return;
    }
    if (pageKind(node) === "VOCAB") {
      setImportNode({ id: node.id, name: node.name, sourceText: node.sourceText });
      return;
    }
    // Правило, лексика и время приходят одним окном: разбор выберет себя
    // сам по первой строке исходника.
    setRuleNode({
      id: node.id,
      name: node.name,
      icon: node.icon,
      sourceText: node.sourceText,
    });
  }

  /** Править разобранное содержимое — тоже по виду страницы. */
  function editPage(node: MaterialNode) {
    if (isVerbsPage(node)) {
      setFillVerbs({ id: node.id, name: node.name, verbs: node.verbs });
      return;
    }
    if (pageKind(node) === "VOCAB") {
      setVocabularyEditNode(node);
      return;
    }
    setRuleEditNode(node);
  }

  /** Очистить содержимое, оставив саму страницу. */
  function clearPage(node: MaterialNode) {
    if (isVerbsPage(node)) {
      clearVerbs(node);
      return;
    }
    clearPages([node]);
  }

  /**
   * Переформатировать несколько страниц подряд.
   *
   * Тип каждой определяется её собственным содержимым, поэтому в одном
   * заходе спокойно едут и словники, и правила. Идём по очереди: так
   * понятно, на какой странице что пошло не так.
   */
  function reformatPages(nodes: MaterialNode[]) {
    const pages = nodes.filter(canReformat);
    if (pages.length === 0) return;

    if (
      !confirm(
        [
          `Переформатировать выбранные страницы (${pages.length}) из сохранённых исходников?`,
          "",
          "Каждая разбирается заново по своему типу. Если новый разбор найдёт " +
            "меньше данных, эта страница пропускается без изменений.",
        ].join("\n"),
      )
    ) {
      return;
    }

    setNotice(`Переформатирую страницы (${pages.length})…`);
    startMove(async () => {
      const failed: string[] = [];
      let done = 0;

      for (const node of pages) {
        const res = await reformatMaterialPageAction(node.id);
        if (res.error) failed.push(`${node.name}: ${res.error}`);
        else done++;
      }

      setNotice(done > 0 ? `Переформатировано: ${done}` : null);
      if (failed.length > 0) {
        setMoveError(
          [
            `Не переформатировано: ${failed.length}`,
            ...failed.slice(0, 3),
            ...(failed.length > 3 ? [`…и ещё ${failed.length - 3}`] : []),
          ].join("\n"),
        );
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
    const containsMaterial = hasContent(node) || node.verbs.length > 0;
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

  /**
   * Порядок строк дерева на экране — по нему считается диапазон.
   *
   * Считаем по отсортированному дереву, а не по исходному: на экране
   * строки идут в порядке сортировки, и протяжка должна брать то, что
   * лежит между ними там, а не в порядке из базы.
   */
  const treeOrder = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: MaterialNode[]) => {
      for (const n of nodes) {
        out.push(n.id);
        if (n.children.length && expanded.has(n.id)) walk(n.children);
      }
    };
    walk(sortedTree);
    return out;
  }, [sortedTree, expanded]);

  const modalOpen = !!(
    editorTarget ||
    importNode ||
    ruleNode ||
    bulkIcons ||
    fillQueue ||
    menu
  );

  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // Обработчик пересобирается на каждый рендер, поэтому подписка ставится
  // один раз, а свежую версию ей подкладывает ref (обновляется в эффекте:
  // писать в ref во время рендера нельзя).
  const handleHotkeys = (e: KeyboardEvent) => {
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
      } else if (view === "interactive") {
        openInteractiveRoot();
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

  const hotkeys = useRef(handleHotkeys);
  useEffect(() => {
    hotkeys.current = handleHotkeys;
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => hotkeys.current(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const breadcrumb = selectedId ? pathById.get(selectedId) ?? [] : [];
  // Страница материала (FILE без типа файла) открывается как читалка фраз,
  // а обычный файл (PDF/DOC/MP3) остаётся элементом списка папки.
  const isPhrasePage = selected?.type === "FILE" && !selected.fileKind;
  const contentNode =
    selected?.type === "FILE" ? breadcrumb[breadcrumb.length - 2] ?? null : selected;
  const items = view === "interactive" && !selected
    ? sortedTree
    : contentNode?.children ?? [];
  const folderIds = collectFolderIds(sortedTree);
  const allFoldersExpanded = folderIds.length > 0
    && folderIds.every((id) => expanded.has(id));

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
    const kind = pageFlavour(n);
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
    const isFolder = n.type === "FOLDER";

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
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 text-left",
              isFolder ? "py-2.5" : "py-1.5",
            )}
          >
            {/* Кружок-маркер открытой страницы убран: строка и так
                подсвечена, а рядом с кружком выбора он читался как вторая
                галочка. */}
            {n.icon &&
              iconSlot(
                n,
                cn(
                  "material-node-emoji flex shrink-0 items-center justify-center rounded-lg leading-none",
                  // Папка в дереве всегда чуть крупнее файла — так уровни
                  // читаются с одного взгляда.
                  isFolder ? "h-8 w-8 text-lg" : "h-7 w-7 text-base",
                ),
              )}
            {/* Значок «папка/файл» оставлен только папкам: у файла он ничего
                не добавлял, а место под название отнимал. */}
            {isFolder && kindMarker(n)}
            <span
              className={cn(
                "truncate font-semibold transition",
                isFolder ? "text-[15px] leading-5" : "text-[14px] leading-5",
                isSelected ? "text-accent" : "text-content",
              )}
            >
              {n.name}
            </span>
            {mergedMarker(n)}
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
            {/* Тип страницы в дереве не показываем — он виден в карточках справа. */}
            {mergedMarker(n)}
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
    <div
      ref={gridRef}
      style={{ "--tree-w": `${treeWidth}px` } as React.CSSProperties}
      className={cn(
        "relative grid items-start gap-5",
        view !== "interactive" && pathOpen &&
          "lg:grid-cols-[var(--tree-w)_minmax(0,1fr)]",
      )}
    >
      {/* Полоса между панелью и содержимым: тянуть — менять ширину,
          двойной щелчок — вернуть обычную. На узком экране колонка одна,
          и делить нечего. */}
      {view !== "interactive" && pathOpen && (
        <div
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={resetResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Ширина панели материалов"
          title="Потяни, чтобы изменить ширину. Двойной щелчок — обычная."
          className="group absolute inset-y-0 z-10 hidden w-3 cursor-col-resize touch-none lg:block"
          style={{ left: "calc(var(--tree-w) + 0.35rem)" }}
        >
          <span className="pointer-events-none absolute inset-y-6 left-1/2 w-1 -translate-x-1/2 rounded-full bg-line transition group-hover:bg-accent" />
        </div>
      )}

      {/* ---------- Путь обучения ---------- */}
      <aside
        ref={panelRef}
        className={cn(
          "materials-tree-panel scroll-mt-20 flex flex-col gap-4 rounded-2xl p-3.5 sm:p-4",
          pathOpen && "lg:max-h-[calc(100dvh-6rem)]",
          (!pathOpen || view === "interactive") && "hidden",
        )}
      >
        <div className="flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={togglePathPanel}
            className="flex flex-1 items-center gap-2"
          >
            <IconSprout className="h-4.5 w-4.5 text-accent" />
            <span className="flex-1 text-left text-sm font-bold text-content">
              {t.materials.learningPath}
            </span>
          </button>

          {pathOpen && (
            <TreeSorter
              mode={sortState.mode}
              presetId={sortState.presetId}
              presets={sortState.presets}
              onMode={(mode) => setSortState({ ...sortState, mode, presetId: null })}
              onLoadPreset={(id) => setSortState({ ...sortState, presetId: id })}
              onSavePreset={savePreset}
              onDeletePreset={(id) =>
                setSortState({
                  ...sortState,
                  presetId: sortState.presetId === id ? null : sortState.presetId,
                  presets: sortState.presets.filter((p) => p.id !== id),
                })
              }
            />
          )}

          {pathOpen && folderIds.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(
                allFoldersExpanded ? new Set() : new Set(folderIds),
              )}
              title={allFoldersExpanded ? t.materials.collapseAll : t.materials.expandAll}
              aria-label={allFoldersExpanded ? t.materials.collapseAll : t.materials.expandAll}
              className="flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-black text-faint transition hover:bg-surface-2 hover:text-accent"
            >
              {allFoldersExpanded ? "⊟" : "⊞"}
            </button>
          )}

          {pathOpen && (
            <button
              type="button"
              onClick={resetResize}
              title="Вернуть обычную ширину панели для этого экрана"
              aria-label="Вернуть обычную ширину панели"
              className="hidden h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-accent lg:flex"
            >
              <span aria-hidden className="text-[13px]">⇤⇥</span>
            </button>
          )}

          <button
            type="button"
            onClick={togglePathPanel}
            aria-label={pathOpen ? "Свернуть панель" : "Развернуть панель"}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
          >
            <IconChevronDown
              className={cn("h-4 w-4 transition-transform", !pathOpen && "-rotate-90")}
            />
          </button>
        </div>

        {pathOpen && (
          <div className="materials-tree-scroll min-h-0 flex-1 max-h-[70vh] overflow-y-auto pr-1 lg:max-h-none">
            {sortedTree.map(renderCategory)}
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

      {/* Свёрнутое дерево не отнимает колонку у материала. Вернуть его
          можно одной заметной кнопкой, которая остаётся под рукой даже
          после длинной прокрутки страницы. В интерактивном режиме дерева
          нет по определению, поэтому нет и этой кнопки. */}
      {!pathOpen && view !== "interactive" && (
        <button
          type="button"
          onClick={togglePathPanel}
          title={t.materials.openPanel}
          aria-label={t.materials.openPanel}
          className="fixed bottom-20 left-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-accent text-white shadow-xl ring-4 ring-page/80 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-accent-soft lg:bottom-5 lg:left-[5.25rem]"
        >
          <IconSprout className="h-6 w-6" />
        </button>
      )}

      {/* ---------- Содержимое ---------- */}
      <section
        ref={contentRef}
        className={cn(
          "scroll-mt-36 rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-6 lg:scroll-mt-20",
          editable && selected?.needsFix && "ring-2 ring-rose-400",
        )}
      >
        <div className="relative z-[8] lg:sticky lg:top-16 lg:-mx-6 lg:-mt-6 lg:mb-5 lg:border-b lg:border-line lg:bg-surface/95 lg:px-6 lg:pt-6 lg:pb-1 lg:backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {view === "interactive" && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={openInteractiveRoot}
                  className={cn(
                    "truncate transition",
                    breadcrumb.length === 0
                      ? "font-semibold text-content"
                      : "text-muted hover:text-content",
                  )}
                >
                  root
                </button>
              </span>
            )}
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1">
                {(i > 0 || view === "interactive") && <IconChevronRight className="h-3.5 w-3.5 text-faint" />}
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
              onClick={() => changeView("grid")}
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
              onClick={() => changeView("list")}
              title={t.materials.viewList}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                view === "list" ? "bg-accent text-white" : "text-muted hover:text-content",
              )}
            >
              <IconList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("interactive")}
              title={t.materials.viewInteractive}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                view === "interactive" ? "bg-accent text-white" : "text-muted hover:text-content",
              )}
            >
              <IconMaterials className="h-4 w-4" />
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
              onClick={() =>
                setFillFrom({
                  id: contentNode.id,
                  name: contentNode.name,
                  kind: "FOLDER",
                  scope,
                  ownerId: ownerId ?? null,
                })
              }
              className={toolBtn}
              title="Скопировать сюда файлы и папки из материалов ученика"
            >
              <IconPlus className="h-4 w-4" /> Наполнить из…
            </button>
            <button
              type="button"
              onClick={() => clearFolder(contentNode)}
              disabled={moving || contentNode.children.length === 0}
              className={toolBtn}
              title="Убрать всё содержимое, саму папку оставить"
            >
              <IconTrash className="h-4 w-4" /> Очистить
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

        {isPhrasePage && selected && selected.verbs.length > 0 && (
          <VerbsReader
            verbs={selected.verbs}
            busy={moving}
            lang={selected.translationLang}
            onTranslate={editable ? (language) => translatePage(selected, language) : undefined}
            onReorder={editable ? (order) => reorderVerbGroups(selected, order) : undefined}
            onFillIcons={editable ? (category) => fillVerbIcons(selected, category) : undefined}
            onShare={
              editable
                ? () =>
                    setShareVerbs({
                      id: selected.id,
                      name: selected.name,
                      verbs: selected.verbs,
                    })
                : undefined
            }
            onEdit={
              editable
                ? (category) =>
                    setFillVerbs({
                      id: selected.id,
                      name: selected.name,
                      verbs: selected.verbs,
                      focus: category,
                    })
                : undefined
            }
          />
        )}

        {isPhrasePage && selected && selected.verbs.length === 0 && (
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
                      value={pageFlavour(selected) ?? ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next in FLAVOUR_LABEL) {
                          setKindChange({ node: selected, next: next as PageFlavour });
                        }
                      }}
                      disabled={moving}
                      className="h-7 rounded-lg bg-surface-2 px-2 text-xs font-bold text-content outline-none ring-1 ring-line focus:ring-accent disabled:opacity-50"
                    >
                      <option value="" disabled>Не определён</option>
                      <option value="VOCAB">Словарь</option>
                      <option value="RULE">Правило</option>
                      <option value="LEXIS">Лексика</option>
                      <option value="TENSE">Время</option>
                    </select>
                  </label>
                )}
                {/* Один набор действий на все типы страниц: наполнить,
                    взять готовое, править, перевести, переформатировать,
                    очистить. Остальное живёт под «ещё» — редкое не должно
                    мешать частому. */}
                <button
                  type="button"
                  onClick={() => fillPage(selected)}
                  className={pageBtn}
                  title={
                    selected.sourceText?.trim()
                      ? "Вставить исходник заново — прежний текст уже в окне"
                      : "Вставить исходник: он разберётся по типу файла"
                  }
                >
                  <IconPlus className="h-4 w-4" /> Наполнить
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFillFrom({
                      id: selected.id,
                      name: selected.name,
                      kind: "PAGE",
                      scope,
                      ownerId: ownerId ?? null,
                      pageKind: pageFlavour(selected),
                    })
                  }
                  className={pageBtn}
                  title="Перенести сюда содержимое страницы того же типа"
                >
                  <IconPlus className="h-4 w-4" /> Наполнить из…
                </button>

                <button
                  type="button"
                  onClick={() => editPage(selected)}
                  disabled={moving || !hasAnything(selected)}
                  className={pageBtn}
                  title={
                    hasAnything(selected)
                      ? "Править разобранное содержимое"
                      : "Сначала наполни страницу"
                  }
                >
                  <IconPencil className="h-4 w-4" /> Редактировать
                </button>

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
                  onClick={() => reformatPage(selected)}
                  disabled={moving || !selected.sourceText?.trim()}
                  className={pageBtn}
                  title={
                    selected.sourceText?.trim()
                      ? `Заново разобрать сохранённый исходник как «${pageKindLabel(pageFlavour(selected) ?? "RULE")}»`
                      : "У файла не сохранён исходный текст"
                  }
                >
                  <span aria-hidden>↻</span> Переформатировать
                </button>

                <button
                  type="button"
                  onClick={() => clearPage(selected)}
                  disabled={moving || !hasAnything(selected)}
                  title="Страница останется, содержимое пропадёт"
                  className={cn(pageBtn, "hover:border-rose-400 hover:text-rose-500")}
                >
                  <IconX className="h-4 w-4" /> Очистить
                </button>

                {/* Картинки к словам: нужны игре «Угадай по картинке»,
                    поэтому кнопка стоит у словника, а не в активностях. */}
                {/* Повторение слов выдаётся из словника того ученика,
                    чьи материалы сейчас открыты. */}
                {pageKind(selected) === "VOCAB" && scope === "STUDENT" && ownerId && (
                  <button
                    type="button"
                    onClick={() => setRevisionFor(selected)}
                    className={pageBtn}
                    title={t.revision.assign}
                  >
                    <IconCap className="h-4 w-4" /> {t.revision.title}
                  </button>
                )}

                {pageKind(selected) === "VOCAB" && (
                  <button
                    type="button"
                    onClick={() => setPicturesFor(selected)}
                    className={pageBtn}
                    title={t.pictures.hint}
                  >
                    <IconSearch className="h-4 w-4" /> {t.pictures.find}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMoreTools((v) => !v)}
                  className={cn(pageBtn, moreTools && "border-solid border-accent text-accent")}
                  title="Редкие действия: обложка, иконки, выгрузка, удаление"
                >
                  <IconDots className="h-4 w-4" /> Ещё
                </button>

                {moreTools && (
                  <>
                    {(editable || canExport) && hasAnything(selected) && (
                      <button
                        type="button"
                        onClick={() => setExportPage(selected)}
                        className={pageBtn}
                        title="Текстовая версия страницы: скопировать или скачать .docx"
                      >
                        <IconFile className="h-4 w-4" /> Выгрузить
                      </button>
                    )}

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
                        title="Добавить слова, не трогая уже разобранные"
                      >
                        <IconPlus className="h-4 w-4" /> Дополнить
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

                    {/* Снимок появляется, когда страницу перестроили из
                        исходника. Он и есть защита от потери ручных правок. */}
                    {selected.contentBackupAt && (
                      <button
                        type="button"
                        onClick={() => restorePage(selected)}
                        disabled={moving}
                        className={pageBtn}
                        title={`Вернуть содержимое, каким оно было до перестройки ${new Date(
                          selected.contentBackupAt,
                        ).toLocaleString("ru")}`}
                      >
                        <span aria-hidden>⎌</span> Вернуть прежнее
                      </button>
                    )}

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

                    <button
                      type="button"
                      onClick={() => deleteNodes([selected])}
                      title="Удалить страницу целиком"
                      className={cn(pageBtn, "hover:border-rose-400 hover:text-rose-500")}
                    >
                      Удалить
                    </button>
                  </>
                )}
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
              lang={selected.translationLang === "RU" ? "RU" : "UK"}
            />
          ) : (
            <PhraseReader
              title={selected.name}
              icon={selected.icon}
              description={selected.description}
              coverImageUrl={selected.imageUrl}
              phrases={selected.phrases}
              nodeId={selected.id}
              imageScale={selected.imageScale}
              onEditPhrase={editable ? setEditPhrase : undefined}
              onImageScale={
                editable ? (scale) => setImageScale(selected, scale) : undefined
              }
              onEditImage={
                editable && selected.imageUrl ? () => setEditImage(selected) : undefined
              }
            />
          ))}

        {!isPhrasePage && !contentNode && view !== "interactive" && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.selectFolder}</p>
        )}

        {!isPhrasePage && (contentNode || view === "interactive") && items.length === 0 && (
          <p className="py-16 text-center text-sm text-faint">{t.materials.emptyFolder}</p>
        )}

        {!isPhrasePage && (view === "grid" || view === "interactive") && items.length > 0 && (
          <div className="material-card-grid">
            {items.map((n) => (
              <div key={n.id} className="material-grid-item group relative">
                {dropLine(n.id, "x")}
                {editable && (
                  <span className="absolute right-2.5 top-2.5 z-10">
                    {selectBox(n, items.map((x) => x.id))}
                  </span>
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
                {editable && n.needsFix && (
                  <span className="mt-1 flex w-full items-center justify-between gap-2">
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
          <VerbsShareDialog
            key={shareVerbs ? "verbs-share-" + shareVerbs.id : "verbs-share-idle"}
            target={shareVerbs}
            onClose={() => setShareVerbs(null)}
            onDone={(message) => setNotice(message)}
          />
          <VerbsFiller
            key={fillVerbs ? "verbs-" + fillVerbs.id : "verbs-idle"}
            target={fillVerbs}
            onClose={() => setFillVerbs(null)}
            onDone={(message) => setNotice(message)}
          />
          <FillFromDialog
            key={fillFrom ? `fill-${fillFrom.id}` : "fill-idle"}
            target={fillFrom}
            onClose={() => setFillFrom(null)}
            onDone={(message) => setNotice(message)}
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
                    Сейчас: {pageFlavour(kindChange.node) ? pageKindLabel(pageFlavour(kindChange.node)!) : "тип не определён"}
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
          {selectedNodes.some(canReformat) && (
            <button
              type="button"
              onClick={() => reformatPages(selectedNodes)}
              disabled={moving}
              title="Каждая страница разбирается заново по своему типу"
              className="h-9 rounded-xl border border-line px-3.5 text-sm font-semibold text-content transition hover:bg-surface-2 disabled:opacity-40"
            >
              ↻ Переформатировать ({selectedNodes.filter(canReformat).length})
            </button>
          )}
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
        nodeId={exportPage?.id ?? null}
        page={
          exportPage && {
            title: exportPage.name,
            description: exportPage.description,
            phrases: exportPage.phrases,
            blocks: exportPage.blocks,
            lang: exportPage.translationLang === "RU" ? ("RU" as const) : ("UK" as const),
            sourceText: exportPage.sourceText,
          }
        }
        onClose={() => setExportPage(null)}
      />

      {editImage?.imageUrl && (
        <ImageEditor
          nodeId={editImage.id}
          imageUrl={editImage.imageUrl}
          scale={editImage.imageScale}
          maxScale={editImage.phrases.some((p) => p.imageUrl) ? 260 : 100}
          onClose={() => setEditImage(null)}
          onDone={(message) => setNotice(message)}
        />
      )}

      {contextMenu}

      {revisionFor && ownerId && (
        <RevisionSetup
          studentId={ownerId}
          studentName={ownerName ?? ""}
          nodeId={revisionFor.id}
          nodeName={revisionFor.name}
          onClose={() => setRevisionFor(null)}
        />
      )}

      {picturesFor && (
        <PhraseImagesPanel
          nodeId={picturesFor.id}
          nodeName={picturesFor.name}
          onClose={() => setPicturesFor(null)}
        />
      )}

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
