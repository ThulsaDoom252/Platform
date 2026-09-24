"use client";

import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  loginAction,
  testStudentLoginAction,
  type LoginState,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/avatar";
import { IconChevronRight, IconUsers } from "@/components/icons";

const initialState: LoginState = {};

type QuickAccount = { label: string; login: string; password: string };

/**
 * Быстрый вход — только для локальной разработки.
 * Аккаунты берутся из NEXT_PUBLIC_QUICK_LOGIN ("Подпись:логин:пароль" через запятую).
 * Если переменная не задана, блок не показывается и поля пустые.
 */
function readQuickAccounts(): QuickAccount[] {
  const raw = process.env.NEXT_PUBLIC_QUICK_LOGIN;
  if (!raw) return [];
  return raw
    .split(",")
    .map((chunk) => chunk.split(":").map((s) => s.trim()))
    .filter((parts) => parts.length === 3 && parts.every(Boolean))
    .map(([label, login, password]) => ({ label, login, password }));
}

const quickAccounts = readQuickAccounts();

type TestStudent = {
  id: string;
  name: string;
  login: string;
  avatarUrl: string | null;
  level: string | null;
};

export function LoginForm({ testStudents = [] }: { testStudents?: TestStudent[] }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [login, setLogin] = useState(quickAccounts[0]?.login ?? "");
  const [password, setPassword] = useState(quickAccounts[0]?.password ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  function quickLogin(l: string, p: string) {
    // FormData должна увидеть новые controlled-значения уже в этом же клике.
    flushSync(() => {
      setLogin(l);
      setPassword(p);
    });
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-5">
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login" className="text-sm font-medium text-content">
            Логин
          </label>
          <Input
            id="login"
            name="login"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {state.error && <p className="text-sm text-rose-500">{state.error}</p>}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Входим..." : "Войти"}
        </Button>

        {quickAccounts.length > 0 && (
          <div className="mt-1 rounded-xl bg-surface-2 p-3">
            <p className="text-[11px] font-medium text-muted">
              Быстрый вход из настроек
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickAccounts.map((a) => (
                <button
                  key={a.login}
                  type="button"
                  onClick={() => quickLogin(a.login, a.password)}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-content transition hover:border-accent hover:text-accent"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {testStudents.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft/40">
          <div className="flex items-center gap-3 border-b border-accent/15 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
              <IconUsers className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-bold text-content">Тестовый вход ученика</p>
              <p className="text-[10px] font-medium text-muted">
                Только локальная разработка · пароль не нужен
              </p>
            </div>
          </div>

          <form action={testStudentLoginAction} className="max-h-64 overflow-y-auto p-2">
            {testStudents.map((student) => (
              <button
                key={student.id}
                type="submit"
                name="studentId"
                value={student.id}
                className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface hover:shadow-sm"
              >
                <Avatar
                  name={student.name}
                  src={student.avatarUrl}
                  className="h-10 w-10 text-sm ring-2 ring-surface"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-content">
                    {student.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    @{student.login}
                    {student.level ? ` · ${student.level}` : ""}
                  </span>
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </button>
            ))}
          </form>
        </section>
      )}

      <p className="text-center text-xs text-faint">
        Аккаунты создаёт только учитель. Забыл пароль — обратись к учителю напрямую.
      </p>
    </div>
  );
}
