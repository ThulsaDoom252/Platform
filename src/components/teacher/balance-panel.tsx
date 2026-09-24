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

/** Быстрое пополнение баланса. */
const TOP_UPS = [1, 12, 20, 30, 60];

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

const label = "text-[12px] font-semibold text-muted";

/**
 * Дата в формате поля ввода.
 *
 * Строку отдаём как есть: пока набираешь год, поле само присылает
 * промежуточные вроде «0002-03-17», и любая переделка их через Date
 * ломает набор — браузер сбрасывает и день с месяцем.
 */
function toInput(d: Date | string | null): string {
  if (!d) return "";

  // Из самого поля приходит уже готовое «гггг-мм-дд» — отдаём как есть.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
  const [remainingInput, setRemainingInput] = useState(String(initial.remaining));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof BalanceSettings>(key: K, value: BalanceSettings[K]) => {
    setSaved(false);
    setForm((p) => ({ ...p, [key]: value }));
  };

  function save() {
    setError(null);
    const remaining = Number(remainingInput);
    if (remainingInput.trim() === "") {
      setSaved(false);
      setError("Укажите количество оставшихся уроков");
      return;
    }
    if (!Number.isInteger(remaining) || remaining < 0 || remaining > 100_000) {
      setSaved(false);
      setError("Остаток уроков должен быть целым числом от 0 до 100000");
      return;
    }

    startSave(async () => {
      const res = await saveBalanceSettingsAction(studentId, { ...form, remaining });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  const total = stats.onPlatform + (Number(form.lessonsBefore) || 0);
  const approx = form.statsApproximate ? "≈ " : "";

  const flag = (
    key:
      | "showBalance"
      | "showPackageSize"
      | "showTotalLessons"
      | "showExpiry"
      | "allowExport",
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

      {/* Короткая сводка — то, на что смотришь чаще всего. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
          Последний пакет:{" "}
          <span className="font-bold text-content">
            {remainingInput.trim() || "—"} из {form.packageTotal || "—"}
          </span>
        </span>
        <span className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
          Пройдено за всё время:{" "}
          <span className="font-bold text-content">
            {approx}
            {total}
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className={label}>Осталось уроков</p>
          <input
            type="number"
            min={0}
            max={100_000}
            step={1}
            value={remainingInput}
            onChange={(e) => {
              setSaved(false);
              setError(null);
              setRemainingInput(e.target.value);
            }}
            className={cn(inputCls, "mt-1.5")}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TOP_UPS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  const next = (Number(remainingInput) || 0) + n;
                  setRemainingInput(String(next));
                  set("remaining", next);
                }}
                className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold text-muted transition hover:bg-accent-soft hover:text-accent"
              >
                +{n}
              </button>
            ))}
          </div>
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
            <p className={label}>Всего уроков за весь период</p>
            <input
              type="number"
              min={0}
              value={total}
              onChange={(e) =>
                // Храним поправку к посчитанным, а правим видимую сумму.
                set("lessonsBefore", (Number(e.target.value) || 0) - stats.onPlatform)
              }
              className={cn(inputCls, "mt-1.5 w-32")}
            />
          </div>
          <p className="pb-2.5 text-[13px] text-muted">
            {approx}
            <span className="font-bold text-content">{total}</span>{" "}
            <span className="text-faint">
              ({stats.onPlatform} посчитано на платформе
              {form.lessonsBefore ? `, ${form.lessonsBefore > 0 ? "+" : "−"}${Math.abs(form.lessonsBefore)} вручную` : ""})
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

      <p className="mt-4 text-[12px] font-semibold text-muted">Что {studentName} может</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {flag("allowExport", "Выгружать материалы в текст и .docx")}
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
