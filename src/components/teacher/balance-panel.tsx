"use client";

import { useState, useTransition } from "react";
import {
  saveBalanceSettingsAction,
  type BalanceSettings,
} from "@/lib/actions/teacher";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Привычные размеры пакетов — чтобы не набирать руками каждый раз. */
const PRESETS = [12, 20, 30, 60];

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

const label = "text-[12px] font-semibold text-muted";

/** Дата в формате поля ввода. */
function toInput(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type BalanceStats = {
  onPlatform: number;
  firstLessonAt: Date | string | null;
};

export function BalancePanel({
  studentId,
  studentName,
  sharedWith,
  stats,
  initial,
}: {
  studentId: string;
  studentName: string;
  /** Имена тех, с кем делится пакет — остаток у них общий. */
  sharedWith: string[];
  stats: BalanceStats;
  initial: BalanceSettings;
}) {
  const [form, setForm] = useState<BalanceSettings>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof BalanceSettings>(key: K, value: BalanceSettings[K]) => {
    setSaved(false);
    setForm((p) => ({ ...p, [key]: value }));
  };

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveBalanceSettingsAction(studentId, form);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const total = stats.onPlatform + (Number(form.lessonsBefore) || 0);
  const approx = form.statsApproximate ? "≈ " : "";

  const flag = (
    key: "showBalance" | "showPackageSize" | "showTotalLessons" | "showExpiry",
    text: string,
  ) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => set(key, e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="text-[12px] text-content">{text}</span>
    </label>
  );

  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
      <h2 className="text-sm font-bold text-content">Баланс и статистика</h2>

      {sharedWith.length > 0 && (
        <p className="mt-1 text-[12px] text-muted">
          Пакет общий с {sharedWith.join(", ")} — остаток списывается из одного пула,
          поэтому меняется сразу у всех.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className={label}>Осталось уроков</p>
          <input
            type="number"
            min={0}
            value={form.remaining}
            onChange={(e) => set("remaining", Number(e.target.value))}
            className={cn(inputCls, "mt-1.5")}
          />
        </div>

        <div>
          <p className={label}>Пакет — сколько куплено</p>
          <input
            type="number"
            min={0}
            value={form.packageTotal}
            onChange={(e) => set("packageTotal", Number(e.target.value))}
            className={cn(inputCls, "mt-1.5")}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set("packageTotal", n)}
                className={cn(
                  "h-7 rounded-lg px-2.5 text-[12px] font-semibold transition",
                  form.packageTotal === n
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:text-content",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label}>Пакет действует до</p>
          <input
            type="date"
            value={toInput(form.expiresAt)}
            onChange={(e) => set("expiresAt", e.target.value || null)}
            className={cn(inputCls, "mt-1.5")}
          />
        </div>

        <div>
          <p className={label}>Занимаемся с</p>
          <input
            type="date"
            value={toInput(form.startedAt)}
            onChange={(e) => set("startedAt", e.target.value || null)}
            className={cn(inputCls, "mt-1.5")}
          />
          <p className="mt-1 text-[11px] text-faint">
            {stats.firstLessonAt
              ? `Первый урок на платформе — ${toInput(stats.firstLessonAt)}. Пусто — берётся он.`
              : "Проведённых уроков пока нет."}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className={label}>Уроков до платформы</p>
            <input
              type="number"
              min={0}
              value={form.lessonsBefore}
              onChange={(e) => set("lessonsBefore", Number(e.target.value))}
              className={cn(inputCls, "mt-1.5 w-28")}
            />
          </div>
          <p className="pb-2.5 text-[13px] text-muted">
            Всего за весь период:{" "}
            <span className="font-bold text-content">
              {approx}
              {total}
            </span>{" "}
            <span className="text-faint">
              ({stats.onPlatform} на платформе + {Number(form.lessonsBefore) || 0} до неё)
            </span>
          </p>
        </div>

        <label className="mt-2.5 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.statsApproximate}
            onChange={(e) => set("statsApproximate", e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-[12px] text-content">
            Показывать как приблизительные — со знаком ≈
          </span>
        </label>
      </div>

      <p className="mt-4 text-[12px] font-semibold text-muted">
        Что из этого видит {studentName}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {flag("showBalance", "Сколько уроков осталось")}
        {flag("showPackageSize", "Размер последнего пакета")}
        {flag("showTotalLessons", "Всего уроков за весь период")}
        {flag("showExpiry", "До какого числа действует пакет")}
      </div>

      {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--lesson-green)]">
            <IconCheck className="h-4 w-4" /> Сохранено
          </span>
        )}
      </div>
    </section>
  );
}
