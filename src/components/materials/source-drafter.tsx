"use client";

/**
 * «Получить исходный формат» — одна панель на все окна наполнения.
 *
 * Сюда кидают либо старый текст, либо просьбу словами: «словник про
 * спорт», «правило про артиклі». Обратно приходит готовый исходник в
 * ключевом формате, который тут же подставляется в поле вставки.
 *
 * Панель свёрнута по умолчанию: чаще всего текст у учителя уже есть, и
 * лишнее поле мешало бы.
 */
import { useState, useTransition } from "react";
import { draftKeyedSourceAction } from "@/lib/actions/materials";
import type { KeyedKind } from "@/lib/format-author";
import { IconChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

const KINDS: { value: KeyedKind | ""; label: string }[] = [
  { value: "", label: "Определить самому" },
  { value: "VOCAB", label: "Словарь" },
  { value: "RULE", label: "Правило" },
  { value: "LEXIS", label: "Лексика" },
  { value: "TENSE", label: "Время" },
];

export function SourceDrafter({
  /** Куда положить готовый исходник. */
  onDraft,
  /** Тип страницы, если он уже известен: тогда его и просим. */
  defaultKind,
}: {
  onDraft: (text: string) => void;
  defaultKind?: KeyedKind;
}) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [kind, setKind] = useState<KeyedKind | "">(defaultKind ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function ask() {
    const text = request.trim();
    if (!text) return;
    setError(null);

    startBusy(async () => {
      const res = await draftKeyedSourceAction(text, kind || undefined);
      if (res.error || !res.text) {
        setError(res.error ?? "Пустой ответ");
        return;
      }
      onDraft(res.text);
      setRequest("");
      setOpen(false);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-content"
      >
        <span aria-hidden>✨</span>
        Получить исходный формат
        <IconChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-faint transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 border-t border-line p-3.5">
          <p className="text-[12px] text-muted">
            Вставь старый текст — он переложится в наш формат. Или напиши
            словами, что нужно: «словник про спорт», «правило про артиклі».
          </p>

          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={4}
            placeholder="Старый текст или просьба…"
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KeyedKind | "")}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-sm text-content outline-none transition focus:border-accent"
            >
              {KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={ask}
              disabled={busy || !request.trim()}
              className="h-9 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Собираю…" : "Получить"}
            </button>

            {busy && (
              <span className="text-[12px] text-faint">
                Это занимает до минуты — материал собирается целиком.
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
