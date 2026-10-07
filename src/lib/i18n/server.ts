import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getDictFor, DEFAULT_LOCALE, type Dict, type Locale } from "./index";

/** Язык текущего пользователя (из БД). Для гостей — английский. */
export const getLocale = cache(async (): Promise<Locale> => {
  const session = await getSession();
  if (!session) return DEFAULT_LOCALE;
  const [row] = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return (row?.locale as Locale) ?? DEFAULT_LOCALE;
});

/** Словарь текущего пользователя. */
export const getDict = cache(async (): Promise<{ t: Dict; locale: Locale }> => {
  const locale = await getLocale();
  return { t: getDictFor(locale), locale };
});
