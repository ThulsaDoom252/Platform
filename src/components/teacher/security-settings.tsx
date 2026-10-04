"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, UserRoundCog } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changeTeacherLoginAction,
  changeTeacherPasswordAction,
} from "@/lib/actions/account-security";
import type { SecurityActionState, SecurityErrorCode } from "@/lib/account-security";

const initialState: SecurityActionState = {};

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-muted">
      {label}
      <span className="relative block">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          required
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          title={visible ? t.settings.hidePassword : t.settings.showPassword}
          aria-label={visible ? t.settings.hidePassword : t.settings.showPassword}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-content"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function StatusMessage({ state }: { state: SecurityActionState }) {
  const { t } = useT();
  const errors: Record<SecurityErrorCode, string> = {
    AUTH_REQUIRED: t.settings.securityAuthRequired,
    CURRENT_PASSWORD_REQUIRED: t.settings.currentPasswordRequired,
    WRONG_PASSWORD: t.settings.wrongPassword,
    LOGIN_INVALID: t.settings.loginInvalid,
    LOGIN_SAME: t.settings.loginSame,
    LOGIN_TAKEN: t.settings.loginTaken,
    PASSWORD_INVALID: t.settings.passwordInvalid,
    PASSWORD_MISMATCH: t.settings.passwordMismatch,
    PASSWORD_SAME: t.settings.passwordSame,
    UNKNOWN: t.settings.securityUnknownError,
  };

  if (state.error) {
    return <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">{errors[state.error]}</p>;
  }
  if (state.success) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        {state.success === "LOGIN" ? t.settings.loginChanged : t.settings.passwordChanged}
      </p>
    );
  }
  return null;
}

export function SecuritySettings({ currentLogin }: { currentLogin: string }) {
  const { t } = useT();
  const loginForm = useRef<HTMLFormElement>(null);
  const passwordForm = useRef<HTMLFormElement>(null);
  const [loginState, loginAction, loginPending] = useActionState(changeTeacherLoginAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeTeacherPasswordAction, initialState);

  useEffect(() => {
    if (loginState.success) loginForm.current?.reset();
  }, [loginState]);
  useEffect(() => {
    if (passwordState.success) passwordForm.current?.reset();
  }, [passwordState]);

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line shadow-sm">
      <div className="flex items-start gap-3 border-b border-line p-5 sm:p-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-content">{t.settings.security}</h2>
          <p className="mt-1 text-sm text-muted">{t.settings.securityHint}</p>
        </div>
      </div>

      <div className="grid gap-px bg-line lg:grid-cols-2">
        <form ref={loginForm} action={loginAction} className="flex flex-col gap-4 bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <UserRoundCog className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="font-semibold text-content">{t.settings.loginTitle}</h3>
              <p className="mt-0.5 text-sm text-muted">{t.settings.loginHint}</p>
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
            {t.settings.currentLogin}
            <Input value={currentLogin} readOnly autoComplete="username" className="font-mono" />
          </label>
          <label htmlFor="teacher-new-login" className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
            {t.settings.newLogin}
            <Input
              id="teacher-new-login"
              name="newLogin"
              autoComplete="username"
              minLength={3}
              maxLength={80}
              required
            />
          </label>
          <PasswordInput
            id="teacher-login-current-password"
            name="currentPassword"
            label={t.settings.currentPassword}
            autoComplete="current-password"
          />
          <div className="mt-auto flex flex-col gap-3 pt-1">
            <StatusMessage state={loginState} />
            <Button type="submit" disabled={loginPending} className="sm:self-start">
              {loginPending ? t.settings.saving : t.settings.saveLogin}
            </Button>
          </div>
        </form>

        <form ref={passwordForm} action={passwordAction} className="flex flex-col gap-4 bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="font-semibold text-content">{t.settings.passwordTitle}</h3>
              <p className="mt-0.5 text-sm text-muted">{t.settings.passwordHint}</p>
            </div>
          </div>
          <PasswordInput
            id="teacher-password-current"
            name="currentPassword"
            label={t.settings.currentPassword}
            autoComplete="current-password"
          />
          <PasswordInput
            id="teacher-password-new"
            name="newPassword"
            label={t.settings.newPassword}
            autoComplete="new-password"
            minLength={8}
          />
          <PasswordInput
            id="teacher-password-confirm"
            name="confirmPassword"
            label={t.settings.confirmPassword}
            autoComplete="new-password"
            minLength={8}
          />
          <div className="mt-auto flex flex-col gap-3 pt-1">
            <StatusMessage state={passwordState} />
            <Button type="submit" disabled={passwordPending} className="sm:self-start">
              {passwordPending ? t.settings.saving : t.settings.savePassword}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
