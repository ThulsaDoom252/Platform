"use server";

import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonUnits,
  irregularVerbs,
  materialBlocks,
  materialNodes,
  materialPhrases,
  tongueTwisters,
  users,
  wordDeckActivities,
} from "@/lib/db/schema";
import { getStudentLibrary, type MaterialNode } from "@/lib/materials";
import { getSession } from "@/lib/session";
import {
  SEARCH_CATEGORIES,
  type GlobalSearchItem,
  type GlobalSearchResponse,
  type SearchCategory,
} from "@/lib/global-search-types";
import { dictionaryEntrySearchItem, searchVisibleDictionaryEntries } from "@/lib/global-search-vocabulary";

const MAX_PER_CATEGORY = 12;

function cleanQuery(value: string) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 100) : "";
}

function selectedCategories(values: SearchCategory[], student: boolean) {
  const allowed = new Set<SearchCategory>(
    student ? ["MATERIALS"] : [...SEARCH_CATEGORIES],
  );
  return new Set(Array.isArray(values) ? values.filter((value) => allowed.has(value)) : []);
}

function searchableText(node: MaterialNode) {
  // Поиск структуры остаётся независимым от опционального поиска записей:
  // здесь только названия и подзаголовки видимых разделов.
  return [node.name, node.description, node.category]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function searchStudentTree(nodes: MaterialNode[], query: string): GlobalSearchItem[] {
  const found: GlobalSearchItem[] = [];
  const needle = query.toLocaleLowerCase();

  const walk = (list: MaterialNode[]) => {
    for (const node of list) {
      if (found.length >= MAX_PER_CATEGORY) return;
      if (searchableText(node).includes(needle)) {
        found.push({
          id: node.id,
          category: "MATERIALS",
          title: node.name,
          subtitle: node.description ?? node.category ?? null,
          href: `/student/materials?node=${encodeURIComponent(node.id)}`,
          icon: node.icon,
        });
      }
      if (node.children.length) walk(node.children);
    }
  };

  walk(nodes);
  return found;
}

async function searchTeacherMaterials(
  teacherId: string,
  pattern: string,
): Promise<GlobalSearchItem[]> {
  const rows = await db
    .select({
      id: materialNodes.id,
      name: materialNodes.name,
      description: materialNodes.description,
      category: materialNodes.category,
      icon: materialNodes.icon,
      scope: materialNodes.scope,
      ownerId: materialNodes.ownerId,
    })
    .from(materialNodes)
    .where(
      and(
        or(
          eq(materialNodes.scope, "MATERIAL"),
          and(eq(materialNodes.scope, "PERSONAL"), eq(materialNodes.ownerId, teacherId)),
          eq(materialNodes.scope, "STUDENT"),
        ),
        or(
          ilike(materialNodes.name, pattern),
          ilike(materialNodes.description, pattern),
          ilike(materialNodes.category, pattern),
        ),
      ),
    )
    .limit(MAX_PER_CATEGORY);

  const ownerIds = [...new Set(rows.flatMap((row) => (row.ownerId ? [row.ownerId] : [])))];
  const owners = ownerIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, ownerIds))
    : [];
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));

  return rows.map((row) => {
    const ownerName = row.ownerId ? ownerNames.get(row.ownerId) : null;
    const subtitle = [ownerName, row.description ?? row.category].filter(Boolean).join(" · ");
    const href =
      row.scope === "PERSONAL"
        ? `/teacher/materials?view=mine&node=${encodeURIComponent(row.id)}`
        : row.scope === "STUDENT"
          ? `/teacher/materials?view=students&student=${encodeURIComponent(row.ownerId ?? "")}&node=${encodeURIComponent(row.id)}`
          : `/teacher/materials?view=shared&node=${encodeURIComponent(row.id)}`;

    return {
      id: row.id,
      category: "MATERIALS" as const,
      title: row.name,
      subtitle: subtitle || null,
      href,
      icon: row.icon,
    };
  });
}

async function searchTeacherDictionaryEntries(
  teacherId: string,
  query: string,
): Promise<GlobalSearchItem[]> {
  // Escape SQL wildcard characters: entry lookup is a literal substring search,
  // just like the personalized student-tree lookup.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const accessible = and(
    eq(materialNodes.type, "FILE"),
    or(isNull(materialNodes.fileKind), eq(materialNodes.fileKind, "")),
    or(
      and(eq(materialNodes.scope, "MATERIAL"), isNull(materialNodes.ownerId)),
      and(eq(materialNodes.scope, "PERSONAL"), eq(materialNodes.ownerId, teacherId)),
      and(
        eq(materialNodes.scope, "STUDENT"),
        sql`exists (select 1 from ${users} where ${users.id} = ${materialNodes.ownerId} and ${users.role} = 'STUDENT')`,
      ),
    ),
  );
  const nodeColumns = {
    nodeId: materialNodes.id,
    nodeName: materialNodes.name,
    nodeIcon: materialNodes.icon,
    scope: materialNodes.scope,
    ownerId: materialNodes.ownerId,
  };
  const [phrases, verbs] = await Promise.all([
    db.select({
      ...nodeColumns, id: materialPhrases.id, title: materialPhrases.phrase,
      translation: materialPhrases.translation, icon: materialPhrases.icon,
    }).from(materialPhrases)
      .innerJoin(materialNodes, eq(materialPhrases.nodeId, materialNodes.id))
      .where(and(
        accessible,
        sql`not exists (select 1 from ${irregularVerbs} where ${irregularVerbs.nodeId} = ${materialNodes.id})`,
        sql`not exists (select 1 from ${materialBlocks} where ${materialBlocks.nodeId} = ${materialNodes.id})`,
        or(
          ilike(materialPhrases.phrase, pattern), ilike(materialPhrases.translation, pattern),
          ilike(materialPhrases.note, pattern), ilike(materialPhrases.section, pattern),
          ilike(materialPhrases.description, pattern),
          sql`exists (select 1 from jsonb_array_elements(${materialPhrases.examples}) as example where example->>'en' ilike ${pattern} or example->>'tr' ilike ${pattern})`,
        ),
      ))
      .orderBy(asc(materialNodes.name), asc(materialPhrases.sortOrder), asc(materialPhrases.id))
      .limit(MAX_PER_CATEGORY),
    db.select({
      ...nodeColumns, id: irregularVerbs.id, base: irregularVerbs.base,
      past: irregularVerbs.past, participle: irregularVerbs.participle,
      translation: irregularVerbs.translation, icon: irregularVerbs.icon,
    }).from(irregularVerbs)
      .innerJoin(materialNodes, eq(irregularVerbs.nodeId, materialNodes.id))
      .where(and(accessible, or(
        ilike(irregularVerbs.base, pattern), ilike(irregularVerbs.past, pattern),
        ilike(irregularVerbs.participle, pattern), ilike(irregularVerbs.translation, pattern),
        ilike(irregularVerbs.category, pattern),
      )))
      .orderBy(asc(materialNodes.name), asc(irregularVerbs.sortOrder), asc(irregularVerbs.id))
      .limit(MAX_PER_CATEGORY),
  ]);
  const entries = [
    ...phrases.map((row) => ({ ...row, kind: "phrase" as const })),
    ...verbs.map((row) => ({ ...row, title: `${row.base} · ${row.past} · ${row.participle}`, kind: "verb" as const })),
  ].slice(0, MAX_PER_CATEGORY);
  const ownerIds = [...new Set(entries.flatMap((entry) => entry.ownerId ? [entry.ownerId] : []))];
  const owners = ownerIds.length ? await db.select({ id: users.id, name: users.name })
    .from(users).where(inArray(users.id, ownerIds)) : [];
  const ownerNames = new Map(owners.map((owner) => [owner.id, owner.name]));
  return entries.map((entry) => dictionaryEntrySearchItem({
    ...entry, icon: entry.icon ?? entry.nodeIcon,
  }, "TEACHER", entry.ownerId ? ownerNames.get(entry.ownerId) : null));
}

/**
 * Один вход поиска для обеих ролей. Проверка доступа находится здесь,
 * а не в интерфейсе: ученик физически не может запросить чужих учеников,
 * игры или чужие деревья, даже подменив данные запроса.
 */
export async function globalSearchAction(input: {
  query: string;
  categories: SearchCategory[];
  includeVocabularyEntries?: boolean;
}): Promise<GlobalSearchResponse> {
  const session = await getSession();
  if (!session) return { items: [], error: "UNAUTHORIZED" };

  const query = cleanQuery(input.query);
  if (query.length < 2) return { items: [] };

  const categories = selectedCategories(input.categories, session.role === "STUDENT");
  if (categories.size === 0) return { items: [] };

  if (session.role === "STUDENT") {
    const tree = await getStudentLibrary(session.userId);
    const nodes = searchStudentTree(tree, query);
    const entries = input.includeVocabularyEntries === true
      ? searchVisibleDictionaryEntries(tree, query, MAX_PER_CATEGORY - nodes.length)
      : [];
    return { items: [...nodes, ...entries] };
  }

  const pattern = `%${query}%`;
  const [students, materials, lessons, games, twisters, vocabularyEntries] = await Promise.all([
    categories.has("STUDENTS")
      ? db
          .select({
            id: users.id,
            name: users.name,
            login: users.login,
            email: users.email,
            level: users.level,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(
            and(
              eq(users.role, "STUDENT"),
              or(
                ilike(users.name, pattern),
                ilike(users.login, pattern),
                ilike(users.email, pattern),
                ilike(users.level, pattern),
              ),
            ),
          )
          .limit(MAX_PER_CATEGORY)
      : Promise.resolve([]),
    categories.has("MATERIALS")
      ? searchTeacherMaterials(session.userId, pattern)
      : Promise.resolve([]),
    categories.has("LESSONS")
      ? db
          .select({
            id: lessonUnits.id,
            title: lessonUnits.title,
            description: lessonUnits.description,
          })
          .from(lessonUnits)
          .where(
            and(
              eq(lessonUnits.authorId, session.userId),
              or(ilike(lessonUnits.title, pattern), ilike(lessonUnits.description, pattern)),
            ),
          )
          .limit(MAX_PER_CATEGORY)
      : Promise.resolve([]),
    categories.has("GAMES")
      ? db
          .select({ id: wordDeckActivities.id, title: wordDeckActivities.title })
          .from(wordDeckActivities)
          .where(
            and(
              eq(wordDeckActivities.authorId, session.userId),
              ilike(wordDeckActivities.title, pattern),
            ),
          )
          .limit(MAX_PER_CATEGORY)
      : Promise.resolve([]),
    categories.has("TWISTERS")
      ? db
          .select({ id: tongueTwisters.id, title: tongueTwisters.title })
          .from(tongueTwisters)
          .where(ilike(tongueTwisters.title, pattern))
          .limit(MAX_PER_CATEGORY)
      : Promise.resolve([]),
    categories.has("MATERIALS") && input.includeVocabularyEntries === true
      ? searchTeacherDictionaryEntries(session.userId, query)
      : Promise.resolve([]),
  ]);

  const items: GlobalSearchItem[] = [
    ...students.map((student) => ({
      id: student.id,
      category: "STUDENTS" as const,
      title: student.name,
      subtitle: student.level ?? student.email ?? student.login,
      href: `/teacher/students/${student.id}`,
      icon: null,
    })),
    ...[...materials, ...vocabularyEntries].slice(0, MAX_PER_CATEGORY),
    ...lessons.map((lesson) => ({
      id: lesson.id,
      category: "LESSONS" as const,
      title: lesson.title,
      subtitle: lesson.description,
      href: `/teacher/lessons/${lesson.id}`,
      icon: null,
    })),
    ...games.map((game) => ({
      id: game.id,
      category: "GAMES" as const,
      title: game.title,
      subtitle: null,
      href: `/teacher/activities?activity=${encodeURIComponent(game.id)}`,
      icon: null,
    })),
    ...twisters.map((twister) => ({
      id: twister.id,
      category: "TWISTERS" as const,
      title: twister.title ?? "",
      subtitle: null,
      href: `/teacher/tongue-twisters#twister-${encodeURIComponent(twister.id)}`,
      icon: null,
    })),
  ];

  return { items };
}
