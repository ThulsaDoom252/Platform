"use client";

import { createContext, useContext } from "react";
import { dictionaries, DEFAULT_LOCALE, type Dict, type Locale } from "@/lib/i18n";

const I18nContext = createContext<{ t: Dict; locale: Locale }>({
  t: dictionaries[DEFAULT_LOCALE],
  locale: DEFAULT_LOCALE,
});

/** Провайдер словаря для клиентских компонентов. Словарь приходит с сервера. */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = { t: dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE], locale };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
