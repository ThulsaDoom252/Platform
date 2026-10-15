import type { ReactNode } from "react";

/** The same live controls are placed once; switching views does not reset class state. */
export function ClassMaterialToolbar({
  lesson,
  actions,
  participants,
  student = false,
  groupSections = false,
}: {
  lesson?: ReactNode;
  actions?: ReactNode;
  participants?: ReactNode;
  student?: boolean;
  groupSections?: boolean;
}) {
  if (student)
    return (
      <div
        data-participants-placement="student-inline"
        className="flex min-w-0 justify-end rounded-2xl bg-surface p-3.5 ring-1 ring-line"
      >
        {participants}
      </div>
    );
  if (!participants && !groupSections)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {lesson}
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">{actions}</div>
      </div>
    );
  return (
    <div className="class-toolbar-container min-w-0">
      <div className="class-material-toolbar" data-participants-placement={participants ? "teacher-inline" : undefined}>
        <div className="class-toolbar-sections flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
          <div className="class-toolbar-lesson shrink-0">{lesson}</div>
          <div className="class-toolbar-actions flex shrink-0 items-center gap-1">{actions}</div>
        </div>
        {participants && <div className="class-toolbar-participants min-w-0">{participants}</div>}
      </div>
    </div>
  );
}
