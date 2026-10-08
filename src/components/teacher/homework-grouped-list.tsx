"use client";

import { useMemo, type ReactNode } from "react";
import { IconCalendar, IconCheck, IconFile, IconLayers } from "@/components/icons";
import {
  groupTeacherHomeworkContent,
  groupTeacherHomeworkDates,
  type TeacherHomeworkActivityGroupType,
  type TeacherHomeworkGroupable,
} from "@/lib/teacher-homework-groups";
import { SCHOOL_TIME_ZONE } from "@/lib/schedule-time";
import { useLocalFlag } from "@/lib/use-local-flag";
import { cn } from "@/lib/utils";
import { groupTeacherHomeworkPriorities, readTeacherHomeworkSort, sortTeacherHomeworks,
  type TeacherHomeworkOrderable, type TeacherHomeworkOverviewState, type TeacherHomeworkSortState } from "@/lib/teacher-homework-order";
import { HomeworkSortControls, useHomeworkSort, type HomeworkSortLabels } from "./homework-sort-controls";

type HomeworkListCard = TeacherHomeworkGroupable & { card: ReactNode; order?: TeacherHomeworkOrderable };
type GroupingLabels = {
  grouping: string;
  groupByAssignedDate: string;
  groupByHomeworkType: string;
  interactiveHomeworks: string;
  activities: string;
  unknownAssignedDate: string;
  activityTypes: Record<TeacherHomeworkActivityGroupType, string>;
};

export function HomeworkGroupedList({
  cards,
  sortControls,
  locale,
  dateDescending = true,
  labels,
  initialSort,
  sortLabels,
  statusLabels,
}: {
  cards: HomeworkListCard[];
  sortControls: ReactNode;
  locale: string;
  dateDescending?: boolean;
  labels: GroupingLabels;
  initialSort?: TeacherHomeworkSortState;
  sortLabels?: HomeworkSortLabels;
  statusLabels?: Record<TeacherHomeworkOverviewState, string>;
}) {
  // Store the opt-out so a first visit (including SSR) enables both groups.
  const [datesDisabled, setDatesDisabled] = useLocalFlag("teacher-homework-date-groups-disabled");
  const [typesDisabled, setTypesDisabled] = useLocalFlag("teacher-homework-type-groups-disabled");
  const { state: sorting, change } = useHomeworkSort(initialSort ?? readTeacherHomeworkSort(undefined, undefined), "assigned");
  const dateGroups = useMemo(() => {
    const orderable = cards.map((item) => ({ ...item, ...(item.order ?? {
      studentName: "", nextLessonAt: null, submittedAt: null, reviewedAt: null, started: false,
    }) }));
    const sorted = sortLabels ? sortTeacherHomeworks(orderable, sorting.key, sorting.desc, locale) : orderable;
    const buckets = sortLabels ? groupTeacherHomeworkPriorities(sorted, sorting.key, sorting.desc) : [{ state: null, items: sorted }];
    return buckets.flatMap((bucket) => groupTeacherHomeworkDates(bucket.items, !datesDisabled,
      sortLabels && sorting.key === "assigned" ? sorting.desc : dateDescending)
      .map((group, index) => ({ ...group, key: `${bucket.state ?? "all"}:${group.key}`,
        sortState: bucket.state, priorityState: index === 0 ? bucket.state : null })));
  }, [cards, dateDescending, datesDisabled, sortLabels, sorting.key, sorting.desc, locale]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, {
    timeZone: SCHOOL_TIME_ZONE, year: "numeric", month: "long", day: "numeric",
  }), [locale]);

  const renderCards = (items: HomeworkListCard[]) => (
    <div className="flex min-w-0 flex-col gap-3">
      {items.map((item) => <div key={`${item.kind}:${item.id}`} className="min-w-0">{item.card}</div>)}
    </div>
  );

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          {sortLabels && <HomeworkSortControls state={sorting} labels={sortLabels} onChange={change} />}
          {sortControls}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{labels.grouping}</span>
          <GroupingToggle checked={!datesDisabled} onChange={(checked) => setDatesDisabled(!checked)} label={labels.groupByAssignedDate} Icon={IconCalendar} />
          <GroupingToggle checked={!typesDisabled} onChange={(checked) => setTypesDisabled(!checked)} label={labels.groupByHomeworkType} Icon={IconLayers} />
        </div>
      </section>

      <div id="teacher-homework-grouped-list" className="flex flex-col gap-5">
        {dateGroups.map((dateGroup) => (
          <section
            key={dateGroup.key}
            data-homework-assigned-day={datesDisabled ? undefined : dateGroup.day ?? "undated"}
            data-homework-sort-state={dateGroup.sortState ?? undefined}
            className={cn("min-w-0", !datesDisabled && "rounded-3xl border border-line bg-surface-2/45 p-3 sm:p-4")}
          >
            {dateGroup.priorityState && statusLabels && <h2 className="mb-3 rounded-xl bg-accent-soft px-3 py-2 text-sm font-black text-accent">
              {statusLabels[dateGroup.priorityState]}
            </h2>}
            {!datesDisabled && (
              <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><IconCalendar className="h-4 w-4" /></span>
                <h2 className="min-w-0 flex-1 text-base font-black text-content sm:text-lg">
                  {dateGroup.day
                    ? dateFormat.format(new Date(dateGroup.items[0].assignedAt))
                    : labels.unknownAssignedDate}
                </h2>
                <GroupCount count={dateGroup.items.length} />
              </div>
            )}
            <div className="flex flex-col gap-5">
              {groupTeacherHomeworkContent(dateGroup.items, !typesDisabled).map((group) => (
                <section key={group.kind} data-homework-group={group.kind} className="min-w-0">
                  {group.kind !== "ALL" && (
                    <div className="mb-3 flex items-center gap-2 text-accent">
                      {group.kind === "LESSON" ? <IconFile className="h-4 w-4" /> : <IconLayers className="h-4 w-4" />}
                      <h3 className="min-w-0 flex-1 text-sm font-black">{group.kind === "LESSON" ? labels.interactiveHomeworks : labels.activities}</h3>
                      <GroupCount count={group.items.length} />
                    </div>
                  )}
                  {group.kind === "ACTIVITY" ? (
                    <div className="flex flex-col gap-4">
                      {group.activityGroups.map((activityGroup) => (
                        <section key={activityGroup.type} data-homework-activity-type={activityGroup.type} className="min-w-0">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                            <h4 className="text-xs font-bold text-muted">{labels.activityTypes[activityGroup.type]}</h4>
                            <span className="text-[11px] font-semibold text-faint">{activityGroup.items.length}</span>
                          </div>
                          {renderCards(activityGroup.items)}
                        </section>
                      ))}
                    </div>
                  ) : renderCards(group.items)}
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function GroupingToggle({ checked, onChange, label, Icon }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  Icon: typeof IconCalendar;
}) {
  return (
    <label className={cn(
      "relative flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-bold ring-1 transition focus-within:ring-2 focus-within:ring-accent",
      checked ? "bg-accent-soft text-accent ring-accent/30" : "bg-surface-2 text-muted ring-line hover:text-content",
    )}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-controls="teacher-homework-grouped-list" className="sr-only" />
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      <span aria-hidden className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-accent bg-accent text-white" : "border-faint/50")}>
        {checked && <IconCheck className="h-3 w-3" />}
      </span>
    </label>
  );
}

function GroupCount({ count }: { count: number }) {
  return <span className="rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-black text-accent">{count}</span>;
}
