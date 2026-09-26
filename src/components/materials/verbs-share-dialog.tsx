"use client";

/**
 * Передача неправильных глаголов получателю.
 *
 * Страницу выбирать не нужно: у получателя раздел глаголов один, и если
 * его ещё нет — он заведётся сам в конце дерева. Зато то, что у человека
 * уже лежит, повторно не отдаём: такие категории и глаголы помечены и
 * отмечаться не дают.
 *
 * По умолчанию не отмечено ничего: передача копирует данные ученику, и
 * делать это молчаливо нельзя.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  listVerbsRecipientsAction,
  shareVerbsToRecipientAction,
  type VerbsRecipient,
} from "@/lib/actions/materials";
import type { MaterialVerb } from "@/lib/materials";
import { IconX, IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

const NO_CATEGORY = "Без категории";

export type ShareVerbsTarget = { id: string; name: string; verbs: MaterialVerb[] };

/** Имя категории для сравнения — так же, как это делает сервер. */
const categoryKey = (name: string | null) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const formsKey = (v: { base: string; past: string; participle: string }) =>
  [v.base, v.past, v.participle].map((x) => x.trim().toLowerCase()).join("|");

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
  const [people, setPeople] = useState<VerbsRecipient[] | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    if (!target) return;
    let alive = true;
    listVerbsRecipientsAction()
      .then((list) => alive && setPeople(list))
      .catch(() => alive && setError("Не удалось загрузить получателей"));
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

  const recipient = people?.find((p) => p.key === who) ?? null;

  // Что у получателя уже есть — отмечать нельзя.
  const taken = useMemo(() => {
    const categories = new Set(recipient?.categories ?? []);
    const verbs = new Set(recipient?.verbs ?? []);
    return {
      category: (name: string) =>
        name !== NO_CATEGORY && categories.has(categoryKey(name)),
      verb: (v: MaterialVerb) => verbs.has(formsKey(v)),
    };
  }, [recipient]);

  if (!target) return null;

  /** Всё, что этому получателю ещё можно отдать. */
  const openIds = groups.flatMap((g) =>
    taken.category(g.name)
      ? []
      : g.verbs.filter((v) => !taken.verb(v)).map((v) => v.id),
  );

  // Отметки переживают смену получателя, но считаются и уезжают только те,
  // что этому получателю ещё нужны.
  const open = new Set(openIds);
  const sending = [...picked].filter((id) => open.has(id));

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
    if (!who) return;
    setError(null);
    startBusy(async () => {
      const res = await shareVerbsToRecipientAction(who, sending);
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone(res.message ?? "Передано");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl ring-1 ring-line sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-content">Поделиться глаголами</h2>
            <p className="mt-1 text-sm text-muted">
              Выбери получателя и отметь, что передать. Раздел глаголов у него
              заведётся сам, если его ещё нет.
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

        <p className="mt-4 text-[12px] font-semibold text-muted">Кому передать</p>

        {!people && !error && <p className="mt-2 text-sm text-faint">Загружаю…</p>}

        {people && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setWho(p.key)}
                title={p.section ? `Раздел: ${p.section}` : "Раздела ещё нет — заведём"}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition",
                  p.key === who
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:text-content",
                )}
              >
                {p.label}
                {p.section && (
                  <span
                    className={cn(
                      "text-[11px] font-normal",
                      p.key === who ? "text-white/70" : "text-faint",
                    )}
                  >
                    {p.verbs.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {recipient && (
          <p className="mt-2 text-[12px] text-faint">
            {recipient.section
              ? `Уедет в «${recipient.section}» — там уже ${recipient.verbs.length} глаголов.`
              : "Раздел «Irregular verbs» появится в конце материалов."}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-muted">
            Отмечено: {sending.length} из {openIds.length}
          </span>
          <button
            type="button"
            disabled={!recipient}
            onClick={() => toggle(openIds, true)}
            className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold text-muted transition hover:text-content disabled:opacity-40"
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

        <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-xl bg-surface-2 p-2">
          {groups.map((g) => {
            const blocked = taken.category(g.name);
            const ids = g.verbs.filter((v) => !taken.verb(v)).map((v) => v.id);
            const on = ids.filter((id) => picked.has(id)).length;
            const whole = ids.length > 0 && on === ids.length;

            return (
              <div key={g.name} className={cn("mb-2 last:mb-0", blocked && "opacity-50")}>
                <label
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 transition",
                    blocked || !recipient
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-surface",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={whole}
                    disabled={blocked || !recipient || ids.length === 0}
                    ref={(el) => {
                      // Часть группы отмечена — показываем это третьим состоянием.
                      if (el) el.indeterminate = on > 0 && !whole;
                    }}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="text-sm font-bold text-content">{g.name}</span>
                  {blocked ? (
                    <span className="flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                      <IconCheck className="h-3 w-3" /> уже есть
                    </span>
                  ) : (
                    <span className="text-[11px] text-faint">
                      {on > 0 ? `${on} из ${ids.length}` : g.verbs.length}
                    </span>
                  )}
                </label>

                <div className="ml-6 flex flex-col">
                  {g.verbs.map((v) => {
                    const has = blocked || taken.verb(v);
                    return (
                      <label
                        key={v.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1 transition",
                          has || !recipient
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer hover:bg-surface",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={picked.has(v.id) && !has}
                          disabled={has || !recipient}
                          onChange={(e) => toggle([v.id], e.target.checked)}
                          className="h-3.5 w-3.5 accent-[var(--accent)]"
                        />
                        <span className="w-5 shrink-0 text-center text-[13px]">
                          {v.icon ?? ""}
                        </span>
                        <span className="text-[13px] text-content">
                          {v.base} — {v.past} — {v.participle}
                        </span>
                        <span className="truncate text-[11px] text-faint">
                          {v.translation ?? ""}
                        </span>
                        {has && !blocked && (
                          <span className="ml-auto shrink-0 text-[11px] text-faint">
                            уже есть
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={share}
            disabled={busy || !who || sending.length === 0}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy
              ? "Передаю…"
              : !who
                ? "Выбери получателя"
                : sending.length === 0
                  ? "Отметь глаголы"
                  : `Поделиться (${sending.length})`}
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
