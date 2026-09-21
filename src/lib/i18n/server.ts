import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDictFor, DEFAULT_LOCALE, type Dict, type Locale } from "./index";

/** Язык текущего пользователя (из БД). Для гостей — английский. */
export async function getLocale(): Promise<Locale> {
  const session = await getSession();
  if (!session) return DEFAULT_LOCALE;
  const [row] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return (row?.locale as Locale) ?? DEFAULT_LOCALE;
}

/** Словарь текущего пользователя. */
export async function getDict(): Promise<{ t: Dict; locale: Locale }> {
  const locale = await getLocale();
  return { t: getDictFor(locale), locale };
}
