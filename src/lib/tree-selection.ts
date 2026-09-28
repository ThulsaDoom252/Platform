/**
 * Выбор узлов в дереве материалов.
 *
 * Два правила, которые легко написать неверно и трудно заметить глазами:
 * папка выбирается вместе со всем, что внутри, а Ctrl добирает всё между
 * прошлым нажатием и нынешним. Поэтому считается здесь и проверяется
 * тестами, а разметка только показывает результат.
 */

export type TreeNodeLike = { id: string; parentId: string | null };

/**
 * Всё, что лежит внутри узла, на любой глубине.
 *
 * Сам узел не входит: его добавляет тот, кто вызвал. Кольцо в связях
 * обход не вешает — данные приходят из базы, где дерево держится на
 * коде приложения, а не на внешнем ключе.
 */
export function descendantIds(nodes: TreeNodeLike[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }

  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [...(children.get(id) ?? [])];

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...(children.get(next) ?? []));
  }

  return out;
}

/**
 * Отметить или снять узел вместе с его содержимым.
 *
 * Выбрав папку, учитель имеет в виду всё, что в ней: переносить или
 * удалять одну обложку без содержимого бессмысленно. Снятие работает
 * так же — иначе внутри оставались бы отмеченные файлы, которых не видно.
 */
export function toggleWithChildren(
  selection: ReadonlySet<string>,
  nodes: TreeNodeLike[],
  id: string,
): Set<string> {
  const next = new Set(selection);
  const family = [id, ...descendantIds(nodes, id)];

  if (next.has(id)) for (const node of family) next.delete(node);
  else for (const node of family) next.add(node);

  return next;
}

/**
 * Добрать всё между двумя узлами списка.
 *
 * Порядок передаёт тот список, в котором нажали: дерево слева и плитка
 * справа расположены по-разному, и диапазон считается внутри своего.
 * Прежний выбор сохраняется — Ctrl добавляет, а не заменяет.
 */
export function selectRange(
  selection: ReadonlySet<string>,
  order: string[],
  fromId: string | null,
  toId: string,
): Set<string> {
  const next = new Set(selection);

  const from = fromId ? order.indexOf(fromId) : -1;
  const to = order.indexOf(toId);

  // Точки отсчёта нет или она из другого списка — отмечаем один узел.
  if (from < 0 || to < 0) {
    next.add(toId);
    return next;
  }

  const [lo, hi] = from <= to ? [from, to] : [to, from];
  for (const id of order.slice(lo, hi + 1)) next.add(id);

  return next;
}

/**
 * Диапазон вместе с содержимым попавших в него папок.
 *
 * Правила не должны спорить: если папка оказалась внутри протяжки, она
 * выбрана целиком — ровно как при обычном нажатии на неё.
 */
export function selectRangeDeep(
  selection: ReadonlySet<string>,
  nodes: TreeNodeLike[],
  order: string[],
  fromId: string | null,
  toId: string,
): Set<string> {
  const flat = selectRange(selection, order, fromId, toId);
  const next = new Set(flat);

  for (const id of flat) {
    for (const child of descendantIds(nodes, id)) next.add(child);
  }

  return next;
}
