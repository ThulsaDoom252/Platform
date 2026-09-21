import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { homework } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { submitHomeworkAction } from "@/lib/actions/student";
import { IconMaterials } from "@/components/icons";

const statusTint: Record<string, string> = {
  NOT_DONE: "tint-amber",
  SUBMITTED: "tint-sky",
  IN_REVIEW: "tint-violet",
  REVIEWED: "tint-green",
  NEEDS_REVISION: "tint-rose",
};

export default async function StudentHomeworkPage() {
  const session = await getSession();
  const { t } = await getDict();

  const items = await db
    .select()
    .from(homework)
    .where(eq(homework.studentId, session!.userId))
    .orderBy(desc(homework.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.studentArea.homeworkTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.studentArea.homeworkSubtitle}</p>
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl bg-surface px-6 py-16 text-center ring-1 ring-line shadow-sm">
          <p className="text-sm text-faint">{t.studentArea.homeworkEmpty}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((h) => (
          <section
            key={h.id}
            className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3.5">
              <span className="tint-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <IconMaterials className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-content">{h.title}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTint[h.status] ?? "tint-accent"}`}
                  >
                    {t.homeworkStatus[h.status as keyof typeof t.homeworkStatus]}
                  </span>
                </div>
                {h.description && (
                  <p className="mt-1.5 text-sm text-muted">{h.description}</p>
                )}
                {h.teacherFeedback && (
                  <p className="tint-green mt-3 rounded-xl px-3.5 py-2.5 text-xs">
                    {fmt(t.studentArea.teacherComment, { text: h.teacherFeedback })}
                  </p>
                )}
                {(h.status === "NOT_DONE" || h.status === "NEEDS_REVISION") && (
                  <form action={submitHomeworkAction} className="mt-4">
                    <input type="hidden" name="homeworkId" value={h.id} />
                    <button
                      type="submit"
                      className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      {t.studentArea.submitHomework}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
