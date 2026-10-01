import Link from "next/link";
import { myInteractiveHomeworkAction } from "@/lib/actions/lesson-homework";
import { getDict } from "@/lib/i18n/server";
import { IconCheckCircle, IconChevronRight } from "@/components/icons";

export default async function StudentHomeworkPage() {
  const [items, { t }] = await Promise.all([
    myInteractiveHomeworkAction(),
    getDict(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black text-content">{t.nav.homework}</h1>
        <p className="mt-1 text-sm text-muted">{t.interactiveHomework.pageHint}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
          <IconCheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm font-bold text-content">{t.interactiveHomework.nothingAssigned}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const complete = item.total > 0 && item.done >= item.total;
            return (
              <Link
                key={item.id}
                href={`/student/lessons/${item.id}`}
                className="group rounded-2xl bg-surface p-4 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <IconCheckCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-content">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.homeworkTitle}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className={complete ? "h-full bg-emerald-500" : "h-full bg-accent"}
                        style={{ width: `${item.total ? (item.done / item.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-faint">
                      {item.done}/{item.total}
                    </p>
                  </div>
                  <IconChevronRight className="mt-2 h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
