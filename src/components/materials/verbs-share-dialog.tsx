"use client";

/**
 * Передача неправильных глаголов на другую страницу.
 *
 * Отмечать можно как угодно: целую категорию, отдельные глаголы внутри
 * неё, глаголы без категории — и всё это вперемешку. По умолчанию не
 * отмечено ничего: передача копирует данные ученику, и делать это
 * молчаливо нельзя.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  listVerbsPagesAction,
  shareVerbsAction,
  type VerbsPlace,
} from "@/lib/actions/materials";
import type { MaterialVerb } from "@/lib/materials";
import { IconX, IconSearch } from "@/components/icons";
import { cn } from "@/lib/utils";

const NO_CATEGORY = "Без категории";

export type ShareVerbsTarget = { id: string; name: string; verbs: MaterialVerb[] };

export function VerbsShareDialog({
  target,
  onClose,
  onDone,
}: {
  target: ShareVerbsTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [places, setPlaces] = useState<VerbsPlace[] | null>(null);
  const [placeKey, setPlaceKey] = useState("");
  const [pageId, setPageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!target) return;
    let alive = true;
    listVerbsPagesAction()
      .then((list) => {
        if (!alive) return;
        setPlaces(list);
        setPlaceKey((prev) => prev || list[0]?.key || "");
      })
      .catch(() => alive && setError("Не удалось загрузить список страниц"));
    return () => {
      alive = false;
    };
  }, [target]);

  const groups = useMemo(() => {
    const byName = new Map<string, MaterialVerb[]>();
    for (const v of target?.verbs ?? []) {
      const name = v.category?.trim() || NO_CATEGORY;
      byName.set(name, [...(byName.get(name) ?? []), v]);
    }
    return [...byName.entries()].map(([name, verbs]) => ({ name, verbs }));
  }, [target]);

  if (!target) return null;

  const place = places?.find((p) => p.key === placeKey) ?? null;
  const needle = query.trim().toLowerCase();
  const pages = (place?.pages ?? []).filter(
    (p) => !needle || `${p.name} ${p.path}`.toLowerCase().includes(needle),
  );

  const toggle = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  function share() {
    if (!pageId) return;
    setError(null);
    startBusy(async () => {
      const res = await shareVerbsAction(pageId, [...picked]);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Передано");
      onClose();
    });
  }

  const allIds = target.verbs.map((v) => v.id);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">Поделиться глаголами</h2>
            <p className="mt-1 text-sm text-muted">
              Отметь категории целиком или отдельные глаголы. Копия
              самостоятельная — правки у себя до неё не дойдут.
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">
            Отмечено: {picked.size} из {allIds.length}
          </span>
          <button
            type="button"
            onClick={() => toggle(allIds, true)}
            className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold text-muted transition hover:text-content"
          >
            Выделить все
          </button>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold text-muted transition hover:text-content"
          >
            Снять все
          </button>
        </div>

        <div className="mt-3 max-h-[34vh] overflow-y-auto rounded-xl bg-surface-2 p-2">
          {groups.map((g) => {
            const ids = g.verbs.map((v) => v.id);
            const on = ids.filter((id) => picked.has(id)).length;
            const whole = on === ids.length;

            return (
              <div key={g.name} className="mb-2 last:mb-0">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={whole}
                    ref={(el) => {
                      // Часть группы отмечена — показываем это третьим состоянием.
                      if (el) el.indeterminate = on > 0 && !whole;
                    }}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-sm font-bold text-content">{g.name}</span>
                  <span className="text-[11px] text-faint">
                    {on > 0 ? `${on} из ${ids.length}` : ids.length}
                  </span>
                </label>

                <div className="ml-6 flex flex-col">
                  {g.verbs.map((v) => (
                    <label
                      key={v.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-surface"
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(v.id)}
                        onChange={(e) => toggle([v.id], e.target.checked)}
                        className="h-3.5 w-3.5 accent-[var(--accent)]"
                      />
                      <span className="w-5 shrink-0 text-center text-[13px]">{v.icon ?? ""}</span>
                      <span className="text-[13px] text-content">
                        {v.base} — {v.past} — {v.participle}
                      </span>
                      <span className="truncate text-[11px] text-faint">{v.translation ?? ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] font-semibold text-muted">Куда передать</p>

        {!places && !error && <p className="mt-2 text-sm text-faint">Загружаю…</p>}

        {places && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {places.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPlaceKey(p.key);
                    setPageId(null);
                  }}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[12px] font-semibold transition",
                    p.key === placeKey
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-muted hover:text-content",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="relative mt-2 flex items-center">
              <IconSearch className="absolute left-3 h-4 w-4 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск страницы…"
                className="h-9 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
              />
            </label>

            <div className="mt-2 max-h-[22vh] overflow-y-auto rounded-xl bg-surface-2 p-1.5">
              {pages.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-faint">
                  Здесь нет подходящих страниц. Годятся списки глаголов и пустые файлы.
                </p>
              )}
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPageId(p.id)}
                  disabled={p.id === target.id}
                  className={cn(
                    "flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition",
                    p.id === target.id && "opacity-40",
                    pageId === p.id ? "bg-accent text-white" : "hover:bg-surface",
                  )}
                >
                  <span className="text-sm font-semibold">
                    {p.name}
                    {p.verbs > 0 && (
                      <span
                        className={cn(
                          "ml-1.5 text-[11px]",
                          pageId === p.id ? "text-white/70" : "text-faint",
                        )}
                      >
                        уже {p.verbs}
                      </span>
                    )}
                  </span>
                  {p.path && (
                    <span
                      className={cn(
                        "text-[11px]",
                        pageId === p.id ? "text-white/70" : "text-faint",
                      )}
                    >
                      {p.path}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={share}
            disabled={busy || picked.size === 0 || !pageId}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Передаю…" : `Поделиться (${picked.size})`}
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
