import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, materialNodes, studentMaterials } from "@/lib/db/schema";
import { getDict } from "@/lib/i18n/server";
import { getOwnedTree, getSharedSections, getMaterialsTree } from "@/lib/materials";
import { MaterialsExplorer } from "@/components/materials/materials-explorer";
import { SharedAccess } from "@/components/materials/shared-access";
import { ReportButton } from "@/components/materials/report-button";
import { StudentWipe } from "@/components/materials/student-wipe";
import { Avatar } from "@/components/avatar";
import { IconChevronLeft, IconUser } from "@/components/icons";
import { viewAsStudentAction } from "@/lib/actions/auth";

export default async function StudentMaterialsForTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t } = await getDict();

  const [student] = await db
    .select({
      id: users.id,
      name: users.name,
      level: users.level,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!student || student.role !== "STUDENT") notFound();

  const tree = await getOwnedTree("STUDENT", student.id);
  const { sections, granted } = await getSharedSections(student.id);
  // То же, что видит ученик из общей базы — чтобы не гадать по названиям.
  const sharedTree = await getMaterialsTree(student.id);

  // Счётчики для кнопки очистки: сколько чего уедет, если нажать.
  const owned = async (scope: "STUDENT" | "MISTAKE") =>
    (
      await db
        .select({ n: count() })
        .from(materialNodes)
        .where(and(eq(materialNodes.ownerId, student.id), eq(materialNodes.scope, scope)))
    )[0]?.n ?? 0;

  const wipeCounts = {
    personal: await owned("STUDENT"),
    mistakes: await owned("MISTAKE"),
    access: (
      await db
        .select({ n: count() })
        .from(studentMaterials)
        .where(eq(studentMaterials.studentId, student.id))
    )[0]?.n ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/teacher/students/${student.id}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-surface-2 hover:text-content"
          aria-label="Назад к ученику"
        >
          <IconChevronLeft className="h-4 w-4" />
        </Link>
        <Avatar name={student.name} src={student.avatarUrl} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-content">{t.materials.title}</h1>
          <p className="text-sm text-muted">
            {student.name}
            {student.level ? ` · ${student.level}` : ""}
          </p>
        </div>
        <ReportButton studentId={student.id} studentName={student.name} />
        <form action={viewAsStudentAction}>
          <input type="hidden" name="studentId" value={student.id} />
          <button
            type="submit"
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            title={`Открыть платформу глазами ${student.name}`}
          >
            <IconUser className="h-4 w-4" />
            <span className="hidden sm:inline">Войти как {student.name}</span>
            <span className="sm:hidden">Как ученик</span>
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-content">
          Личные материалы {student.name}
        </h2>
        <p className="mb-3 text-[12px] text-muted">
          Своё дерево ученика: структура какая угодно, на других учеников и на
          твою базу не влияет.
        </p>
        <MaterialsExplorer
          tree={tree}
          editable
          scope="STUDENT"
          ownerId={student.id}
          emptyText="Личных материалов пока нет. Создай раздел или скопируй сюда из своей базы через «Поделиться». Разделы общей базы — ниже."
        />
      </div>

      <SharedAccess studentId={student.id} sections={sections} granted={granted} />

      {sharedTree.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-content">
            Из общей базы — что ученик видит сейчас
          </h2>
          <p className="mb-3 text-[12px] text-muted">
            Открытые выше разделы, как их видит {student.name}. Правятся они в
            общей базе, и правки доходят сразу.
          </p>
          <MaterialsExplorer tree={sharedTree} />
        </div>
      )}

      <StudentWipe
        studentId={student.id}
        studentName={student.name}
        counts={wipeCounts}
      />
    </div>
  );
}
