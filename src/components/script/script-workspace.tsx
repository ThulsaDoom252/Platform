"use client";

/**
 * Страница скриптов: слева уроки, справа тот, что выбран.
 *
 * Список идёт от ближайшего занятия назад — готовятся всегда к
 * следующему уроку. Видно, к каким дням скрипт уже написан: по значку и
 * по первой строке текста.
 */
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  getScriptAction,
  type ScriptDoc,
  type ScriptLesson,
} from "@/lib/actions/script";
import { ScriptWeeks } from "./script-weeks";
import { ScriptEditor } from "./script-editor";
import { IconChevronLeft } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SCHEDULE_FORMAT_TIME_ZONE } from "@/lib/schedule-time";

const day = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});
const time = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHEDULE_FORMAT_TIME_ZONE,
});
const deletedTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ScriptWorkspace({ initial }: { initial?: ScriptLesson | null }) {
  const [open, setOpen] = useState<ScriptLesson | null>(initial ?? null);
  const [doc, setDoc] = useState<ScriptDoc | null>(null);
  const [busy, startLoad] = useTransition();

  const openId = open?.lessonId ?? null;

  useEffect(() => {
    if (!openId) return;
    let alive = true;
    startLoad(async () => {
      const next = await getScriptAction(openId);
      if (alive) setDoc(next);
    });
    return () => {
      alive = false;
    };
  }, [openId]);

  return (
    <div className="grid min-h-[70vh] items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className={cn(open && "hidden lg:block")}>
        <ScriptWeeks openId={openId} onOpen={(lesson) => setOpen(lesson)} />
      </div>

      {/* Скрипт */}
      <section className="flex min-h-[70vh] flex-col gap-3">
        {open ? (
          <>
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl px-3.5 py-2.5 ring-1",
                open.status === "DELETED"
                  ? "bg-orange-500/10 ring-orange-500/40"
                  : open.status.startsWith("CANCELLED") || open.status === "BURNED"
                    ? "bg-rose-500/10 ring-rose-500/40"
                    : "bg-surface ring-line",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="К списку уроков"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content lg:hidden"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>

              <Avatar
                name={open.studentName}
                src={open.avatarUrl}
                className="h-10 w-10 text-sm"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-content">
                  {open.studentName}
                </span>
                <span className="block text-[12px] text-faint">
                  {day.format(new Date(open.startTime))} ·{" "}
                  {time.format(new Date(open.startTime))} · {open.duration} мин
                  {open.studentLevel ? ` · ${open.studentLevel}` : ""}
                </span>
              </span>
              <span className="ml-auto text-[11px] text-faint">Видишь только ты</span>
            </div>

            {(open.status.startsWith("CANCELLED") || open.status === "BURNED") && (
              <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
                Отменён{open.cancelReason ? ` · ${open.cancelReason}` : " · причина не указана"}
              </div>
            )}
            {open.status === "DELETED" && (
              <div className="rounded-xl bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-700 dark:text-orange-300">
                Урок удалён
                {open.deletedAt ? ` · ${deletedTime.format(new Date(open.deletedAt))}` : ""}
              </div>
            )}

            {doc && !busy ? (
              <ScriptEditor
                key={doc.lessonId}
                doc={doc}
                onDeleted={() => {
                  window.location.reload();
                }}
              />
            ) : (
              <p className="rounded-2xl bg-surface p-5 text-sm text-faint ring-1 ring-line">
                Открываю…
              </p>
            )}
          </>
        ) : (
          <p className="rounded-2xl bg-surface p-5 text-sm text-faint ring-1 ring-line">
            Выбери урок слева — скрипт откроется здесь.
          </p>
        )}
      </section>
    </div>
  );
}
