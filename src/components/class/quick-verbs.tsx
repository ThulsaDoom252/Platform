"use client";

/**
 * Табличка неправильных глаголов под рукой.
 *
 * Показывает полный справочник, поверх которого лежат списки учителя;
 * свои глаголы помечены точкой. Искать можно по любой из трёх форм и по
 * переводу — на уроке обычно вспоминают именно форму, а не начальный
 * вид глагола.
 */
import { useEffect, useMemo, useState } from "react";
import { quickVerbsAction, type QuickVerb } from "@/lib/actions/class";
import { IconSearch } from "@/components/icons";

export function QuickVerbs() {
  const [verbs, setVerbs] = useState<QuickVerb[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    quickVerbsAction()
      .then((list) => alive && setVerbs(list))
      .catch(() => alive && setVerbs([]));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return verbs ?? [];
    return (verbs ?? []).filter((v) =>
      [v.base, v.past, v.participle, v.translation ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [verbs, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <label className="relative flex shrink-0 items-center border-b border-line p-2">
        <IconSearch className="absolute left-4 h-3.5 w-3.5 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по любой форме…"
          className="h-8 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-2 text-[13px] text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {verbs === null && <p className="p-3 text-[13px] text-faint">Загружаю…</p>}

        {verbs !== null && shown.length === 0 && (
          <p className="p-3 text-[13px] text-faint">Ничего не нашлось.</p>
        )}

        {shown.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-[10px] font-bold uppercase tracking-wide text-faint">
                <th className="px-2.5 py-1.5 text-left">Base</th>
                <th className="px-2.5 py-1.5 text-left">Past</th>
                <th className="px-2.5 py-1.5 text-left">Participle</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v, i) => (
                <tr
                  key={`${v.base}-${i}`}
                  title={v.translation ?? undefined}
                  className="border-t border-line"
                >
                  <td className="px-2.5 py-1.5 font-semibold text-content">
                    {v.own && (
                      <span
                        title="Из твоих материалов"
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle"
                      />
                    )}
                    {v.base}
                  </td>
                  <td className="px-2.5 py-1.5 text-accent">{v.past}</td>
                  <td className="px-2.5 py-1.5 text-accent">{v.participle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {verbs !== null && verbs.length > 0 && (
        <p className="shrink-0 border-t border-line px-2.5 py-1.5 text-[11px] text-faint">
          {shown.length === verbs.length
            ? `${verbs.length} глаголов`
            : `${shown.length} из ${verbs.length}`}
        </p>
      )}
    </div>
  );
}
