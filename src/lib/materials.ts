import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialNodes, studentMaterials, materialPhrases } from "@/lib/db/schema";

export type PhraseExample = { en: string; tr: string };

export type MaterialPhrase = {
  id: string;
  icon: string | null;
  imageUrl: string | null;
  phrase: string;
  transcription: string | null;
  translation: string | null;
  section: string | null;
  kind: string;
  examples: PhraseExample[];
};

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
  children: MaterialNode[];
};

/**
 * Дерево материалов.
 * Если передан studentId — возвращаются только назначенные ему ветки
 * (вместе со всем содержимым), иначе всё дерево целиком.
 */
export async function getMaterialsTree(studentId?: string): Promise<MaterialNode[]> {
  const rows = await db
    .select()
    .from(materialNodes)
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const phraseRows = await db
    .select()
    .from(materialPhrases)
    .orderBy(asc(materialPhrases.sortOrder));

  const phrasesByNode = new Map<string, MaterialPhrase[]>();
  for (const p of phraseRows) {
    const list = phrasesByNode.get(p.nodeId) ?? [];
    list.push({
      id: p.id,
      icon: p.icon,
      imageUrl: p.imageUrl,
      phrase: p.phrase,
      transcription: p.transcription,
      translation: p.translation,
      section: p.section,
      kind: p.kind,
      examples: (p.examples ?? []) as PhraseExample[],
    });
    phrasesByNode.set(p.nodeId, list);
  }

  const byId = new Map<string, MaterialNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      icon: r.icon,
      description: r.description,
      type: r.type as "FOLDER" | "FILE",
      fileKind: r.fileKind,
      category: r.category,
      sizeLabel: r.sizeLabel,
      phrases: phrasesByNode.get(r.id) ?? [],
      children: [],
    });
  }

  const roots: MaterialNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  if (!studentId) return roots;

  const assigned = await db
    .select({ nodeId: studentMaterials.materialNodeId })
    .from(studentMaterials)
    .where(eq(studentMaterials.studentId, studentId));

  const assignedIds = new Set(assigned.map((a) => a.nodeId));
  // Берём назначенные узлы как корни (они могут быть и не верхнего уровня).
  const result: MaterialNode[] = [];
  for (const id of assignedIds) {
    const n = byId.get(id);
    if (n) result.push(n);
  }
  return result;
}

/** Плоский подсчёт файлов в ветке — для подписи «N материалов». */
export function countFiles(node: MaterialNode): number {
  if (node.type === "FILE") return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}
