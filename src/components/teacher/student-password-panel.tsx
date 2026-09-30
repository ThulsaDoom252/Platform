"use client";

import { useActionState, useState, useTransition } from "react";
import {
  revealStudentPasswordAction,
  updateStudentPasswordAction,
  type StudentPasswordState,
} from "@/lib/actions/teacher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconEye, IconEyeOff } from "@/components/icons";

const initialState: StudentPasswordState = {};

export function StudentPasswordPanel({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(
    updateStudentPasswordAction,
    initialState,
  );
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [visible, setVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [revealing, startReveal] = useTransition();
  const currentPassword = state.password ?? revealed;

  function reveal() {
    setRevealError(null);
    setUnavailable(false);
    startReveal(async () => {
      const result = await revealStudentPasswordAction(studentId);
      if (result.password) {
        setRevealed(result.password);
        setVisible(true);
      } else {
        setRevealError(result.error ?? null);
        setUnavailable(Boolean(result.unavailable));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пароль ученика</CardTitle>
        <CardDescription>
          Посмотреть текущий сохранённый пароль или установить новый.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {currentPassword ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`current-password-${studentId}`} className="text-xs font-semibold text-muted">
              Текущий пароль
            </label>
            <div className="flex gap-2">
              <Input
                id={`current-password-${studentId}`}
                value={currentPassword}
                type={visible ? "text" : "password"}
                readOnly
                autoComplete="off"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisible((value) => !value)}
                title={visible ? "Скрыть пароль" : "Показать пароль"}
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
              >
                {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={revealing}
              onClick={reveal}
            >
              <IconEye className="h-4 w-4" />
              {revealing ? "Проверяю…" : "Показать текущий пароль"}
            </Button>
            {unavailable && (
              <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                Старый пароль был сохранён только как необратимый хеш. Установи новый — после этого он будет доступен здесь.
              </p>
            )}
            {revealError && <p className="mt-2 text-xs text-rose-500">{revealError}</p>}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="studentId" value={studentId} />
          <div className="relative min-w-0 flex-1">
            <Input
              name="newPassword"
              type={newVisible ? "text" : "password"}
              placeholder="Новый пароль"
              autoComplete="new-password"
              minLength={1}
              maxLength={128}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setNewVisible((value) => !value)}
              title={newVisible ? "Скрыть пароль" : "Показать пароль"}
              aria-label={newVisible ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-content"
            >
              {newVisible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Сохраняю…" : "Сменить пароль"}
          </Button>
        </form>

        {state.ok && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Пароль изменён. Ученик уже может войти с ним.
          </p>
        )}
        {state.error && <p className="text-xs text-rose-500">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
