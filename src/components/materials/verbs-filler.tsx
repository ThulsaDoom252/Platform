"use client";

/**
 * Правка страницы неправильных глаголов.
 *
 * Окно одно на всё: в каждой группе видны уже заведённые глаголы — их
 * можно поправить или удалить, — и рядом место, куда вставить новые.
 * Имена групп по умолчанию порядковые (1st, 2nd, 3rd), переименование
 * переносит глаголы вместе с именем.
 *
 * Разбор вставки идёт прямо здесь, а наружу уходит готовый список: так
 * правки и добавления сохраняются одним действием и не спорят друг с
 * другом.
 */
import { useMemo, useState, useTransition } from "react";
import {
  saveVerbsAction,
  suggestVerbIconsAction,
  type VerbEdit,
} from "@/lib/actions/materials";
import { parseIrregularVerbs } from "@/lib/verbs-parser";
import type { MaterialVerb } from "@/lib/materials";
import { IconX, IconPlus, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";
import { IconPicker } from "./icon-picker";

export type VerbsTarget = {
  id: string;
  name: string;
  verbs: MaterialVerb[];
  /** С какой группы открыть окно — по щелчку на иконке у её заголовка. */
  focus?: string | null;
};

/** Имя группы по умолчанию: 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

type Row = VerbEdit & { key: string };
type Group = { key: string; name: string; rows: Row[]; text: string };

const NO_NAME = "";

const cell =
  "h-8 rounded-lg border border-line bg-surface px-2 text-[12px] text-content outline-none transition focus:border-accent";

const PLACEHOLDER = "🔊 buy /baɪ/    bought /bɔːt/    bought /bɔːt/    купувати";

/** Раскладывает уже заведённые глаголы по группам. */
function toGroups(verbs: MaterialVerb[]): Group[] {
  const byName = new Map<string, Row[]>();
  for (const v of verbs) {
    const name = v.category?.trim() || NO_NAME;
    byName.set(name, [
      ...(byName.get(name) ?? []),
      {
        key: v.id,
        id: v.id,
        category: name || null,
        icon: v.icon,
        base: v.base,
        baseIpa: v.baseIpa,
        past: v.past,
        pastIpa: v.pastIpa,
        participle: v.participle,
        participleIpa: v.participleIpa,
        translation: v.translation,
      },
    ]);
  }

  // Порядок групп — как на странице: его задают перетаскиванием.
  const groups: Group[] = [...byName.keys()].map((name, i) => ({
    key: name === NO_NAME ? "plain" : `g${i}`,
    name,
    rows: byName.get(name)!,
    text: "",
  }));

  // Без категории — всегда отдельная группа, даже пустая.
  if (!byName.has(NO_NAME)) {
    groups.unshift({ key: "plain", name: NO_NAME, rows: [], text: "" });
  }

  if (groups.length === 1) {
    groups.push({ key: "g0", name: ordinal(1), rows: [], text: "" });
  }
  return groups;
}

export function VerbsFiller({
  target,
  onClose,
  onDone,
}: {
  target: VerbsTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [groups, setGroups] = useState<Group[]>(() => toGroups(target?.verbs ?? []));
  /*
   * Открываемся на той вкладке, чью иконку нажали. null — это «без
   * категории»; undefined значит, что окно открыли кнопкой файла.
   */
  const [mode, setMode] = useState<"categories" | "plain">(
    target?.focus === null ? "plain" : "categories",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  /** Строка, у которой открыт выбор иконки. */
  const [picking, setPicking] = useState<{ group: string; row: string } | null>(null);
  /** Группа, для которой сейчас подбираются иконки. */
  const [suggesting, setSuggesting] = useState<string | null>(null);

  const shown = useMemo(
    () => groups.filter((g) => (mode === "plain" ? g.key === "plain" : g.key !== "plain")),
    [groups, mode],
  );

  if (!target) return null;

  const pickingRow = picking
    ? groups.find((g) => g.key === picking.group)?.rows.find((r) => r.key === picking.row) ?? null
    : null;

  const patchGroup = (key: string, part: Partial<Group>) =>
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...part } : g)));

  const patchRow = (groupKey: string, rowKey: string, part: Partial<Row>) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, rows: g.rows.map((r) => (r.key === rowKey ? { ...r, ...part } : r)) }
          : g,
      ),
    );

  /** Подобрать иконки строкам группы, у которых их нет. */
  async function suggestIcons(g: Group) {
    const empty = g.rows.filter((r) => !r.icon?.trim() && r.base.trim());
    if (empty.length === 0) return;
    setError(null);
    setSuggesting(g.key);
    try {
      const icons = await suggestVerbIconsAction(
        empty.map((r) => ({
          id: r.key,
          base: r.base,
          past: r.past,
          participle: r.participle,
          translation: r.translation,
        })),
      );
      const found = Object.keys(icons).length;
      setGroups((prev) =>
        prev.map((x) =>
          x.key === g.key
            ? {
                ...x,
                rows: x.rows.map((r) => (!r.icon?.trim() && icons[r.key] ? { ...r, icon: icons[r.key] } : r)),
              }
            : x,
        ),
      );
      if (found < empty.length) {
        setError(`Не нашлось иконок: ${empty.length - found}. Их можно выбрать вручную.`);
      }
    } catch {
      setError("Не удалось подобрать иконки");
    } finally {
      setSuggesting(null);
    }
  }

  const found = (text: string) => (text.trim() ? parseIrregularVerbs(text).verbs.length : 0);

  const totalNew = groups.reduce((sum, g) => sum + found(g.text), 0);
  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  function save() {
    setError(null);

    // Собираем итоговый список: правленые строки плюс разобранная вставка.
    const all: VerbEdit[] = [];
    for (const g of groups) {
      const name = g.name.trim() || null;
      for (const r of g.rows) {
        if (!r.base.trim()) continue;
        all.push({ ...r, category: name });
      }
      if (!g.text.trim()) continue;
      for (const v of parseIrregularVerbs(g.text).verbs) {
        all.push({
          id: "",
          category: name,
          icon: v.icon,
          base: v.base,
          baseIpa: v.baseIpa,
          past: v.past,
          pastIpa: v.pastIpa,
          participle: v.participle,
          participleIpa: v.participleIpa,
          translation: v.translation,
        });
      }
    }

    if (all.length === 0) {
      setError("Список пуст — так все глаголы со страницы исчезнут. Лучше нажми «Очистить».");
      return;
    }

    startBusy(async () => {
      const res = await saveVerbsAction(target!.id, all);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Сохранено");
      onClose();
    });
  }

  const tab = (value: "categories" | "plain", label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "h-9 rounded-xl px-3.5 text-sm font-semibold transition",
        mode === value ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content",
      )}
    >
      {label}
    </button>
  );

  /** Одна заведённая запись: правится и удаляется на месте. */
  const row = (g: Group, r: Row) => (
    <div key={r.key} className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => setPicking({ group: g.key, row: r.key })}
        title={r.icon ? `Иконка ${r.icon} — нажми, чтобы сменить` : "Выбрать иконку"}
        className={cn(
          cell,
          "flex w-9 shrink-0 items-center justify-center px-0 text-base hover:border-accent",
          !r.icon && "text-faint",
        )}
      >
        {r.icon || "＋"}
      </button>
      <input
        value={r.base}
        onChange={(e) => patchRow(g.key, r.key, { base: e.target.value })}
        className={cn(cell, "w-24 shrink-0 font-semibold")}
      />
      <input
        value={r.baseIpa ?? ""}
        onChange={(e) => patchRow(g.key, r.key, { baseIpa: e.target.value || null })}
        placeholder="/…/"
        className={cn(cell, "w-20 shrink-0 text-faint")}
      />
      <input
        value={r.past}
        onChange={(e) => patchRow(g.key, r.key, { past: e.target.value })}
        className={cn(cell, "w-24 shrink-0")}
      />
      <input
        value={r.pastIpa ?? ""}
        onChange={(e) => patchRow(g.key, r.key, { pastIpa: e.target.value || null })}
        placeholder="/…/"
        className={cn(cell, "w-20 shrink-0 text-faint")}
      />
      <input
        value={r.participle}
        onChange={(e) => patchRow(g.key, r.key, { participle: e.target.value })}
        className={cn(cell, "w-24 shrink-0")}
      />
      <input
        value={r.participleIpa ?? ""}
        onChange={(e) => patchRow(g.key, r.key, { participleIpa: e.target.value || null })}
        placeholder="/…/"
        className={cn(cell, "w-20 shrink-0 text-faint")}
      />
      <input
        value={r.translation ?? ""}
        onChange={(e) => patchRow(g.key, r.key, { translation: e.target.value || null })}
        placeholder="перевод"
        className={cn(cell, "min-w-[7rem] flex-1")}
      />
      <button
        type="button"
        onClick={() =>
          patchGroup(g.key, { rows: g.rows.filter((x) => x.key !== r.key) })
        }
        title="Убрать глагол"
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
      >
        <IconTrash className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-4xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">
              Неправильные глаголы: «{target.name}»
            </h2>
            <p className="mt-1 text-sm text-muted">
              Заведённые глаголы правятся прямо здесь. Внизу каждой группы —
              место, куда вставить новые.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {tab("categories", "Категории")}
          {tab("plain", "Без категории")}
        </div>

        <div className="mt-4 flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
          {shown.map((g, i) => {
            const fresh = found(g.text);
            return (
              <div
                key={g.key}
                id={`group-${g.key}`}
                className={cn(
                  "rounded-xl bg-surface-2 p-3",
                  target.focus !== undefined &&
                    (target.focus ?? NO_NAME) === g.name &&
                    "ring-2 ring-accent",
                )}
              >
                <div className="flex items-center gap-2">
                  {g.key === "plain" ? (
                    <span className="flex h-9 flex-1 items-center text-sm font-semibold text-muted">
                      Без категории
                    </span>
                  ) : (
                    <input
                      value={g.name}
                      onChange={(e) => patchGroup(g.key, { name: e.target.value })}
                      placeholder={ordinal(i + 1)}
                      title="Название группы — его видно над списком"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold text-content outline-none transition focus:border-accent"
                    />
                  )}

                  {g.rows.some((r) => !r.icon?.trim()) && (
                    <button
                      type="button"
                      onClick={() => suggestIcons(g)}
                      disabled={suggesting !== null}
                      title="Подобрать иконки глаголам группы, у которых их нет"
                      className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-semibold text-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      <span aria-hidden>✨</span>
                      {suggesting === g.key ? "Подбираю…" : "Иконки"}
                    </button>
                  )}

                  <span className="shrink-0 text-[11px] text-faint">
                    {g.rows.length}
                    {fresh > 0 ? ` + ${fresh}` : ""}
                  </span>

                  {g.key !== "plain" && shown.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setGroups((prev) => prev.filter((x) => x.key !== g.key))}
                      title="Убрать группу вместе с её глаголами"
                      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-rose-500"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {g.rows.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">{g.rows.map((r) => row(g, r))}</div>
                )}

                <textarea
                  value={g.text}
                  onChange={(e) => patchGroup(g.key, { text: e.target.value })}
                  rows={g.rows.length > 0 ? 3 : 5}
                  placeholder={PLACEHOLDER}
                  className="mt-2 w-full resize-y rounded-xl border border-line bg-surface p-2.5 text-[13px] text-content outline-none transition placeholder:text-faint focus:border-accent"
                />
              </div>
            );
          })}

          {mode === "categories" && (
            <button
              type="button"
              onClick={() =>
                setGroups((prev) => [
                  ...prev,
                  {
                    key: `g${Date.now()}`,
                    name: ordinal(prev.filter((x) => x.key !== "plain").length + 1),
                    rows: [],
                    text: "",
                  },
                ])
              }
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            >
              <IconPlus className="h-4 w-4" /> Категория
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        {pickingRow && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setPicking(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-line"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-2xl">
                  {pickingRow.icon || <span className="text-sm text-faint">нет</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-content">
                    {pickingRow.base} → {pickingRow.past} → {pickingRow.participle}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {pickingRow.translation || "Текущая иконка слева"}
                  </p>
                </div>
                {pickingRow.icon && (
                  <button
                    type="button"
                    onClick={() => {
                      patchRow(picking!.group, picking!.row, { icon: null });
                      setPicking(null);
                    }}
                    className="h-8 shrink-0 rounded-lg px-2.5 text-[12px] text-faint transition hover:text-rose-500"
                  >
                    Убрать
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPicking(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:text-content"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <IconPicker
                value={pickingRow.icon}
                onChange={(icon) => {
                  patchRow(picking!.group, picking!.row, { icon });
                  setPicking(null);
                }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Сохраняю…" : `Сохранить (${totalRows + totalNew})`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-faint transition hover:text-content"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
