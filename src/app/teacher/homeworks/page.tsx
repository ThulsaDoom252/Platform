import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  HomeworkBackgroundToggle,
  HomeworkStatusSurface,
} from "@/components/teacher/homework-status-surface";
import {
  IconCalendar,
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconUsers,
} from "@/components/icons";
import { teacherHomeworkAssignmentsAction } from "@/lib/actions/lesson-homework";
import { getDict } from "@/lib/i18n/server";
import { SCHOOL_TIME_ZONE, SCHEDULE_FORMAT_TIME_ZONE } from "@/lib/schedule-time";
import {
  sortTeacherHomeworks,
  teacherHomeworkOverviewState,
  type TeacherHomeworkOverviewState,
  type TeacherHomeworkSortKey,
} from "@/lib/teacher-homework-order";
import { cn } from "@/lib/utils";

export default async function TeacherHomeworksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort: TeacherHomeworkSortKey =
    params.sort === "lesson" || params.sort === "status" || params.sort === "assigned"
      ? params.sort
      : "name";
  const desc = params.dir === "desc";
  const [items, { t, locale }] = await Promise.all([
    teacherHomeworkAssignmentsAction(),
    getDict(),
  ]);
  const localeName = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
  const sorted = sortTeacherHomeworks(items, sort, desc, localeName);
  const students = new Set(items.map((item) => item.studentId)).size;
  const waiting = items.filter((item) => item.submittedAt && !item.reviewedAt).length;
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const assignedDateFormat = new Intl.DateTimeFormat(localeName, {
    ...dateOptions,
    timeZone: SCHOOL_TIME_ZONE,
  });
  const lessonDateFormat = new Intl.DateTimeFormat(localeName, {
    ...dateOptions,
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const sortHref = (key: TeacherHomeworkSortKey) =>
    `/teacher/homeworks?sort=${key}&dir=${sort === key && !desc ? "desc" : "asc"}`;
  const sortButton = (key: TeacherHomeworkSortKey, label: string) => {
    const active = sort === key;
    return (
      <Link
        href={sortHref(key)}
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition",
          active
            ? "bg-accent-soft text-accent"
            : "text-muted hover:bg-surface-2 hover:text-content",
        )}
      >
        {label}
        <span aria-hidden className={active ? "" : "opacity-35"}>
          {active && desc ? "↓" : "↑"}
        </span>
      </Link>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-content">{t.teacherHomeworks.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.teacherHomeworks.hint}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Summary value={students} label={t.teacherHomeworks.students} Icon={IconUsers} />
          <Summary value={items.length} label={t.teacherHomeworks.assignments} Icon={IconCheckCircle} />
          <Summary value={waiting} label={t.teacherHomeworks.waiting} Icon={IconClock} accent />
        </div>
      </header>

      {items.length === 0 ? (
        <section className="rounded-2xl bg-surface p-10 text-center ring-1 ring-line">
          <IconCheckCircle className="mx-auto h-11 w-11 text-accent/60" />
          <p className="mt-3 text-sm font-bold text-content">{t.teacherHomeworks.empty}</p>
        </section>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line sm:px-4">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {t.teacherHomeworks.sortBy}
            </span>
            {sortButton("name", t.teacherHomeworks.sortName)}
            {sortButton("lesson", t.teacherHomeworks.sortLesson)}
            {sortButton("status", t.teacherHomeworks.sortStatus)}
            {sortButton("assigned", t.teacherHomeworks.sortAssigned)}
            <HomeworkBackgroundToggle
              showLabel={t.teacherHomeworks.showColors}
              hideLabel={t.teacherHomeworks.hideColors}
            />
          </section>

          <div className="flex flex-col gap-3">
            {sorted.map((item) => {
              const state = teacherHomeworkOverviewState(item);
              return (
                <HomeworkStatusSurface key={item.id} state={state}>
                  <Link
                    href={`/teacher/homeworks/${item.id}`}
                    className="group flex flex-col gap-4 px-4 py-4 transition hover:bg-white/35 dark:hover:bg-black/10 sm:flex-row sm:items-center sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar
                        name={item.studentName}
                        src={item.studentAvatarUrl}
                        className="h-11 w-11 shrink-0 text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-black text-content">
                            {item.studentName}
                          </h2>
                          <Status state={state} labels={t.teacherHomeworks} />
                        </div>
                        <h3 className="mt-1 truncate text-sm font-bold text-content">
                          {item.title}
                        </h3>
                        <p className="truncate text-xs font-semibold text-muted">
                          {item.homeworkTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
                          <span className="inline-flex items-center gap-1">
                            <IconCalendar className="h-3.5 w-3.5" />
                            {t.teacherHomeworks.assigned}: {assignedDateFormat.format(new Date(item.assignedAt))}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <IconClock className="h-3.5 w-3.5" />
                            {t.teacherHomeworks.nextLesson}: {item.nextLessonAt
                              ? lessonDateFormat.format(new Date(item.nextLessonAt))
                              : t.teacherHomeworks.noNextLesson}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <ProgressPill
                        label={t.teacherHomeworks.required}
                        done={item.requiredDone}
                        total={item.requiredTotal}
                      />
                      {item.bonusTotal > 0 && (
                        <ProgressPill
                          label={t.teacherHomeworks.bonuses}
                          done={item.bonusDone}
                          total={item.bonusTotal}
                        />
                      )}
                      <span className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-black text-white shadow-sm transition group-hover:brightness-95 sm:ml-2">
                        {t.teacherHomeworks.check}
                        <IconChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </HomeworkStatusSurface>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Summary({
  value,
  label,
  Icon,
  accent = false,
}: {
  value: number;
  label: string;
  Icon: typeof IconUsers;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "min-w-20 rounded-xl px-3 py-2 ring-1 sm:min-w-28",
      accent ? "bg-accent-soft ring-accent/25" : "bg-surface ring-line",
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-faint")} />
        <span className="text-lg font-black leading-none text-content">{value}</span>
      </div>
      <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-wide text-faint sm:block">
        {label}
      </p>
    </div>
  );
}

function ProgressPill({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <span className="rounded-lg bg-surface/75 px-2.5 py-1.5 text-[11px] font-bold text-muted ring-1 ring-line backdrop-blur-sm">
      {label} <span className="text-content">{done}/{total}</span>
    </span>
  );
}

function Status({
  state,
  labels,
}: {
  state: TeacherHomeworkOverviewState;
  labels: {
    reviewed: string;
    submitted: string;
    inProgress: string;
    notStarted: string;
  };
}) {
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
      state === "reviewed"
        ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950"
        : state === "submitted"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
          : state === "inProgress"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
            : "bg-surface-2 text-faint",
    )}>
      {labels[state]}
    </span>
  );
}
