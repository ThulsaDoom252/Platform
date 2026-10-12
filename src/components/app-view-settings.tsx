"use client";
import { useT } from "./i18n-provider";
import { useAppView } from "./app-view-provider";
import { APP_VIEWS } from "@/lib/app-view";
import { IconCheck } from "./icons";
export function AppViewSettings() {
  const { t } = useT();
  const { view, setView } = useAppView();
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
      <h2 className="font-semibold text-content">{t.settings.layoutView}</h2>
      <p className="mt-1 text-sm text-muted">{t.settings.layoutViewHint}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label={t.settings.layoutView}>
        {APP_VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={`flex min-h-24 items-center gap-3 rounded-xl border p-4 text-left transition ${view === item ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-content">{item === "CLASSIC" ? "Classic" : "Updated"}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {item === "CLASSIC" ? t.settings.classicViewHint : t.settings.updatedViewHint}
              </span>
            </span>
            {view === item && <IconCheck aria-hidden className="h-5 w-5 shrink-0 text-accent" />}
          </button>
        ))}
      </div>
    </section>
  );
}
