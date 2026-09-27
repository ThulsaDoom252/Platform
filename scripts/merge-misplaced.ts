/**
 * Свести ошибочно вложенную ветку с корневой одноимённой.
 *
 * Перенос структуры лёг внутрь раздела вместо корня: получилось
 * «Vocabulary / Vocabulary». Здесь содержимое той ветки раскладывается
 * по существующим разделам — одноимённые папки объединяются, чего нет,
 * то переезжает. Удаляются только опустевшие дубликаты.
 *
 * Трогаем ровно те узлы, что создал ошибочный перенос: они отбираются
 * по времени создания. Всё, что было раньше, остаётся на месте.
 *
 * Без --apply только показывает план.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { materialNodes } from "../src/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { splitIcon } from "../src/lib/tree-import";

const APPLY = process.argv.includes("--apply");
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const STUDENT = arg("student") ?? "Danylo";
const AFTER = arg("after") ?? "2026-09-27 22:30";

const key = (name: string, icon: string | null) =>
  (icon ? name : splitIcon(name).name).trim().replace(/\s+/g, " ").toLocaleLowerCase();

type Node = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  type: string;
  fresh: boolean;
};

const moves: string[] = [];
const merges: string[] = [];
const collisions: string[] = [];
const removals: string[] = [];

async function main() {
  const [student] = await db
    .execute<{ id: string }>(sql`select id from users where name = ${STUDENT} limit 1`)
    .then((r) => r.rows);
  if (!student) throw new Error(`Ученик ${STUDENT} не найден`);

  const rows = await db
    .select({
      id: materialNodes.id,
      parentId: materialNodes.parentId,
      name: materialNodes.name,
      icon: materialNodes.icon,
      type: materialNodes.type,
      createdAt: materialNodes.createdAt,
    })
    .from(materialNodes)
    .where(and(eq(materialNodes.scope, "STUDENT"), eq(materialNodes.ownerId, student.id)));

  const cut = new Date(AFTER);
  let all: Node[] = rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    name: r.name,
    icon: r.icon,
    type: r.type,
    fresh: r.createdAt > cut,
  }));

  const childrenOf = (id: string | null) => all.filter((n) => (n.parentId ?? null) === id);
  const drop = (id: string) => {
    all = all.filter((n) => n.id !== id);
  };

  const roots = childrenOf(null);
  const rootByKey = new Map(roots.map((r) => [key(r.name, r.icon), r]));

  async function reparent(node: Node, parentId: string | null) {
    if (APPLY) {
      await db
        .update(materialNodes)
        .set({ parentId })
        .where(eq(materialNodes.id, node.id));
    }
    node.parentId = parentId;
  }

  async function remove(node: Node, where: string) {
    removals.push(where);
    if (APPLY) {
      await db.delete(materialNodes).where(eq(materialNodes.id, node.id));
    }
    drop(node.id);
  }

  /** Разложить детей src по dst: одноимённое сливаем, остальное переносим. */
  async function merge(src: Node, dst: Node, path: string) {
    const dstByKey = new Map(
      childrenOf(dst.id).map((c) => [key(c.name, c.icon), c] as const),
    );

    for (const child of childrenOf(src.id)) {
      const hit = dstByKey.get(key(child.name, child.icon));
      const where = `${path} / ${child.name}`;

      if (!hit) {
        moves.push(`${where}  →  ${dst.name}`);
        await reparent(child, dst.id);
        continue;
      }

      if (child.type === "FOLDER" && hit.type === "FOLDER") {
        merges.push(where);
        await merge(child, hit, where);
        if (childrenOf(child.id).length === 0) await remove(child, where);
        continue;
      }

      collisions.push(`${where} — уже есть одноимённый файл, оставляю оба`);
    }
  }

  // Список снимаем до правок: перенесённая ветка не должна попасть
  // в обход второй раз уже на новом месте.
  const misplaced = roots.flatMap((root) =>
    childrenOf(root.id)
      .filter((child) => child.fresh)
      .map((child) => ({ root, child })),
  );

  {
    for (const { root, child } of misplaced) {
      const path = `${root.name} / ${child.name}`;
      const twin = rootByKey.get(key(child.name, child.icon));

      if (twin && twin.id !== child.id) {
        merges.push(`${path}  →  корень / ${twin.name}`);
        await merge(child, twin, path);
        if (childrenOf(child.id).length === 0) await remove(child, path);
      } else {
        // Одноимённого раздела в корне нет — просто поднимаем наверх.
        moves.push(`${path}  →  корень`);
        await reparent(child, null);
      }
    }
  }

  const show = (title: string, list: string[]) => {
    console.log(`\n=== ${title}: ${list.length} ===`);
    for (const line of list.slice(0, 40)) console.log("  " + line);
    if (list.length > 40) console.log(`  …и ещё ${list.length - 40}`);
  };

  show("объединяются одноимённые папки", merges);
  show("переезжает на новое место", moves);
  show("удаляются опустевшие дубликаты", removals);
  show("совпали имена файлов — оставлены оба", collisions);

  const left = childrenOf(roots.find((r) => key(r.name, r.icon) === "vocabulary")!.id)
    .filter((n) => n.fresh)
    .map((n) => n.name);
  console.log("\nсвежих узлов осталось внутри Vocabulary:", left.length ? left.join(", ") : "нет");

  console.log(APPLY ? "\nПрименено." : "\nЭто план. Для применения: --apply");
  process.exit(0);
}

main();
