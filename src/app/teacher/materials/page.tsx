import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { getMaterialsTree, getOwnedTree } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";
import { Avatar } from "@/components/avatar";
import { IconChevronRight } from "@/components/icons";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Какая библиотека открыта. */
type View = "mine" | "students" | "shared";

/**
 * Три библиотеки в одном месте: личная учителя, деревья учеников и общая
 * база, которую видят все.
 *
 * Дерево ученика показывается тем же проводником, что и остальные:
 * править его отсюда можно так же, и правки уходят в личное дерево
 * именно этого ученика. Выдача разделов, очистка и вход за ученика
 * остались в его карточке — здесь нужна сама библиотека, а не
 * управление доступом.
 */
export default async function TeacherMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; student?: string }>;
}) {
  const { t } = await getDict();
  const { view, student: studentId } = await searchParams;
  const session = await getSession();

  // По умолчанию открывается личная библиотека: учитель заходит сюда
  // работать со своими файлами, а в общую базу — заметно реже.
  const current: View =
    view === "shared" ? "shared" : view === "students" ? "students" : "mine";

  const students =
    current === "students"
      ? await db
          .select({
            id: users.id,
            name: users.name,
            level: users.level,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.role, "STUDENT"))
          .orderBy(asc(users.name))
      : [];

  const chosen = students.find((s) => s.id === studentId) ?? null;

  const tree =
    current === "mine"
      ? await getOwnedTree("PERSONAL", session!.userId)
      : current === "students"
        ? chosen
          ? await getOwnedTree("STUDENT", chosen.id)
          : []
        : await getMaterialsTree();

  const tabCls = (active: boolean) =>
    cn(
      "flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold transition",
      active ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content",
    );

  const subtitle =
    current === "mine"
      ? t.materials.personalSubtitle
      : current === "students"
        ? chosen
          ? t.materials.personalOfHint
          : t.materials.pickStudentHint
        : t.materials.teacherSubtitle;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.materials.title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>

      <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        {/* Свои материалы первыми: учитель заходит сюда чаще всего. */}
        <Link href="/teacher/materials" className={tabCls(current === "mine")}>
          {t.materials.mine}
        </Link>
        <Link
          href="/teacher/materials?view=students"
          className={tabCls(current === "students")}
        >
          {t.materials.studentsLib}
        </Link>
        <Link
          href="/teacher/materials?view=shared"
          className={tabCls(current === "shared")}
        >
          {t.materials.shared}
        </Link>
      </div>

      {current === "students" && (
        <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
          <p className="text-sm font-bold text-content">{t.materials.pickStudent}</p>

          {students.length === 0 ? (
            <p className="mt-2 text-sm text-faint">{t.materials.noStudents}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {students.map((s) => {
                const active = chosen?.id === s.id;
                return (
                  <Link
                    key={s.id}
                    href={`/teacher/materials?view=students&student=${s.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2.5 py-1.5 ring-1 transition",
                      active
                        ? "bg-accent-soft ring-accent"
                        : "bg-surface-2 ring-transparent hover:ring-line",
                    )}
                  >
                    <Avatar
                      name={s.name}
                      src={s.avatarUrl}
                      className="h-7 w-7 text-[10px]"
                    />
                    <span
                      className={cn(
                        "text-[13px] font-semibold",
                        active ? "text-accent" : "text-content",
                      )}
                    >
                      {s.name}
                    </span>
                    {s.level && (
                      <span className="text-[11px] text-faint">{s.level}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {chosen && (
            <Link
              href={`/teacher/students/${chosen.id}/materials`}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent"
            >
              {t.materials.fullCard} <IconChevronRight className="h-4 w-4" />
            </Link>
          )}
        </section>
      )}

      {current === "students" && !chosen ? null : (
        <div>
          {chosen && (
            <h2 className="mb-2 text-sm font-bold text-content">
              {fmt(t.materials.personalOf, { name: chosen.name })}
            </h2>
          )}
          <MaterialsExplorer
            key={current === "students" ? (chosen?.id ?? "none") : current}
            tree={tree}
            editable
            scope={
              current === "mine"
                ? "PERSONAL"
                : current === "students"
                  ? "STUDENT"
                  : "MATERIAL"
            }
            ownerId={
              current === "mine"
                ? session!.userId
                : current === "students"
                  ? chosen?.id
                  : undefined
            }
            emptyText={
              current === "mine"
                ? t.materials.personalEmpty
                : current === "students"
                  ? t.materials.emptyStudent
                  : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
