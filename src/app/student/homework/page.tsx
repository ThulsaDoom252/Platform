import { redirect } from "next/navigation";
import { myInteractiveHomeworkAction } from "@/lib/actions/lesson-homework";
import { getDict } from "@/lib/i18n/server";
import { IconCheckCircle } from "@/components/icons";

export default async function StudentHomeworkPage() {
  const [items, { t }] = await Promise.all([
    myInteractiveHomeworkAction(),
    getDict(),
  ]);

  if (items[0]) redirect(`/student/lessons/${items[0].id}?section=homework`);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-content">{t.nav.homework}</h1>
        <p className="mt-1 text-sm text-muted">{t.interactiveHomework.pageHint}</p>
      </div>

      <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
        <IconCheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 text-sm font-bold text-content">{t.interactiveHomework.nothingAssigned}</p>
      </div>
    </div>
  );
}
