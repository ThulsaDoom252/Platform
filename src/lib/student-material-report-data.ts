import "server-only";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "./db";
import { irregularVerbs, materialBlocks, materialNodes, materialPhrases, studentMaterials } from "./db/schema";
import { visibleNodeIds } from "./material-grants";
import { pageHasStructuredContent } from "./export-material";
import type { ReportMaterialNode } from "./student-material-report";

/** Report-only read: no images or content from unassigned library branches. */
export async function studentMaterialReportGroups(studentId: string) {
  const [rows, grants] = await Promise.all([
    db.select({
      id: materialNodes.id, parentId: materialNodes.parentId, name: materialNodes.name,
      description: materialNodes.description, scope: materialNodes.scope, translationLang: materialNodes.translationLang,
    }).from(materialNodes).where(or(
      and(eq(materialNodes.ownerId, studentId), inArray(materialNodes.scope, ["STUDENT", "MISTAKE"])),
      and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)),
    )).orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name), asc(materialNodes.id)),
    db.select({ nodeId: studentMaterials.materialNodeId }).from(studentMaterials).where(eq(studentMaterials.studentId, studentId)),
  ]);
  const sharedIds = visibleNodeIds(rows.filter((row) => row.scope === "MATERIAL"), grants.map((grant) => grant.nodeId));
  const visible = rows.filter((row) => row.scope !== "MATERIAL" || sharedIds.has(row.id));
  const ids = visible.map((row) => row.id);
  if (!ids.length) return [];
  const [phrases, blocks, verbs] = await Promise.all([
    db.select({
      nodeId: materialPhrases.nodeId, icon: materialPhrases.icon, section: materialPhrases.section,
      kind: materialPhrases.kind, phrase: materialPhrases.phrase, transcription: materialPhrases.transcription,
      transcriptionUs: materialPhrases.transcriptionUs, transcriptionUk: materialPhrases.transcriptionUk,
      translation: materialPhrases.translation, note: materialPhrases.note, description: materialPhrases.description,
      examples: materialPhrases.examples,
    }).from(materialPhrases).where(inArray(materialPhrases.nodeId, ids)).orderBy(asc(materialPhrases.sortOrder), asc(materialPhrases.id)),
    db.select({ nodeId: materialBlocks.nodeId, data: materialBlocks.data }).from(materialBlocks)
      .where(inArray(materialBlocks.nodeId, ids)).orderBy(asc(materialBlocks.sortOrder), asc(materialBlocks.id)),
    db.select({
      nodeId: irregularVerbs.nodeId, category: irregularVerbs.category, base: irregularVerbs.base,
      baseIpa: irregularVerbs.baseIpa, past: irregularVerbs.past, pastIpa: irregularVerbs.pastIpa,
      participle: irregularVerbs.participle, participleIpa: irregularVerbs.participleIpa, translation: irregularVerbs.translation,
    }).from(irregularVerbs).where(inArray(irregularVerbs.nodeId, ids)).orderBy(asc(irregularVerbs.sortOrder), asc(irregularVerbs.id)),
  ]);
  const byId = new Map<string, ReportMaterialNode>(visible.map((row) => [row.id, {
    id: row.id, name: row.name, description: row.description, translationLang: row.translationLang === "RU" ? "RU" : "UK",
    sourceText: null, phrases: [], blocks: [], verbs: [], children: [],
  }]));
  for (const { nodeId, ...phrase } of phrases) byId.get(nodeId)!.phrases.push(phrase);
  for (const block of blocks) byId.get(block.nodeId)!.blocks.push(block.data);
  for (const { nodeId, ...verb } of verbs) byId.get(nodeId)!.verbs.push(verb);
  // Do not duplicate long source documents alongside their current parsed
  // contents. Read the original only for pages which actually need a fallback.
  const fallbackIds = [...byId.values()].filter((node) => !pageHasStructuredContent(node)).map((node) => node.id);
  if (fallbackIds.length) {
    const sources = await db.select({ id: materialNodes.id, sourceText: materialNodes.sourceText })
      .from(materialNodes).where(inArray(materialNodes.id, fallbackIds));
    for (const source of sources) byId.get(source.id)!.sourceText = source.sourceText;
  }
  const scopeOf = new Map(visible.map((row) => [row.id, row.scope]));
  const roots = new Map<string, ReportMaterialNode[]>();
  for (const row of visible) {
    const node = byId.get(row.id)!;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent && scopeOf.get(parent.id) === row.scope) parent.children.push(node);
    else {
      const list = roots.get(row.scope) ?? [];
      list.push(node);
      roots.set(row.scope, list);
    }
  }
  return [
    { scope: "STUDENT", title: "Личные материалы" },
    { scope: "MATERIAL", title: "Общая база" },
    { scope: "MISTAKE", title: "Ошибки" },
  ].map(({ scope, title }) => ({
    title,
    // Normally the roots cover every node. Leftovers also preserve material in
    // a legacy cyclic/orphaned branch; the collector deduplicates by node id.
    nodes: [...(roots.get(scope) ?? []), ...visible.filter((row) => row.scope === scope).map((row) => byId.get(row.id)!)],
  }));
}
