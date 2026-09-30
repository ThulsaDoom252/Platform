"use server";

import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  lessonUnits,
  materialNodes,
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

const MAX_PER_CATEGORY = 12;

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

function selectedCategories(values: SearchCategory[], student: boolean) {
  const allowed = new Set<SearchCategory>(
    student ? ["MATERIALS"] : [...SEARCH_CATEGORIES],
  );
  return new Set(values.filter((value) => allowed.has(value)));
}

function searchableText(node: MaterialNode) {
  // Содержимое страниц намеренно не включено: ученический поиск ищет
  // только названия и подзаголовки видимой ему структуры.
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

/**
 * Один вход поиска для обеих ролей. Проверка доступа находится здесь,
 * а не в интерфейсе: ученик физически не может запросить чужих учеников,
 * игры или чужие деревья, даже подменив данные запроса.
 */
export async function globalSearchAction(input: {
  query: string;
  categories: SearchCategory[];
}): Promise<GlobalSearchResponse> {
  const session = await getSession();
  if (!session) return { items: [], error: "UNAUTHORIZED" };

  const query = cleanQuery(input.query);
  if (query.length < 2) return { items: [] };

  const categories = selectedCategories(input.categories, session.role === "STUDENT");
  if (categories.size === 0) return { items: [] };

  if (session.role === "STUDENT") {
    const tree = await getStudentLibrary(session.userId);
    return { items: searchStudentTree(tree, query) };
  }

  const pattern = `%${query}%`;
  const [students, materials, lessons, games, twisters] = await Promise.all([
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
    ...materials,
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
