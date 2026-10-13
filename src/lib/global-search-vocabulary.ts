import type { GlobalSearchItem } from "./global-search-types";
import type { MaterialNode } from "./materials";

export type DictionarySearchEntry = {
  id: string;
  nodeId: string;
  nodeName: string;
  title: string;
  translation: string | null;
  icon: string | null;
  kind: "phrase" | "verb";
  scope?: string;
  ownerId?: string | null;
};

/** Keep the hit in the same library that the materials page can actually open. */
export function dictionaryEntrySearchItem(
  entry: DictionarySearchEntry,
  role: "TEACHER" | "STUDENT",
  ownerName?: string | null,
): GlobalSearchItem {
  const node = encodeURIComponent(entry.nodeId);
  const record = encodeURIComponent(entry.id);
  const href = role === "STUDENT"
    ? `/student/materials?node=${node}&entry=${record}`
    : entry.scope === "PERSONAL"
      ? `/teacher/materials?view=mine&node=${node}&entry=${record}`
      : entry.scope === "STUDENT"
        ? `/teacher/materials?view=students&student=${encodeURIComponent(entry.ownerId ?? "")}&node=${node}&entry=${record}`
        : `/teacher/materials?view=shared&node=${node}&entry=${record}`;

  return {
    id: `${entry.kind}:${entry.id}`,
    category: "MATERIALS",
    title: entry.title,
    subtitle: [entry.nodeName, entry.translation, ownerName].filter(Boolean).join(" · ") || null,
    href,
    icon: entry.icon,
  };
}

/**
 * Only call with the already grant-filtered, language-personalized student tree.
 * Game descriptions, source documents and rule blocks are not vocabulary hits.
 */
export function searchVisibleDictionaryEntries(
  nodes: MaterialNode[],
  query: string,
  limit: number,
): GlobalSearchItem[] {
  const found: GlobalSearchItem[] = [];
  const needle = query.toLocaleLowerCase();
  const matches = (values: (string | null | undefined)[]) => values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase()
    .includes(needle);

  const walk = (list: MaterialNode[]) => {
    for (const node of list) {
      if (found.length >= limit) return;
      if (node.type === "FILE" && !node.fileKind) {
        // Follow the reader/focus selection, not the editing-format pageKind tag.
        // PDF/audio attachments cannot open a vocabulary reader even if residual
        // rows remain; an empty VERBS-tagged page can still show its phrases.
        if (node.verbs.length > 0) {
          for (const verb of node.verbs) {
            if (found.length >= limit) return;
            if (!matches([verb.base, verb.past, verb.participle, verb.translation, verb.category])) continue;
            found.push(dictionaryEntrySearchItem({
              id: verb.id, nodeId: node.id, nodeName: node.name,
              title: `${verb.base} · ${verb.past} · ${verb.participle}`,
              translation: verb.translation, icon: verb.icon ?? node.icon, kind: "verb",
            }, "STUDENT"));
          }
        } else if (node.blocks.length === 0) {
          for (const phrase of node.phrases) {
            if (found.length >= limit) return;
            if (!matches([
              phrase.phrase, phrase.translation, phrase.note, phrase.section,
              ...phrase.examples.flatMap((example) => [example.en, example.tr]),
            ])) continue;
            found.push(dictionaryEntrySearchItem({
              id: phrase.id, nodeId: node.id, nodeName: node.name, title: phrase.phrase,
              translation: phrase.translation, icon: phrase.icon ?? node.icon, kind: "phrase",
            }, "STUDENT"));
          }
        }
      }
      if (node.children.length) walk(node.children);
    }
  };

  if (needle && limit > 0) walk(nodes);
  return found;
}
