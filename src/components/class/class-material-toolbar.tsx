import type { ReactNode } from "react";

/** The same live controls are placed once; switching views does not reset class state. */
export function ClassMaterialToolbar({
  lesson,
  actions,
  participants,
  student = false,
}: {
  lesson?: ReactNode;
  actions?: ReactNode;
  participants?: ReactNode;
  student?: boolean;
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
  if (!participants)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {lesson}
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">{actions}</div>
      </div>
    );
  return (
    <div className="class-toolbar-container min-w-0">
      <div className="class-material-toolbar" data-participants-placement="teacher-inline">
        <div className="class-toolbar-lesson">{lesson}</div>
        <div className="class-toolbar-participants min-w-0">{participants}</div>
        <div className="class-toolbar-actions flex max-w-full flex-wrap items-center justify-end gap-1">{actions}</div>
      </div>
    </div>
  );
}
