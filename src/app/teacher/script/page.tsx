import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listScriptLessonsAction } from "@/lib/actions/script";
import { ScriptWorkspace } from "@/components/script/script-workspace";

export default async function TeacherScriptPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") redirect("/login");

  // Из расписания приходят с конкретным уроком — открываем сразу его.
  const { lesson } = await searchParams;
  const initial = lesson
    ? ((await listScriptLessonsAction(200)).find((l) => l.lessonId === lesson) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-content">Скрипт урока</h1>
        <p className="mt-0.5 text-sm text-muted">
          Заметки к каждому занятию: план, слова, что спросить. Ученику они не
          показываются нигде.
        </p>
      </div>

      <ScriptWorkspace key={lesson ?? "list"} initial={initial} />
    </div>
  );
}
