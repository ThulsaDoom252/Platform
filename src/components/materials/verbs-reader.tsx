"use client";

/**
 * Страница неправильных глаголов.
 *
 * Два вида на одни и те же данные: по категориям, которые учитель
 * придумал для запоминания, и сплошной алфавитный список. Панель
 * категорий липнет к верху и перепрыгивает к нужной группе.
 *
 * Озвучиваются все три формы подряд — так слышно чередование гласной,
 * ради которого глаголы и учат.
 */
import { useMemo, useState } from "react";
import type { MaterialVerb } from "@/lib/materials";
import { useSpeech } from "./speech";
import { IconVolume, IconPencil } from "@/components/icons";
import { cn } from "@/lib/utils";

const NO_CATEGORY = "Без категории";

/** Группы в порядке показа: безымянная первая, остальные по алфавиту. */
function group(verbs: MaterialVerb[]) {
  const byName = new Map<string, MaterialVerb[]>();
  for (const v of verbs) {
    const name = v.category?.trim() || NO_CATEGORY;
    byName.set(name, [...(byName.get(name) ?? []), v]);
  }

  const names = [...byName.keys()].sort((a, b) => {
    if (a === NO_CATEGORY) return -1;
    if (b === NO_CATEGORY) return 1;
    return a.localeCompare(b, "uk");
  });

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
}: {
  verbs: MaterialVerb[];
  /** Открыть окно правки. Ученику не передаётся — у него кнопки нет. */
  onEdit?: () => void;
}) {
  const [alphabetical, setAlphabetical] = useState(false);
  const speech = useSpeech();

  const groups = useMemo(() => group(verbs), [verbs]);
  const all = useMemo(
    () => [...verbs].sort((a, b) => a.base.localeCompare(b.base, "en")),
    [verbs],
  );

  if (verbs.length === 0) return null;

  /** Одна строка: три формы с транскрипцией, перевод и озвучка. */
  const row = (v: MaterialVerb, place: string) => {
    const key = `${place}-${v.id}`;
    const speaking = speech.speaking?.startsWith(key) ?? false;

    const form = (word: string, ipa: string | null, tone: string) => (
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-semibold", tone)}>{word}</span>
        {ipa && <span className="block truncate text-[11px] text-faint">{ipa}</span>}
      </span>
    );

    return (
      <div
        key={key}
        className="flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0"
      >
        <span className="w-7 shrink-0 text-center text-lg leading-none">{v.icon ?? ""}</span>

        <span className="flex min-w-0 flex-[3] items-center gap-2">
          {form(v.base, v.baseIpa, "text-content")}
          <span className="shrink-0 text-faint">→</span>
          {form(v.past, v.pastIpa, "text-accent")}
          <span className="shrink-0 text-faint">→</span>
          {form(v.participle, v.participleIpa, "text-accent")}
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
                    speech.speak(`${key}-${accent}`, `${v.base}, ${v.past}, ${v.participle}`, accent)
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
        {onEdit && (
          <div className="mb-2 flex justify-end border-b border-line pb-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-semibold text-content transition hover:border-accent hover:text-accent"
            >
              <IconPencil className="h-3.5 w-3.5" /> Редактировать
            </button>
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
                className="h-7 rounded-lg bg-surface-2 px-2.5 text-[12px] font-semibold leading-7 text-muted transition hover:bg-accent-soft hover:text-accent"
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
            <h3 className="mb-2 flex items-center gap-2 px-1">
              <span className="h-4 w-1 shrink-0 rounded-full bg-accent" />
              <span className="text-base font-bold text-content">{g.name}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-faint">
                {g.verbs.length}
              </span>
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
