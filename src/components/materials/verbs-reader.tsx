"use client";

/**
 * Страница неправильных глаголов.
 *
 * Два вида на одни и те же данные: по категориям, которые учитель
 * придумал для запоминания, и сплошной алфавитный список. Панель
 * категорий липнет к верху и перепрыгивает к нужной группе.
 *
 * Озвучиваются все три формы подряд — так слышно чередование гласной,
 * ради которого глаголы и учат. Звучащая форма подсвечивается.
 *
 * Учитель перетаскивает группы на панели, чтобы задать их порядок.
 */
import { useMemo, useState, type DragEvent } from "react";
import type { MaterialVerb } from "@/lib/materials";
import { useSpeech } from "./speech";
import { IconVolume, IconPencil } from "@/components/icons";
import { cn } from "@/lib/utils";

const NO_CATEGORY = "Без категории";

/**
 * Группы в порядке показа: так, как их расставил учитель, — по первому
 * глаголу группы. Глаголы приходят уже упорядоченными.
 */
function group(verbs: MaterialVerb[], order: string[] | null) {
  const byName = new Map<string, MaterialVerb[]>();
  for (const v of verbs) {
    const name = v.category?.trim() || NO_CATEGORY;
    byName.set(name, [...(byName.get(name) ?? []), v]);
  }

  let names = [...byName.keys()];
  if (order) {
    const rank = (n: string) => {
      const i = order.indexOf(n);
      return i === -1 ? order.length : i;
    };
    names = names.sort((a, b) => rank(a) - rank(b));
  }

  return names.map((name) => ({
    name,
    id: `verbs-${name.replace(/\W+/gu, "-").toLowerCase()}`,
    verbs:
      name === NO_CATEGORY
        ? [...byName.get(name)!].sort((a, b) => a.base.localeCompare(b.base, "en"))
        : byName.get(name)!,
  }));
}

export function VerbsReader({
  verbs,
  onEdit,
  onReorder,
  onFillIcons,
  lang,
  onTranslate,
  busy = false,
}: {
  verbs: MaterialVerb[];
  /** Открыть правку. Аргумент — группа, с которой открыть; null — «без категории». */
  onEdit?: (category: string | null) => void;
  /** Сохранить новый порядок групп. null — «без категории». */
  onReorder?: (order: (string | null)[]) => void;
  /** Подобрать иконки, где их нет: всем (undefined) или одной группе. */
  onFillIcons?: (category?: string | null) => void;
  /** Текущий язык перевода страницы. */
  lang?: "RU" | "UK";
  onTranslate?: (lang: "RU" | "UK") => void;
  busy?: boolean;
}) {
  const [alphabetical, setAlphabetical] = useState(false);
  const speech = useSpeech();

  /*
   * Порядок, пока его перетаскивают и сохраняют. Привязан к списку
   * глаголов: пришёл новый список с сервера — порядок уже в нём.
   */
  const [draft, setDraft] = useState<{ verbs: MaterialVerb[]; names: string[] } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const order = draft?.verbs === verbs ? draft.names : null;

  const groups = useMemo(() => group(verbs, order), [verbs, order]);
  const all = useMemo(
    () => [...verbs].sort((a, b) => a.base.localeCompare(b.base, "en")),
    [verbs],
  );

  const names = groups.map((g) => g.name);
  const missingIcons = verbs.filter((v) => !v.icon?.trim()).length;

  /** Тащим группу над другой — сразу ставим её на это место. */
  function dragOver(e: DragEvent, target: string) {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragging === target) return;
    const next = names.filter((n) => n !== dragging);
    const at = names.indexOf(target) > names.indexOf(dragging)
      ? next.indexOf(target) + 1
      : next.indexOf(target);
    next.splice(at, 0, dragging);
    setDraft({ verbs, names: next });
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    const was = dragging;
    setDragging(null);
    if (!was || !onReorder) return;
    onReorder(names.map((n) => (n === NO_CATEGORY ? null : n)));
  }

  if (verbs.length === 0) return null;

  /** Одна строка: три формы с транскрипцией, перевод и озвучка. */
  const row = (v: MaterialVerb, place: string) => {
    const key = `${place}-${v.id}`;
    const speaking = speech.speaking?.startsWith(key) ?? false;

    const form = (index: number, word: string, ipa: string | null, tone: string) => {
      // Звучащая сейчас форма — плашка цветом темы.
      const now = speaking && speech.part === index;
      return (
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span
            className={cn(
              "-mx-1.5 max-w-[calc(100%+0.75rem)] truncate rounded-md px-1.5 text-[15px] font-semibold transition-colors duration-150",
              now ? "bg-accent text-white" : tone,
            )}
          >
            {word}
          </span>
          {ipa && <span className="max-w-full truncate text-[11px] text-faint">{ipa}</span>}
        </span>
      );
    };

    return (
      <div
        key={key}
        className="flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0"
      >
        <span className="w-7 shrink-0 text-center text-lg leading-none">{v.icon ?? ""}</span>

        <span className="flex min-w-0 flex-[3] items-center gap-2">
          {form(0, v.base, v.baseIpa, "text-content")}
          <span className="shrink-0 text-faint">→</span>
          {form(1, v.past, v.pastIpa, "text-accent")}
          <span className="shrink-0 text-faint">→</span>
          {form(2, v.participle, v.participleIpa, "text-accent")}
        </span>

        <span className="hidden min-w-0 flex-1 truncate text-[13px] text-muted sm:block">
          {v.translation ?? ""}
        </span>

        {speech.supported && (
          <span className="flex shrink-0 items-center gap-1">
            {(["en-US", "en-GB"] as const).map((accent) => {
              const missing = accent === "en-GB" && !speech.ukAvailable;
              const label = accent === "en-US" ? "US" : "UK";
              return (
                <button
                  key={accent}
                  type="button"
                  disabled={missing}
                  onClick={() =>
                    // Три формы подряд — ради чередования гласной.
                    speech.speakParts(`${key}-${accent}`, [v.base, v.past, v.participle], accent)
                  }
                  title={
                    missing
                      ? "Британский голос не установлен в системе"
                      : `Три формы: ${v.base} — ${v.past} — ${v.participle}`
                  }
                  className={cn(
                    "flex h-6 items-center gap-0.5 rounded px-1.5 text-[10px] font-bold transition",
                    missing && "opacity-30",
                    speaking && speech.speaking?.endsWith(accent)
                      ? "bg-accent text-white"
                      : "text-faint hover:bg-accent-soft hover:text-accent",
                  )}
                >
                  <IconVolume className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </span>
        )}
      </div>
    );
  };

  const tab = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-lg px-3 text-[12px] font-semibold transition",
        active ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Панель липнет к верху: по ней прыгают между группами. */}
      <div className="sticky top-16 z-[7] -mx-2 rounded-2xl bg-surface/95 px-2 py-2 backdrop-blur-md ring-1 ring-line">
        {(onEdit || onTranslate || onFillIcons) && (
          <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5 border-b border-line pb-2">
            {onTranslate && (
              <div className="flex h-8 items-center gap-1 rounded-lg border border-line px-1">
                <span className="px-1 text-[11px] font-semibold text-faint">Перевод</span>
                {(["UK", "RU"] as const).map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => onTranslate(language)}
                    disabled={busy || lang === language}
                    title={
                      lang === language
                        ? "Текущий язык перевода"
                        : `Перевести все глаголы на ${language === "UK" ? "украинский" : "русский"}`
                    }
                    className={cn(
                      "h-6 rounded-md px-2 text-[11px] font-bold transition disabled:opacity-60",
                      lang === language
                        ? "bg-accent text-white disabled:opacity-100"
                        : "text-muted hover:bg-surface-2 hover:text-content",
                    )}
                  >
                    {language === "UK" ? "🇺🇦 UA" : "🇷🇺 RU"}
                  </button>
                ))}
              </div>
            )}
            {onFillIcons && (
              <button
                type="button"
                onClick={() => onFillIcons(undefined)}
                disabled={busy || missingIcons === 0}
                title={
                  missingIcons
                    ? `Подобрать иконки глаголам без них: ${missingIcons}`
                    : "У всех глаголов уже есть иконки"
                }
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-semibold text-content transition hover:border-accent hover:text-accent disabled:opacity-50 disabled:hover:border-line disabled:hover:text-content"
              >
                <span aria-hidden>✨</span> Иконки
                {missingIcons > 0 && <span className="text-faint">{missingIcons}</span>}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(null)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-semibold text-content transition hover:border-accent hover:text-accent"
              >
                <IconPencil className="h-3.5 w-3.5" /> Редактировать
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {tab(!alphabetical, "По категориям", () => setAlphabetical(false))}
          {tab(alphabetical, "Все по алфавиту", () => setAlphabetical(true))}
          <span className="ml-auto text-[11px] text-faint">{verbs.length} глаголов</span>
        </div>

        {!alphabetical && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {groups.map((g) => (
              <a
                key={g.id}
                href={`#${g.id}`}
                draggable={!!onReorder && !busy}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", g.name);
                  setDragging(g.name);
                }}
                onDragOver={(e) => dragOver(e, g.name)}
                onDrop={drop}
                onDragEnd={() => setDragging(null)}
                title={onReorder ? "Щёлкни — перейти к группе, тащи — поменять порядок" : undefined}
                className={cn(
                  "h-7 select-none rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold leading-7 text-muted transition hover:bg-accent-soft hover:text-accent",
                  onReorder && "cursor-grab active:cursor-grabbing",
                  dragging === g.name && "opacity-40 ring-2 ring-accent",
                )}
              >
                {g.name}
                <span className="ml-1 text-faint">{g.verbs.length}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {alphabetical ? (
        <div className="rounded-2xl bg-surface ring-1 ring-line">
          {all.map((v) => row(v, "all"))}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-40">
            {/* Полоса во всю ширину цветом темы — так группы видно сразу. */}
            <h3 className="mb-2 flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-white shadow-sm">
              <span className="min-w-0 flex-1 truncate text-base font-bold">{g.name}</span>
              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                {g.verbs.length}
              </span>
              {onFillIcons && g.verbs.some((v) => !v.icon?.trim()) && (
                <button
                  type="button"
                  onClick={() => onFillIcons(g.name === NO_CATEGORY ? null : g.name)}
                  disabled={busy}
                  title={`Подобрать иконки группе «${g.name}», где их нет`}
                  aria-label={`Подобрать иконки группе ${g.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[13px] transition hover:bg-white/20 disabled:opacity-50"
                >
                  ✨
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(g.name === NO_CATEGORY ? null : g.name)}
                  title={`Править группу «${g.name}»`}
                  aria-label={`Править группу ${g.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  <IconPencil className="h-3.5 w-3.5" />
                </button>
              )}
            </h3>
            <div className="rounded-2xl bg-surface ring-1 ring-line">
              {g.verbs.map((v) => row(v, g.id))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
