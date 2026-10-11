"use client";

import { createContext, useContext, useEffect } from "react";
import { useLocalJson } from "@/lib/use-local-json";
import { uiPreferenceKey } from "@/lib/ui-preferences";

const UserContext = createContext("anonymous");
const LegacyOwnerContext = createContext<string | null>(null);

export function UiPreferencesProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [legacyOwner, setLegacyOwner] = useLocalJson<string | null>("lingora:ui:legacy-owner", null);
  // Old browser settings had no account id. Claim them once, not for every login.
  useEffect(() => {
    if (legacyOwner === null && userId !== "anonymous") setLegacyOwner(userId);
  }, [legacyOwner, userId, setLegacyOwner]);
  return <UserContext.Provider value={userId}>
    <LegacyOwnerContext.Provider value={legacyOwner}>{children}</LegacyOwnerContext.Provider>
  </UserContext.Provider>;
}

/** Presentation only, scoped to the signed-in account on this browser. */
export function useUiPreference<T>(setting: string, fallback: T, validate?: (value: unknown) => boolean, legacyKey?: string): [T, (value: T) => void] {
  const userId = useContext(UserContext);
  const legacyOwner = useContext(LegacyOwnerContext);
  const [legacy] = useLocalJson<T>(legacyKey ?? `${uiPreferenceKey(userId, setting)}:unused-legacy`, fallback);
  const defaultValue = legacyKey && legacyOwner === userId && (!validate || validate(legacy)) ? legacy : fallback;
  const [stored, set] = useLocalJson<T>(uiPreferenceKey(userId, setting), defaultValue);
  return [validate && !validate(stored) ? defaultValue : stored, set];
}

export function useUiChoice<T extends string>(setting: string, choices: readonly T[], fallback: T, legacyKey?: string) {
  return useUiPreference(setting, fallback, (value) => choices.includes(value as T), legacyKey);
}
