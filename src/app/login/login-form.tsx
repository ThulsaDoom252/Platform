"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [login, setLogin] = useState(quickAccounts[0]?.login ?? "");
  const [password, setPassword] = useState(quickAccounts[0]?.password ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [autoSubmit, setAutoSubmit] = useState(false);

  // Отправляем только после того, как новые значения реально попали в поля,
  // иначе форма уходит со старым содержимым.
  useEffect(() => {
    if (!autoSubmit) return;
    setAutoSubmit(false);
    formRef.current?.requestSubmit();
  }, [autoSubmit]);

  function quickLogin(l: string, p: string) {
    setLogin(l);
    setPassword(p);
    setAutoSubmit(true);
  }

  return (
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
          <p className="text-[11px] font-medium text-muted">Быстрый вход (черновик)</p>
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

      <p className="text-center text-xs text-faint">
        Аккаунты создаёт только учитель. Забыл пароль — обратись к учителю напрямую.
      </p>
    </form>
  );
}
