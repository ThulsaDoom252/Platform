"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { RealtimeConfigProvider } from "@/lib/use-realtime";

const I18nContext = createContext<{ t: Dict; locale: Locale } | null>(null);

/** Провайдер словаря для клиентских компонентов. Словарь приходит с сервера. */
export function I18nProvider({
  locale,
  dictionary,
  realtimeConfigured,
  children,
}: {
  locale: Locale;
  dictionary: Dict;
  realtimeConfigured: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ t: dictionary, locale }), [dictionary, locale]);
  return (
    <I18nContext.Provider value={value}>
      <RealtimeConfigProvider configured={realtimeConfigured}>{children}</RealtimeConfigProvider>
    </I18nContext.Provider>
  );
}

export function useT() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18nProvider is required");
  return context;
}
