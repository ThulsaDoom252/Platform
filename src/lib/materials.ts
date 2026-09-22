import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  studentMaterials,
  materialPhrases,
  materialBlocks,
  type RuleBlock,
} from "@/lib/db/schema";

export type { RuleBlock };

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
  /** Блоки правила. Страница — либо словник (phrases), либо правило (blocks). */
  blocks: RuleBlock[];
  children: MaterialNode[];
};

type NodeRow = typeof materialNodes.$inferSelect;

/** Собирает плоский список узлов в дерево. */
async function buildTree(rows: NodeRow[]): Promise<{
  roots: MaterialNode[];
  byId: Map<string, MaterialNode>;
}> {
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

  const blockRows = await db
    .select()
    .from(materialBlocks)
    .orderBy(asc(materialBlocks.sortOrder));

  const blocksByNode = new Map<string, RuleBlock[]>();
  for (const b of blockRows) {
    const list = blocksByNode.get(b.nodeId) ?? [];
    list.push(b.data as RuleBlock);
    blocksByNode.set(b.nodeId, list);
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
      blocks: blocksByNode.get(r.id) ?? [],
      children: [],
    });
  }

  const roots: MaterialNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId)!.children.push(node);
    else roots.push(node);
  }

  return { roots, byId };
}

/**
 * Общая библиотека материалов.
 * Если передан studentId — только назначенные ему ветки, иначе всё дерево.
 */
export async function getMaterialsTree(studentId?: string): Promise<MaterialNode[]> {
  const rows = await db
    .select()
    .from(materialNodes)
    .where(and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)))
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const { roots, byId } = await buildTree(rows);
  if (!studentId) return roots;

  const assigned = await db
    .select({ nodeId: studentMaterials.materialNodeId })
    .from(studentMaterials)
    .where(eq(studentMaterials.studentId, studentId));

  const result: MaterialNode[] = [];
  for (const { nodeId } of assigned) {
    const n = byId.get(nodeId);
    if (n) result.push(n);
  }
  return result;
}

/** Личное дерево ошибок ученика. */
export async function getMistakesTree(studentId: string): Promise<MaterialNode[]> {
  const rows = await db
    .select()
    .from(materialNodes)
    .where(
      and(eq(materialNodes.scope, "MISTAKE"), eq(materialNodes.ownerId, studentId)),
    )
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const { roots } = await buildTree(rows);
  return roots;
}

/** Плоский подсчёт файлов в ветке — для подписи «N материалов». */
export function countFiles(node: MaterialNode): number {
  if (node.type === "FILE") return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}
