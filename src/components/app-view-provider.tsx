"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useUiChoice } from "./ui-preferences-provider";
import { APP_VIEWS, appViewPreference, type AppView } from "@/lib/app-view";
const Context = createContext<{ view: AppView; setView: (view: AppView) => void }>({
  view: "CLASSIC",
  setView: () => {},
});
export function AppViewProvider({ children, role = "TEACHER" }: { children: ReactNode; role?: "TEACHER" | "STUDENT" }) {
  const { setting, fallback } = appViewPreference(role);
  const [view, setView] = useUiChoice(setting, APP_VIEWS, fallback);
  return (
    <Context.Provider value={{ view, setView }}>
      <div className="application-view contents" data-app-view={view.toLowerCase()}>
        {children}
      </div>
    </Context.Provider>
  );
}
export function useAppView() {
  return useContext(Context);
}
