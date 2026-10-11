"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { RealtimeConfigProvider } from "@/lib/use-realtime";
import { UiPreferencesProvider } from "@/components/ui-preferences-provider";

const I18nContext = createContext<{ t: Dict; locale: Locale } | null>(null);

/** Провайдер словаря для клиентских компонентов. Словарь приходит с сервера. */
export function I18nProvider({
  locale,
  dictionary,
  realtimeConfigured,
  userId = "anonymous",
  children,
}: {
  locale: Locale;
  dictionary: Dict;
  realtimeConfigured: boolean;
  userId?: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ t: dictionary, locale }), [dictionary, locale]);
  return (
    <I18nContext.Provider value={value}>
      <UiPreferencesProvider userId={userId}>
        <RealtimeConfigProvider configured={realtimeConfigured}>{children}</RealtimeConfigProvider>
      </UiPreferencesProvider>
    </I18nContext.Provider>
  );
}

export function useT() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18nProvider is required");
  return context;
}
