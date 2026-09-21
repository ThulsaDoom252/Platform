"use client";

import { useActionState, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { Avatar } from "@/components/avatar";
import { updateProfileAction, type ProfileState } from "@/lib/actions/profile";
import { IconCheck, IconTrash } from "@/components/icons";

export type ProfileUser = {
  name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  contactNote: string | null;
  avatarUrl: string | null;
  role: "TEACHER" | "STUDENT";
};

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export function ProfilePanel({ user }: { user: ProfileUser }) {
  const { t } = useT();
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    {},
  );
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* Фото */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <p className="font-semibold text-content">{t.profile.photo}</p>
        <p className="mt-1 text-sm text-muted">{t.profile.photoHint}</p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar
            name={user.name}
            src={preview ?? user.avatarUrl}
            className="h-20 w-20 text-2xl"
          />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              name="photo"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
            />
            {user.avatarUrl && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="removePhoto" className="h-4 w-4 accent-[var(--accent)]" />
                <IconTrash className="h-3.5 w-3.5" />
                {t.profile.remove}
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Контакты */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <p className="font-semibold text-content">{t.profile.contacts}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-content">{t.profile.name}</span>
            <input
              name="name"
              defaultValue={user.name}
              disabled={user.role === "STUDENT"}
              className={`${inputCls} mt-1.5 disabled:opacity-60`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-content">{t.profile.email}</span>
            <input
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
              placeholder="name@mail.com"
              className={`${inputCls} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-content">{t.profile.phone}</span>
            <input
              name="phone"
              defaultValue={user.phone ?? ""}
              placeholder="+7 900 000-00-00"
              className={`${inputCls} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-content">{t.profile.telegram}</span>
            <input
              name="telegram"
              defaultValue={user.telegram ?? ""}
              placeholder="@username"
              className={`${inputCls} mt-1.5`}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-content">
              {t.profile.contactNote}
            </span>
            <input
              name="contactNote"
              defaultValue={user.contactNote ?? ""}
              className={`${inputCls} mt-1.5`}
            />
          </label>
        </div>

        {user.role === "STUDENT" && (
          <p className="mt-3 text-[11px] text-faint">{t.profile.studentNote}</p>
        )}

        {state.error && <p className="mt-3 text-sm text-rose-500">{state.error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? t.common.loading : t.profile.saveChanges}
          </button>
          {state.ok && (
            <span className="tint-green flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
              <IconCheck className="h-3.5 w-3.5" />
              {t.common.saved}
            </span>
          )}
        </div>
      </section>
    </form>
  );
}
