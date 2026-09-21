import { getDict } from "@/lib/i18n/server";
import { locales } from "@/lib/i18n";
import { updateLocaleAction } from "@/lib/actions/profile";
import { ThemeSettings } from "@/components/theme-settings";
import { IconCheck } from "@/components/icons";

/** Оформление + язык. Общая панель для учителя и ученика. */
export async function SettingsPanel() {
  const { t, locale } = await getDict();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-content">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.settings.subtitle}</p>
      </div>

      <ThemeSettings />

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <p className="font-semibold text-content">{t.settings.language}</p>
        <p className="mt-1 text-sm text-muted">{t.settings.languageHint}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {locales.map((l) => {
            const active = l.id === locale;
            return (
              <form key={l.id} action={updateLocaleAction}>
                <input type="hidden" name="locale" value={l.id} />
                <button
                  type="submit"
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      active ? "bg-accent text-white" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {l.code}
                  </span>
                  <span className="flex-1 text-sm font-medium text-content">
                    {l.label}
                  </span>
                  {active && <IconCheck className="h-4 w-4 text-accent" />}
                </button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
