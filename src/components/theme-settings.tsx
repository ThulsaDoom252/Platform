"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/i18n-provider";
import { IconMoon, IconSun, IconCheck } from "@/components/icons";

type Mode = "light" | "dark";
type Accent = "indigo" | "emerald" | "rose" | "violet";

const accents: { id: Accent; chips: string[] }[] = [
  { id: "indigo", chips: ["#6366f1", "#0ea5e9", "#8b5cf6", "#f59e0b"] },
  { id: "emerald", chips: ["#10b981", "#22c55e", "#06b6d4", "#f59e0b"] },
  { id: "rose", chips: ["#f43f5e", "#ec4899", "#f97316", "#8b5cf6"] },
  { id: "violet", chips: ["#8b5cf6", "#d946ef", "#6366f1", "#06b6d4"] },
];

/**
 * Тему держит не состояние компонента, а сам документ: inline-скрипт в
 * layout проставляет атрибуты ещё до гидратации, чтобы не мигала светлая
 * тема. Поэтому читаем прямо оттуда через useSyncExternalStore — так на
 * сервере отдаются значения по умолчанию, а в браузере настоящие, и
 * лишнего рендера после монтирования не происходит.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function readMode(): Mode {
  return document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light";
}

function readAccent(): Accent {
  const value = document.documentElement.getAttribute("data-accent");
  return accents.some((a) => a.id === value) ? (value as Accent) : "indigo";
}

export function ThemeSettings() {
  const { t } = useT();
  const mode = useSyncExternalStore(subscribe, readMode, () => "light" as Mode);
  const accent = useSyncExternalStore(subscribe, readAccent, () => "indigo" as Accent);

  const accentLabel: Record<Accent, string> = {
    indigo: t.settings.themeIndigo,
    emerald: t.settings.themeEmerald,
    rose: t.settings.themeRose,
    violet: t.settings.themeViolet,
  };

  function applyMode(next: Mode) {
    const r = document.documentElement;
    try {
      if (next === "dark") {
        r.setAttribute("data-mode", "dark");
        localStorage.setItem("lingora-mode", "dark");
      } else {
        r.removeAttribute("data-mode");
        localStorage.setItem("lingora-mode", "light");
      }
    } catch {
      /* хранилище недоступно — тема всё равно применится до перезагрузки */
    }
    notify();
  }

  function applyAccent(next: Accent) {
    const r = document.documentElement;
    try {
      r.setAttribute("data-accent", next);
      localStorage.setItem("lingora-accent", next);
    } catch {
      /* то же самое: атрибут проставлен, не сохранилась только настройка */
    }
    notify();
  }

  const dark = mode === "dark";

  return (
    <div className="flex flex-col gap-6">
      {/* Ночной режим — кликабельна вся строка */}
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        onClick={() => applyMode(dark ? "light" : "dark")}
        className="flex w-full items-center justify-between gap-4 rounded-2xl bg-surface p-5 text-left ring-1 ring-line shadow-sm transition hover:ring-accent sm:p-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            {dark ? <IconMoon className="h-5 w-5" /> : <IconSun className="h-5 w-5" />}
          </span>
          <span className="block">
            <span className="block font-semibold text-content">{t.settings.nightMode}</span>
            <span className="mt-0.5 block text-sm text-muted">
              {t.settings.nightModeHint}
            </span>
          </span>
        </span>
        <span
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${dark ? "bg-accent" : "bg-surface-2 ring-1 ring-line"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${dark ? "left-7" : "left-1"}`}
          />
        </span>
      </button>

      {/* Палитра */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line shadow-sm sm:p-6">
        <p className="font-semibold text-content">{t.settings.theme}</p>
        <p className="mt-1 text-sm text-muted">{t.settings.themeHint}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {accents.map((a) => {
            const active = accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => applyAccent(a.id)}
                className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                  active
                    ? "border-accent bg-accent-soft shadow-sm"
                    : "border-line hover:border-accent/40 hover:bg-surface-2"
                }`}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${a.chips[0]}, ${a.chips[2]})`,
                  }}
                >
                  {active && <IconCheck className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-content">
                    {accentLabel[a.id]}
                  </span>
                  <span className="mt-1.5 flex gap-1.5">
                    {a.chips.map((c) => (
                      <span
                        key={c}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
