"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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
    </form>
  );
}
