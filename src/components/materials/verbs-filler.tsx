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
import { saveVerbsAction, type VerbEdit } from "@/lib/actions/materials";
import { parseIrregularVerbs } from "@/lib/verbs-parser";
import type { MaterialVerb } from "@/lib/materials";
import { IconX, IconPlus, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

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

  const named = [...byName.keys()].filter((n) => n !== NO_NAME).sort();
  const groups: Group[] = named.map((name, i) => ({
    key: `g${i}`,
    name,
    rows: byName.get(name)!,
    text: "",
  }));

  // Без категории — всегда отдельная группа, даже пустая.
  groups.unshift({
    key: "plain",
    name: NO_NAME,
    rows: byName.get(NO_NAME) ?? [],
    text: "",
  });

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

  const shown = useMemo(
    () => groups.filter((g) => (mode === "plain" ? g.key === "plain" : g.key !== "plain")),
    [groups, mode],
  );

  if (!target) return null;

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
      <input
        value={r.icon ?? ""}
        onChange={(e) => patchRow(g.key, r.key, { icon: [...e.target.value][0] ?? null })}
        placeholder="—"
        title="Значок"
        className={cn(cell, "w-9 shrink-0 text-center")}
      />
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
