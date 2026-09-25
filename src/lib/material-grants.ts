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
