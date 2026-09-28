export type GrantNode = {
  id: string;
  parentId: string | null;
};

/**
 * Возвращает верхние выданные ветки в порядке дерева.
 *
 * Выдача привязана к самому разделу, а не к его текущему положению. Поэтому
 * перенос раздела внутрь другой папки не должен лишать ученика доступа. Если
 * выданы и родитель, и его потомок, показываем только родителя — потомок уже
 * входит в его ветку.
 */
export function getVisibleGrantIds(
  nodes: GrantNode[],
  grantedNodeIds: Iterable<string>,
): string[] {
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  const granted = new Set(
    [...grantedNodeIds].filter((nodeId) => parentById.has(nodeId)),
  );

  function hasGrantedAncestor(nodeId: string): boolean {
    const visited = new Set<string>([nodeId]);
    let parentId = parentById.get(nodeId) ?? null;

    while (parentId && !visited.has(parentId)) {
      if (granted.has(parentId)) return true;
      visited.add(parentId);
      parentId = parentById.get(parentId) ?? null;
    }

    return false;
  }

  return nodes
    .filter((node) => granted.has(node.id) && !hasGrantedAncestor(node.id))
    .map((node) => node.id);
}

/**
 * Все узлы, которые ученик видит в общей библиотеке.
 *
 * Выдача даётся на раздел, а вместе с ним открывается всё, что внутри.
 * Поэтому «виден» — это сам выданный узел и любой его потомок, на какой
 * бы глубине он ни лежал.
 *
 * Нужно там, где дерево не строится: например, когда надо быстро понять,
 * какие словники доступны ученику, не собирая ради этого всю ветку.
 */
export function visibleNodeIds(
  nodes: GrantNode[],
  grantedNodeIds: Iterable<string>,
): Set<string> {
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  const granted = new Set(
    [...grantedNodeIds].filter((nodeId) => parentById.has(nodeId)),
  );

  const visible = new Set<string>();

  for (const node of nodes) {
    if (granted.has(node.id)) {
      visible.add(node.id);
      continue;
    }

    // Идём вверх до выданного предка. Посещённые помним: дерево приходит
    // из базы, и кольцо в нём не должно вешать обход.
    const seen = new Set<string>([node.id]);
    let parentId = parentById.get(node.id) ?? null;

    while (parentId && !seen.has(parentId)) {
      if (granted.has(parentId)) {
        visible.add(node.id);
        break;
      }
      seen.add(parentId);
      parentId = parentById.get(parentId) ?? null;
    }
  }

  return visible;
}
