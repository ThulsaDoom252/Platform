import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getDict } from "@/lib/i18n/server";
import {
  addWishlistNoteAction,
  requestContactChangeAction,
} from "@/lib/actions/student";
import { Avatar } from "@/components/avatar";
import { IconMessage } from "@/components/icons";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export default async function StudentMessagesPage() {
  const { t } = await getDict();

  const [teacher] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.studentDash.messageTeacher}</h1>
        <p className="mt-1 text-sm text-muted">{t.studentArea.wishesSubtitle}</p>
      </div>

      {teacher && (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
          <div className="flex items-center gap-3.5">
            <Avatar
              name={teacher.name}
              src={teacher.avatarUrl}
              className="h-14 w-14 text-lg"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-content">{teacher.name}</p>
              <p className="text-sm text-muted">{t.topbar.roleTeacher}</p>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
            {t.studentDash.messageHint}
          </p>
        </section>
      )}

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <IconMessage className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-content">{t.studentArea.wishesTitle}</h2>
        </div>
        <form action={addWishlistNoteAction} className="mt-4 flex flex-col gap-3">
          <textarea
            name="body"
            required
            rows={4}
            placeholder={t.studentArea.wishesPlaceholder}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
          />
          <button
            type="submit"
            className="h-11 w-fit rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t.studentArea.send}
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <h2 className="font-semibold text-content">{t.studentArea.contactsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.studentArea.contactsSubtitle}</p>
        <form
          action={requestContactChangeAction}
          className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto]"
        >
          <select name="field" className={inputCls}>
            <option value="phone">{t.studentArea.fieldPhone}</option>
            <option value="contactNote">{t.studentArea.fieldOther}</option>
          </select>
          <input
            name="newValue"
            required
            placeholder={t.studentArea.newValue}
            className={inputCls}
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t.studentArea.sendForApproval}
          </button>
        </form>
      </section>
    </div>
  );
}
