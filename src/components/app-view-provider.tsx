"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useUiChoice } from "./ui-preferences-provider";
import { APP_VIEWS, type AppView } from "@/lib/app-view";
const Context = createContext<{ view: AppView; setView: (view: AppView) => void }>({
  view: "CLASSIC",
  setView: () => {},
});
export function AppViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useUiChoice("application:view", APP_VIEWS, "CLASSIC");
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
