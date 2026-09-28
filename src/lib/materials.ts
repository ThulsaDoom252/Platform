import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materialNodes,
  studentMaterials,
  materialPhrases,
  materialBlocks,
  phraseImages,
  irregularVerbs,
  type RuleBlock,
} from "@/lib/db/schema";
import { getVisibleGrantIds } from "@/lib/material-grants";
import { pageTranslationLang } from "@/lib/translation-lang";

export type { RuleBlock };

export type PhraseExample = { en: string; tr: string };

/**
 * Весь переведённый текст страницы одним списком.
 *
 * По нему определяется язык. Берём перевод, заголовок раздела и заметку
 * — английские поля тут ничего не решают, а чем больше текста, тем
 * надёжнее ответ.
 */
function translatedTexts(
  phrases: { translation: string | null; section: string | null; note?: string | null }[],
  blocks: RuleBlock[],
): (string | null)[] {
  const fromPhrases = phrases.flatMap((p) => [p.translation, p.section, p.note ?? null]);
  // У правила переведённое лежит в самих блоках; разбирать их по типам
  // незачем — берём текст целиком, английские куски счёт не меняют.
  const fromBlocks = blocks.map((b) => JSON.stringify(b));
  return [...fromPhrases, ...fromBlocks];
}

/** Запись в списке неправильных глаголов. */
export type MaterialVerb = {
  id: string;
  /** Пусто — «без категории», такие идут первыми. */
  category: string | null;
  icon: string | null;
  base: string;
  baseIpa: string | null;
  past: string;
  pastIpa: string | null;
  participle: string;
  participleIpa: string | null;
  translation: string | null;
};

export type MaterialPhrase = {
  id: string;
  icon: string | null;
  imageUrl: string | null;
  /**
   * Короткое английское описание и картинка для игр.
   *
   * Ученику не показываются: по ним его спрашивают. Учитель может
   * включить их тумблером, чтобы видеть, что подобрано.
   */
  description?: string | null;
  gameImageUrl?: string | null;
  phrase: string;
  transcription: string | null;
  /** Американский и британский варианты; у старых записей их нет. */
  transcriptionUs: string | null;
  transcriptionUk: string | null;
  translation: string | null;
  /** Заметка «что стоит знать» под словом. */
  note: string | null;
  section: string | null;
  kind: string;
  examples: PhraseExample[];
};

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
  /** VOCAB | RULE | MISTAKE — чем страницу заполняли в прошлый раз. */
  pageKind: string | null;
  /** Язык активного перевода и пояснений страницы. */
  translationLang: "RU" | "UK";
  /** Служебная красная отметка, видимая только в редакторе учителя. */
  needsFix: boolean;
  /** Сколько одноимённых импортированных файлов объединено в этот файл. */
  mergeCount: number;
  /** Размер картинок слов в процентах; 100 — обычный. */
  imageScale: number;
  /** Исходный текст правила или словаря, как его вставили. */
  sourceText: string | null;
  /** Когда снят снимок перед перестройкой. Пусто — отменять нечего. */
  contentBackupAt: string | null;
  /** Когда раздел завели: по этому сортируется «порядок добавления». */
  createdAt: string;
  /** Неправильные глаголы, если страница про них. */
  verbs: MaterialVerb[];
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
  if (rows.length === 0) return { roots: [], byId: new Map() };

  const nodeIds = rows.map((row) => row.id);
  const phraseRows = await db
    .select()
    .from(materialPhrases)
    .where(inArray(materialPhrases.nodeId, nodeIds))
    .orderBy(asc(materialPhrases.sortOrder));

  /*
   * Картинка, выбранная для игры. Ученику она не показывается — по ней
   * его спрашивают, — но учителю нужна, чтобы видеть, что подобрано.
   */
  const pickedImages =
    phraseRows.length === 0
      ? []
      : await db
          .select({ phraseId: phraseImages.phraseId, url: phraseImages.url })
          .from(phraseImages)
          .where(
            and(
              inArray(phraseImages.phraseId, phraseRows.map((p) => p.id)),
              eq(phraseImages.picked, true),
            ),
          );
  const gameImageOf = new Map(pickedImages.map((r) => [r.phraseId, r.url]));

  const phrasesByNode = new Map<string, MaterialPhrase[]>();
  for (const p of phraseRows) {
    const list = phrasesByNode.get(p.nodeId) ?? [];
    list.push({
      id: p.id,
      icon: p.icon,
      imageUrl: p.imageUrl,
      phrase: p.phrase,
      transcription: p.transcription,
      transcriptionUs: p.transcriptionUs,
      transcriptionUk: p.transcriptionUk,
      translation: p.translation,
      note: p.note,
      description: p.description,
      gameImageUrl: gameImageOf.get(p.id) ?? null,
      section: p.section,
      kind: p.kind,
      examples: (p.examples ?? []) as PhraseExample[],
    });
    phrasesByNode.set(p.nodeId, list);
  }

  const blockRows = await db
    .select()
    .from(materialBlocks)
    .where(inArray(materialBlocks.nodeId, nodeIds))
    .orderBy(asc(materialBlocks.sortOrder));

  const blocksByNode = new Map<string, RuleBlock[]>();
  for (const b of blockRows) {
    const list = blocksByNode.get(b.nodeId) ?? [];
    list.push(b.data as RuleBlock);
    blocksByNode.set(b.nodeId, list);
  }

  const verbRows = await db
    .select()
    .from(irregularVerbs)
    .where(inArray(irregularVerbs.nodeId, nodeIds))
    .orderBy(asc(irregularVerbs.sortOrder));

  const verbsByNode = new Map<string, MaterialVerb[]>();
  for (const v of verbRows) {
    const list = verbsByNode.get(v.nodeId) ?? [];
    list.push({
      id: v.id,
      category: v.category,
      icon: v.icon,
      base: v.base,
      baseIpa: v.baseIpa,
      past: v.past,
      pastIpa: v.pastIpa,
      participle: v.participle,
      participleIpa: v.participleIpa,
      translation: v.translation,
    });
    verbsByNode.set(v.nodeId, list);
  }

  const byId = new Map<string, MaterialNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      icon: r.icon,
      imageUrl: r.imageUrl,
      description: r.description,
      type: r.type as "FOLDER" | "FILE",
      fileKind: r.fileKind,
      category: r.category,
      sizeLabel: r.sizeLabel,
      pageKind: r.pageKind,
      /*
       * Язык перевода берём из самого текста, а не из метки в базе.
       *
       * Метка ставится при создании страницы и дальше врёт: страницу
       * наполняют чем придётся. Когда различить нечем — остаётся метка.
       */
      translationLang: pageTranslationLang(
        translatedTexts(phrasesByNode.get(r.id) ?? [], blocksByNode.get(r.id) ?? []),
        r.translationLang,
      ),
      needsFix: r.needsFix,
      mergeCount: r.mergeCount,
      imageScale: r.imageScale,
      sourceText: r.sourceText,
      contentBackupAt: r.contentBackup?.savedAt ?? null,
      createdAt: r.createdAt.toISOString(),
      verbs: verbsByNode.get(r.id) ?? [],
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

  return getVisibleGrantIds(
    rows.map((row) => ({ id: row.id, parentId: row.parentId })),
    assigned.map(({ nodeId }) => nodeId),
  ).map((nodeId) => byId.get(nodeId)!);
}

/** Дерево, принадлежащее одному человеку: ошибки ученика или личные материалы. */
export async function getOwnedTree(
  scope: "MISTAKE" | "PERSONAL" | "STUDENT",
  ownerId: string,
): Promise<MaterialNode[]> {
  const rows = await db
    .select()
    .from(materialNodes)
    .where(and(eq(materialNodes.scope, scope), eq(materialNodes.ownerId, ownerId)))
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const { roots } = await buildTree(rows);
  return roots;
}

/** Личное дерево ошибок ученика. */
export const getMistakesTree = (studentId: string) =>
  getOwnedTree("MISTAKE", studentId);

/** Корневые разделы общей базы и ранее выданные ветки после их переноса. */
export async function getSharedSections(studentId: string): Promise<{
  sections: { id: string; name: string; icon: string | null; nested: boolean }[];
  granted: string[];
}> {
  const available = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      icon: materialNodes.icon,
      parentId: materialNodes.parentId,
    })
    .from(materialNodes)
    .where(
      and(
        eq(materialNodes.scope, "MATERIAL"),
        isNull(materialNodes.ownerId),
      ),
    )
    .orderBy(asc(materialNodes.sortOrder), asc(materialNodes.name));

  const rows = await db
    .select({ nodeId: studentMaterials.materialNodeId })
    .from(studentMaterials)
    .where(eq(studentMaterials.studentId, studentId));

  const granted = rows.map((row) => row.nodeId);
  const grantedSet = new Set(granted);
  const sections = available
    .filter((node) => node.parentId === null || grantedSet.has(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      icon: node.icon,
      nested: node.parentId !== null,
    }));

  return { sections, granted };
}

/**
 * Всё, что видит ученик: своё личное дерево плюс открытые ему
 * разделы общей базы. Деревья независимы, поэтому просто ставим их рядом.
 */
export async function getStudentLibrary(studentId: string): Promise<MaterialNode[]> {
  const [own, shared] = await Promise.all([
    getOwnedTree("STUDENT", studentId),
    getMaterialsTree(studentId),
  ]);
  return [...own, ...shared];
}

/** Плоский подсчёт файлов в ветке — для подписи «N материалов». */
export function countFiles(node: MaterialNode): number {
  if (node.type === "FILE") return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}
