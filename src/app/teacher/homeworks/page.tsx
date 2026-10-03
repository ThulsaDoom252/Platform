import Link from "next/link";
import { Avatar } from "@/components/avatar";
import {
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconUsers,
} from "@/components/icons";
import {
  teacherHomeworkAssignmentsAction,
  type TeacherHomeworkAssignmentCard,
} from "@/lib/actions/lesson-homework";
import { getDict } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

type StudentGroup = {
  id: string;
  name: string;
  avatarUrl: string | null;
  items: TeacherHomeworkAssignmentCard[];
};

export default async function TeacherHomeworksPage() {
  const [items, { t, locale }] = await Promise.all([
    teacherHomeworkAssignmentsAction(),
    getDict(),
  ]);
  const groups = [...items.reduce((map, item) => {
    const group = map.get(item.studentId) ?? {
      id: item.studentId,
      name: item.studentName,
      avatarUrl: item.studentAvatarUrl,
      items: [],
    };
    group.items.push(item);
    map.set(item.studentId, group);
    return map;
  }, new Map<string, StudentGroup>()).values()].sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
  const waiting = items.filter((item) => item.submittedAt && !item.reviewedAt).length;
  const localeName = locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : "en-US";
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeName, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-content">{t.teacherHomeworks.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.teacherHomeworks.hint}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Summary value={groups.length} label={t.teacherHomeworks.students} Icon={IconUsers} />
          <Summary value={items.length} label={t.teacherHomeworks.assignments} Icon={IconCheckCircle} />
          <Summary value={waiting} label={t.teacherHomeworks.waiting} Icon={IconClock} accent />
        </div>
      </header>

      {groups.length === 0 ? (
        <section className="rounded-2xl bg-surface p-10 text-center ring-1 ring-line">
          <IconCheckCircle className="mx-auto h-11 w-11 text-accent/60" />
          <p className="mt-3 text-sm font-bold text-content">{t.teacherHomeworks.empty}</p>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.id} className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-line">
              <div className="flex items-center gap-3 border-b border-line bg-surface-2/70 px-4 py-3 sm:px-5">
                <Avatar name={group.name} src={group.avatarUrl} className="h-10 w-10 text-sm" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-content">{group.name}</h2>
                  <p className="text-xs text-faint">
                    {group.items.length} {t.teacherHomeworks.assignments.toLocaleLowerCase(localeName)}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-black text-accent">
                  {group.items.filter((item) => item.submittedAt && !item.reviewedAt).length}/{group.items.length}
                </span>
              </div>

              <div className="divide-y divide-line">
                {group.items.map((item) => {
                  const state = item.reviewedAt
                    ? "reviewed"
                    : item.submittedAt
                      ? "submitted"
                    : item.started
                      ? "inProgress"
                      : "notStarted";
                  return (
                    <Link
                      key={item.id}
                      href={`/teacher/homeworks/${item.id}`}
                      className="group flex flex-col gap-3 px-4 py-4 transition hover:bg-accent-soft/35 sm:flex-row sm:items-center sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-black text-content">{item.title}</h3>
                          <Status state={state} labels={t.teacherHomeworks} />
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold text-muted">
                          {item.homeworkTitle}
                        </p>
                        <p className="mt-1 text-[11px] text-faint">
                          {t.teacherHomeworks.updated}: {formatDate(item.updatedAt)}
                        </p>
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
                  );
                })}
              </div>
            </section>
          ))}
        </div>
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
      <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-wide text-faint sm:block">{label}</p>
    </div>
  );
}

function ProgressPill({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <span className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] font-bold text-muted ring-1 ring-line">
      {label} <span className="text-content">{done}/{total}</span>
    </span>
  );
}

function Status({
  state,
  labels,
}: {
  state: "reviewed" | "submitted" | "inProgress" | "notStarted";
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
        ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
        : state === "submitted"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
        : state === "inProgress"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
          : "bg-surface-2 text-faint",
    )}>
      {labels[state]}
    </span>
  );
}
