"use client";

import { useActionState, useState } from "react";
import { useTransition } from "react";
import {
  loginAction,
  quickTeacherLoginAction,
  type LoginState,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = {};

export function LoginForm({ quickLogin }: { quickLogin: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickBusy, startQuick] = useTransition();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login" className="text-sm font-medium text-content">
          Логин
        </label>
        <Input id="login" name="login" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-content">
          Пароль
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && <p className="text-sm text-rose-500">{state.error}</p>}

      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Входим..." : "Войти"}
      </Button>

      <p className="text-center text-xs text-faint">
        Аккаунты создаёт только учитель. Забыл пароль — обратись к учителю напрямую.
      </p>

      {/* Быстрый вход виден только на своей машине: на развёрнутом
          сайте такой кнопки нет, иначе пароль учителя не значил бы
          ничего. */}
      {quickLogin && (
        <div className="mt-2 border-t border-line pt-4">
          <button
            type="button"
            disabled={quickBusy}
            onClick={() =>
              startQuick(async () => {
                const result = await quickTeacherLoginAction();
                setQuickError(result?.error ?? null);
              })
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent-soft text-sm font-semibold text-accent transition hover:opacity-90 disabled:opacity-50"
          >
            {quickBusy ? "Входим…" : "Быстрый вход учителем"}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-faint">
            Только при локальной разработке
          </p>
          {quickError && (
            <p className="mt-1.5 text-center text-sm text-rose-500">{quickError}</p>
          )}
        </div>
      )}
    </form>
  );
}
