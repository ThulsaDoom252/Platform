/**
 * Порядок разделов в панели материалов.
 *
 * Папки всегда идут впереди файлов: в дереве сначала ищут ветку, а уже
 * потом лист. Внутри каждой группы порядок выбирает учитель — по
 * алфавиту или по времени появления, в обе стороны.
 *
 * Сортировка ничего не записывает: это взгляд на дерево. Ручной порядок
 * живёт в самих разделах и остаётся нетронутым, к нему можно вернуться
 * в любой момент.
 */

export type SortMode =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "added-asc"
  | "added-desc";

export const SORT_LABEL: Record<SortMode, string> = {
  manual: "Свой порядок",
  "name-asc": "По алфавиту",
  "name-desc": "По алфавиту наоборот",
  "added-asc": "По добавлению",
  "added-desc": "По добавлению наоборот",
};

/** Режим по умолчанию: папки по алфавиту, за ними файлы. */
export const DEFAULT_SORT: SortMode = "name-asc";

export type SortableNode = {
  id: string;
  name: string;
  icon: string | null;
  type: "FOLDER" | "FILE";
  createdAt: string;
  children: SortableNode[];
};

/** Сохранённая расстановка: узел — его место. */
export type TreePreset = {
  id: string;
  name: string;
  savedAt: string;
  order: Record<string, number>;
};

export const MAX_PRESETS = 5;

/** Имя для сравнения: без значка, без регистра, цифры по-человечески. */
const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

function bareName(node: SortableNode): string {
  // Значок хранится отдельно, но в старых записях он приклеен к имени.
  const name = node.icon ? node.name : node.name.replace(/^\p{Extended_Pictographic}[️]?\s*/u, "");
  return name.trim();
}

function compare(a: SortableNode, b: SortableNode, mode: SortMode): number {
  switch (mode) {
    case "name-asc":
      return collator.compare(bareName(a), bareName(b));
    case "name-desc":
      return collator.compare(bareName(b), bareName(a));
    case "added-asc":
      return a.createdAt.localeCompare(b.createdAt);
    case "added-desc":
      return b.createdAt.localeCompare(a.createdAt);
    default:
      return 0;
  }
}

/**
 * Разложить уровень: папки, потом файлы, внутри — по выбранному признаку.
 *
 * Расстановка, если она задана, сильнее режима: на то она и сохранённая.
 * Узлы, которых в ней нет, встают после известных, сохраняя свой порядок.
 */
function sortLevel<T extends SortableNode>(
  nodes: T[],
  mode: SortMode,
  preset?: Record<string, number>,
): T[] {
  const out = [...nodes];

  out.sort((a, b) => {
    // Папка всегда выше файла, каким бы ни был остальной порядок.
    if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;

    if (preset) {
      const ai = preset[a.id];
      const bi = preset[b.id];
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return 0;
    }

    return compare(a, b, mode);
  });

  return out;
}

/** Разложить всё дерево сверху донизу. */
export function sortTree<T extends SortableNode>(
  nodes: T[],
  mode: SortMode,
  preset?: Record<string, number>,
): T[] {
  if (mode === "manual" && !preset) {
    // Свой порядок уже пришёл из базы — трогать нечего, кроме папок.
    return sortLevel(nodes, "manual").map(
      (node) => ({ ...node, children: sortTree(node.children, mode) }) as T,
    );
  }

  return sortLevel(nodes, mode, preset).map(
    (node) => ({ ...node, children: sortTree(node.children, mode, preset) }) as T,
  );
}

/**
 * Разложить всё, кроме верхнего уровня.
 *
 * Главные разделы стоят так, как их поставил учитель: это его карта, и
 * сортировка не вправе её переписывать. Внутри разделов порядок уже
 * выбирается режимом.
 */
export function sortInsideRoots<T extends SortableNode>(
  roots: T[],
  mode: SortMode,
  preset?: Record<string, number>,
): T[] {
  return roots.map(
    (root) => ({ ...root, children: sortTree(root.children, mode, preset) }) as T,
  );
}

/**
 * Снять расстановку с уже разложенного дерева — для сохранения пресета.
 *
 * Верхний уровень в неё не попадает: его порядок сортировка всё равно
 * не трогает, а в расстановке он только мешал бы.
 */
export function captureOrder(
  nodes: SortableNode[],
  into: Record<string, number> = {},
): Record<string, number> {
  let index = 0;
  const walk = (list: SortableNode[], top: boolean) => {
    for (const node of list) {
      if (!top) into[node.id] = index++;
      walk(node.children, false);
    }
  };
  walk(nodes, true);
  return into;
}

/**
 * Соседи узла в том порядке, в каком они сейчас на экране.
 *
 * Нужно перетаскиванию при включённой сортировке. Учитель кладёт файл
 * «после вот этого», имея в виду то, что видит; а в базе порядок другой,
 * и та же команда означала бы другое место. Поэтому вместе с переносом
 * уходит и увиденный порядок уровня — им и переписывается хранимый.
 *
 * Корневые разделы не отдаём: их расстановка не меняется.
 */
export function siblingsOf(nodes: SortableNode[], id: string): string[] {
  let found: string[] | null = null;

  const walk = (list: SortableNode[], top: boolean) => {
    if (found) return;
    if (!top && list.some((node) => node.id === id)) {
      found = list.map((node) => node.id);
      return;
    }
    for (const node of list) {
      walk(node.children, false);
      if (found) return;
    }
  };

  walk(nodes, true);
  return found ?? [];
}
