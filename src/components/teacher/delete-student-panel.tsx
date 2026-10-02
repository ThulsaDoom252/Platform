"use client";

import { useActionState, useState } from "react";
import {
  deleteStudentAction,
  type DeleteStudentState,
} from "@/lib/actions/teacher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconTrash } from "@/components/icons";

const initialState: DeleteStudentState = {};

export function DeleteStudentPanel({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(deleteStudentAction, initialState);
  const confirmed = confirmation.trim() === studentName;

  return (
    <Card className="border-rose-200 dark:border-rose-950/80">
      <CardHeader>
        <CardTitle className="text-rose-700 dark:text-rose-300">Удаление ученика</CardTitle>
        <CardDescription>
          Полностью удаляет аккаунт ученика и все связанные с ним данные.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          <IconTrash className="h-4 w-4" />
          Удалить ученика
        </Button>

        {open && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-student-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !pending) setOpen(false);
            }}
          >
            <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-950 dark:bg-slate-950">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300">
                <IconTrash className="h-6 w-6" />
              </div>
              <h2 id="delete-student-title" className="mt-4 text-xl font-bold text-content">
                Удалить {studentName}?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Это действие нельзя отменить. Будут удалены профиль, расписание и история
                уроков, скрипты, домашки, сообщения, материалы, словники, заметки, игры и
                результаты ученика.
              </p>

              <form action={formAction} className="mt-5 flex flex-col gap-4">
                <input type="hidden" name="studentId" value={studentId} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`delete-student-${studentId}`} className="text-sm font-semibold text-content">
                    Введи <span className="text-rose-600 dark:text-rose-300">{studentName}</span> для подтверждения
                  </label>
                  <Input
                    id={`delete-student-${studentId}`}
                    name="confirmation"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    disabled={pending}
                  />
                </div>

                {state.error && (
                  <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{state.error}</p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" variant="destructive" disabled={!confirmed || pending}>
                    <IconTrash className="h-4 w-4" />
                    {pending ? "Удаляю…" : "Удалить навсегда"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
