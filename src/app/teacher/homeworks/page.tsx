import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  HomeworkBackgroundToggle,
  HomeworkStatusSurface,
} from "@/components/teacher/homework-status-surface";
import {
  IconCalendar,
  IconCap,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEye,
  IconFile,
  IconFolder,
  IconTrendUp,
  IconUsers,
} from "@/components/icons";
import {
  teacherHomeworkAssignmentsAction,
  type TeacherHomeworkAssignmentCard,
} from "@/lib/actions/lesson-homework";
import { getDict } from "@/lib/i18n/server";
import { SCHOOL_TIME_ZONE, SCHEDULE_FORMAT_TIME_ZONE } from "@/lib/schedule-time";
import {
  groupTeacherHomeworksByStudent,
  sortTeacherHomeworks,
  teacherHomeworkOverviewState,
  type TeacherHomeworkOverviewState,
  type TeacherHomeworkStudentGroup,
} from "@/lib/teacher-homework-order";
import { cn } from "@/lib/utils";

const FOLDER_THEMES = [
  {
    tab: "bg-amber-300/90 ring-amber-500/20 dark:bg-amber-700/80",
    body: "from-amber-100 via-yellow-50 to-orange-100 ring-amber-300/70 dark:from-amber-950/80 dark:via-stone-950 dark:to-orange-950/70 dark:ring-amber-800",
    accent: "text-amber-700 dark:text-amber-300",
    wash: "bg-amber-400/20 dark:bg-amber-500/10",
  },
  {
    tab: "bg-cyan-300/90 ring-cyan-500/20 dark:bg-cyan-800/80",
    body: "from-cyan-100 via-sky-50 to-blue-100 ring-cyan-300/70 dark:from-cyan-950/80 dark:via-slate-950 dark:to-blue-950/70 dark:ring-cyan-800",
    accent: "text-cyan-700 dark:text-cyan-300",
    wash: "bg-cyan-400/20 dark:bg-cyan-500/10",
  },
  {
    tab: "bg-violet-300/90 ring-violet-500/20 dark:bg-violet-800/80",
    body: "from-violet-100 via-fuchsia-50 to-pink-100 ring-violet-300/70 dark:from-violet-950/80 dark:via-slate-950 dark:to-fuchsia-950/70 dark:ring-violet-800",
    accent: "text-violet-700 dark:text-violet-300",
    wash: "bg-violet-400/20 dark:bg-violet-500/10",
  },
  {
    tab: "bg-emerald-300/90 ring-emerald-500/20 dark:bg-emerald-800/80",
    body: "from-emerald-100 via-teal-50 to-lime-100 ring-emerald-300/70 dark:from-emerald-950/80 dark:via-slate-950 dark:to-teal-950/70 dark:ring-emerald-800",
    accent: "text-emerald-700 dark:text-emerald-300",
    wash: "bg-emerald-400/20 dark:bg-emerald-500/10",
  },
] as const;

type FolderLabels = {
  homeworksCount: string;
  notStarted: string;
  inProgress: string;
  submitted: string;
  doneCount: string;
  openFolder: string;
};

function themeForStudent(studentId: string) {
  const hash = [...studentId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return FOLDER_THEMES[hash % FOLDER_THEMES.length];
}

export default async function TeacherHomeworksPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "status" ? "status" : "assigned";
  const desc = params.dir ? params.dir === "desc" : sort === "assigned";
  const [items, { t, locale }] = await Promise.all([
    teacherHomeworkAssignmentsAction(),
    getDict(),
  ]);
  const localeName = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
  const groups = groupTeacherHomeworksByStudent(items, localeName);
  const selectedGroup = groups.find((group) => group.studentId === params.student) ?? null;
  const sorted = selectedGroup
    ? sortTeacherHomeworks(selectedGroup.items, sort, desc, localeName)
    : [];
  const students = groups.length;
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
  const sortHref = (key: "status" | "assigned") => {
    if (!selectedGroup) return "/teacher/homeworks";
    const nextDesc = sort === key ? !desc : key === "assigned";
    return `/teacher/homeworks?student=${encodeURIComponent(selectedGroup.studentId)}&sort=${key}&dir=${nextDesc ? "desc" : "asc"}`;
  };
  const sortButton = (key: "status" | "assigned", label: string) => {
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
          <p className="mt-1 text-sm text-muted">
            {selectedGroup ? selectedGroup.studentName : t.teacherHomeworks.hint}
          </p>
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
      ) : selectedGroup ? (
        <>
          <Link
            href="/teacher/homeworks"
            className="flex w-fit items-center gap-1.5 text-[13px] font-bold text-muted transition hover:text-accent"
          >
            <IconChevronLeft className="h-4 w-4" />
            {t.teacherHomeworks.backToFolders}
          </Link>

          <StudentFolderHeader group={selectedGroup} labels={t.teacherHomeworks} />

          <section className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line sm:px-4">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {t.teacherHomeworks.sortFolderBy}
            </span>
            {sortButton("status", t.teacherHomeworks.sortStatus)}
            {sortButton("assigned", t.teacherHomeworks.sortAssigned)}
            <HomeworkBackgroundToggle
              showLabel={t.teacherHomeworks.showColors}
              hideLabel={t.teacherHomeworks.hideColors}
            />
          </section>

          <div className="flex flex-col gap-3">
            {sorted.map((item) => (
              <HomeworkCard
                key={item.id}
                item={item}
                labels={t.teacherHomeworks}
                assignedDateFormat={assignedDateFormat}
                lessonDateFormat={lessonDateFormat}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sm ring-1 ring-line">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconFolder className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-content">{t.teacherHomeworks.folders}</h2>
              <p className="mt-0.5 text-xs text-muted">{t.teacherHomeworks.folderHint}</p>
            </div>
          </section>

          <div className="grid gap-5 pt-2 lg:grid-cols-2">
            {groups.map((group) => (
              <StudentFolder
                key={group.studentId}
                group={group}
                labels={t.teacherHomeworks}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StudentFolder({
  group,
  labels,
}: {
  group: TeacherHomeworkStudentGroup<TeacherHomeworkAssignmentCard>;
  labels: FolderLabels;
}) {
  const theme = themeForStudent(group.studentId);
  return (
    <Link
      href={`/teacher/homeworks?student=${encodeURIComponent(group.studentId)}`}
      className="group relative block pt-7 outline-none"
    >
      <span className={cn(
        "absolute left-5 top-0 flex h-9 max-w-[72%] items-center gap-1.5 rounded-t-2xl px-4 text-[11px] font-black uppercase tracking-wide ring-1 transition-transform duration-300 group-hover:-translate-y-1",
        theme.tab,
        theme.accent,
      )}>
        <IconFolder className="h-4 w-4" />
        {labels.homeworksCount}: {group.counts.total}
      </span>
      <article className={cn(
        "relative overflow-hidden rounded-[26px] rounded-tl-[18px] bg-gradient-to-br p-5 shadow-sm ring-1 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-accent",
        theme.body,
      )}>
        <span className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl",
          theme.wash,
        )} />
        <IconCap className={cn(
          "pointer-events-none absolute -right-2 bottom-1 h-28 w-28 rotate-[-10deg] opacity-[0.08] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110",
          theme.accent,
        )} />

        <div className="relative flex items-center gap-3">
          <Avatar
            name={group.studentName}
            src={group.studentAvatarUrl}
            className="h-12 w-12 shrink-0 text-sm shadow-sm ring-2 ring-white/70 dark:ring-white/10"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-black text-content">{group.studentName}</h3>
            <p className={cn("mt-0.5 text-xs font-bold", theme.accent)}>
              {group.counts.total} · {labels.homeworksCount}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/55 text-content shadow-sm ring-1 ring-white/60 transition group-hover:translate-x-1 dark:bg-black/20 dark:ring-white/10">
            <IconChevronRight className="h-4 w-4" />
          </span>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FolderMetric value={group.counts.notStarted} label={labels.notStarted} Icon={IconClock} tone="plain" />
          <FolderMetric value={group.counts.inProgress} label={labels.inProgress} Icon={IconTrendUp} tone="progress" />
          <FolderMetric value={group.counts.submitted} label={labels.submitted} Icon={IconEye} tone="waiting" />
          <FolderMetric value={group.counts.reviewed} label={labels.doneCount} Icon={IconCheckCircle} tone="done" />
        </div>

        <div className="relative mt-4 flex items-center justify-end gap-1 text-xs font-black text-content/75">
          {labels.openFolder}
          <IconChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
        </div>
      </article>
    </Link>
  );
}

function StudentFolderHeader({
  group,
  labels,
}: {
  group: TeacherHomeworkStudentGroup<TeacherHomeworkAssignmentCard>;
  labels: FolderLabels;
}) {
  const theme = themeForStudent(group.studentId);
  return (
    <section className={cn(
      "relative overflow-hidden rounded-[26px] bg-gradient-to-br p-5 shadow-sm ring-1 sm:p-6",
      theme.body,
    )}>
      <span className={cn(
        "pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl",
        theme.wash,
      )} />
      <IconFolder className={cn(
        "pointer-events-none absolute -right-3 -bottom-5 h-40 w-40 opacity-[0.07]",
        theme.accent,
      )} />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-64">
          <Avatar
            name={group.studentName}
            src={group.studentAvatarUrl}
            className="h-14 w-14 shrink-0 text-base shadow-sm ring-2 ring-white/70 dark:ring-white/10"
          />
          <div className="min-w-0">
            <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", theme.accent)}>
              {labels.homeworksCount}
            </p>
            <h2 className="truncate text-xl font-black text-content">{group.studentName}</h2>
          </div>
        </div>
        <div className="relative grid flex-1 grid-cols-2 gap-2 sm:grid-cols-5">
          <FolderMetric value={group.counts.total} label={labels.homeworksCount} Icon={IconFile} tone="total" />
          <FolderMetric value={group.counts.notStarted} label={labels.notStarted} Icon={IconClock} tone="plain" />
          <FolderMetric value={group.counts.inProgress} label={labels.inProgress} Icon={IconTrendUp} tone="progress" />
          <FolderMetric value={group.counts.submitted} label={labels.submitted} Icon={IconEye} tone="waiting" />
          <FolderMetric value={group.counts.reviewed} label={labels.doneCount} Icon={IconCheckCircle} tone="done" />
        </div>
      </div>
    </section>
  );
}

function FolderMetric({
  value,
  label,
  Icon,
  tone,
}: {
  value: number;
  label: string;
  Icon: typeof IconUsers;
  tone: "total" | "plain" | "progress" | "waiting" | "done";
}) {
  return (
    <div className={cn(
      "min-w-0 rounded-xl px-2.5 py-2 shadow-sm ring-1 backdrop-blur-sm",
      tone === "progress"
        ? "bg-amber-100/85 text-amber-800 ring-amber-300/70 dark:bg-amber-950/55 dark:text-amber-200 dark:ring-amber-800"
        : tone === "waiting"
          ? "bg-emerald-100/85 text-emerald-800 ring-emerald-300/70 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800"
          : tone === "done"
            ? "bg-emerald-600/90 text-white ring-emerald-700/25 dark:bg-emerald-600/75 dark:ring-emerald-400/20"
            : tone === "total"
              ? "bg-white/80 text-content ring-white/80 dark:bg-black/25 dark:ring-white/10"
              : "bg-surface/70 text-muted ring-line/70",
    )}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-base font-black leading-none">{value}</span>
      </div>
      <p className="mt-1 truncate text-[9px] font-black uppercase tracking-wide opacity-80" title={label}>
        {label}
      </p>
    </div>
  );
}

function HomeworkCard({
  item,
  labels,
  assignedDateFormat,
  lessonDateFormat,
}: {
  item: TeacherHomeworkAssignmentCard;
  labels: {
    assigned: string;
    nextLesson: string;
    noNextLesson: string;
    required: string;
    bonuses: string;
    check: string;
    reviewed: string;
    submitted: string;
    inProgress: string;
    notStarted: string;
  };
  assignedDateFormat: Intl.DateTimeFormat;
  lessonDateFormat: Intl.DateTimeFormat;
}) {
  const state = teacherHomeworkOverviewState(item);
  return (
    <HomeworkStatusSurface state={state}>
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
              <h2 className="truncate text-sm font-black text-content">{item.title}</h2>
              <Status state={state} labels={labels} />
            </div>
            <p className="truncate text-xs font-semibold text-muted">{item.homeworkTitle}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1">
                <IconCalendar className="h-3.5 w-3.5" />
                {labels.assigned}: {assignedDateFormat.format(new Date(item.assignedAt))}
              </span>
              <span className="inline-flex items-center gap-1">
                <IconClock className="h-3.5 w-3.5" />
                {labels.nextLesson}: {item.nextLessonAt
                  ? lessonDateFormat.format(new Date(item.nextLessonAt))
                  : labels.noNextLesson}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <ProgressPill label={labels.required} done={item.requiredDone} total={item.requiredTotal} />
          {item.bonusTotal > 0 && (
            <ProgressPill label={labels.bonuses} done={item.bonusDone} total={item.bonusTotal} />
          )}
          <span className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-accent px-3 text-xs font-black text-white shadow-sm transition group-hover:brightness-95 sm:ml-2">
            {labels.check}
            <IconChevronRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </HomeworkStatusSurface>
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
