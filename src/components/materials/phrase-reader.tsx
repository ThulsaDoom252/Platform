"use client";

import { useEffect, useState, useTransition } from "react";
import {
  movePhraseAction,
  renameSectionAction,
  deleteSectionAction,
} from "@/lib/actions/materials";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { speakableText } from "@/lib/speech";
import {
  IconVolume,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconTrash,
} from "@/components/icons";

export type PhraseExample = { en: string; tr: string };

export type MaterialPhrase = {
  id: string;
  icon: string | null;
  imageUrl: string | null;
  phrase: string;
  transcription: string | null;
  translation: string | null;
  section: string | null;
  kind: string;
  examples: PhraseExample[];
};

/** Произношение через Web Speech API — без серверов и без платных API. */
function useSpeech() {
  const [ukAvailable, setUkAvailable] = useState(false);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    setSupported(true);

    const load = () => {
      const voices = synth.getVoices();
      setUkAvailable(voices.some((v) => v.lang.replace("_", "-") === "en-GB"));
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      synth.cancel();
    };
  }, []);

  function speak(key: string, text: string, lang: "en-US" | "en-GB") {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const spoken = speakableText(text);
    if (!spoken) return;
    synth.cancel();

    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = lang;
    const voices = synth.getVoices();
    const exact = voices.find((v) => v.lang.replace("_", "-") === lang);
    const fallback = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (exact ?? fallback) u.voice = exact ?? fallback!;
    u.rate = 0.95;
    u.onend = () => setSpeaking(null);
    u.onerror = () => setSpeaking(null);

    setSpeaking(key);
    synth.speak(u);
  }

  return { speak, ukAvailable, supported, speaking };
}

function SpeakButton({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition",
        active
          ? "bg-accent text-white"
          : "bg-surface-2 text-muted hover:bg-accent-soft hover:text-accent",
      )}
    >
      <IconVolume className={cn("h-3.5 w-3.5", active && "animate-pulse")} />
      {label}
    </button>
  );
}

/** Карандаш в углу карточки — правка и удаление записи. */
function EditBadge({ onEdit }: { onEdit?: () => void }) {
  if (!onEdit) return null;
  return (
    <button
      type="button"
      onClick={onEdit}
      title="Изменить или удалить запись"
      className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-faint opacity-0 transition hover:text-accent group-hover:opacity-100"
    >
      <IconPencil className="h-4 w-4" />
    </button>
  );
}

function PhraseCard({
  p,
  index,
  showTranslation,
  speech,
  onEdit,
}: {
  p: MaterialPhrase;
  index: number;
  showTranslation: boolean;
  speech: ReturnType<typeof useSpeech>;
  onEdit?: () => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const grad = ["grad-c1", "grad-c2", "grad-c3", "grad-c4"][index % 4];
  const visible = showTranslation || revealed;

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-accent/40">
      <EditBadge onEdit={onEdit} />
      <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
        {/* Картинка-образ */}
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.phrase}
            className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <span
            className={cn(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm sm:h-20 sm:w-20 sm:text-4xl",
              grad,
            )}
          >
            {p.icon ?? "💬"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {/* Фраза + транскрипция + произношение */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-base font-bold text-content sm:text-lg">{p.phrase}</h3>
            {p.transcription && (
              <span className="font-mono text-xs text-faint">{p.transcription}</span>
            )}
            {speech.supported && (
              <div className="flex items-center gap-1.5">
                <SpeakButton
                  label="US"
                  title={t.phrases.listenUS}
                  active={speech.speaking === `${p.id}-us`}
                  onClick={() => speech.speak(`${p.id}-us`, p.phrase, "en-US")}
                />
                {speech.ukAvailable && (
                  <SpeakButton
                    label="UK"
                    title={t.phrases.listenUK}
                    active={speech.speaking === `${p.id}-uk`}
                    onClick={() => speech.speak(`${p.id}-uk`, p.phrase, "en-GB")}
                  />
                )}
              </div>
            )}
          </div>

          {/* Перевод */}
          {p.translation && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className={cn(
                "mt-1.5 block w-full rounded-lg text-left text-sm font-semibold transition sm:text-[15px]",
                visible
                  ? "text-[color:var(--lesson-green)]"
                  : "select-none bg-surface-2 px-3 py-1.5 text-faint hover:bg-accent-soft",
              )}
            >
              {visible ? p.translation : t.phrases.tapToReveal}
            </button>
          )}

          {/* Примеры */}
          {p.examples.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-accent transition hover:opacity-80"
            >
              <IconChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")}
              />
              {open
                ? t.phrases.hideExamples
                : fmt(t.phrases.examples, { n: p.examples.length })}
            </button>
          )}
        </div>
      </div>

      {open && p.examples.length > 0 && (
        <div className="border-t border-line bg-surface-2 px-4 py-3.5 sm:px-5">
          <ul className="flex flex-col gap-3">
            {p.examples.map((ex, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-content">
                    {ex.en}
                    {speech.supported && (
                      <button
                        type="button"
                        onClick={() => speech.speak(`${p.id}-ex${i}`, ex.en, "en-US")}
                        title={t.phrases.listenUS}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition",
                          speech.speaking === `${p.id}-ex${i}`
                            ? "bg-accent text-white"
                            : "text-faint hover:bg-accent-soft hover:text-accent",
                        )}
                      >
                        <IconVolume className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </p>
                  {visible && (
                    <p className="mt-0.5 text-[13px] italic text-muted">{ex.tr}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/** Пояснительная заметка 💡 между группами фраз. */
function NoteCard({ p, onEdit }: { p: MaterialPhrase; onEdit?: () => void }) {
  return (
    <div className="tint-amber group relative rounded-2xl px-4 py-3.5 text-sm">
      <EditBadge onEdit={onEdit} />
      <p className="font-semibold">💡 {p.phrase}</p>
      {p.translation && (
        <p className="mt-1 leading-snug opacity-90">{p.translation}</p>
      )}
    </div>
  );
}

export function PhraseReader({
  title,
  icon,
  description,
  coverImageUrl,
  phrases,
  onEditPhrase,
  nodeId,
}: {
  title: string;
  icon: string | null;
  description: string | null;
  coverImageUrl?: string | null;
  phrases: MaterialPhrase[];
  /** Передаётся только учителю — у ученика правки нет. */
  onEditPhrase?: (p: MaterialPhrase) => void;
  /** Страница, которой принадлежат записи: нужна для правки категорий. */
  nodeId?: string;
}) {
  const { t } = useT();
  const [showTranslation, setShowTranslation] = useState(true);
  const speech = useSpeech();

  const editable = !!onEditPhrase && !!nodeId;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ id: string; where: "before" | "after" } | null>(null);
  const [dropSection, setDropSection] = useState<string | null | undefined>(undefined);
  const [busy, startMove] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  if (phrases.length === 0) {
    return <p className="py-16 text-center text-sm text-faint">{t.phrases.empty}</p>;
  }

  // Группируем по секциям, сохраняя исходный порядок.
  const groups: { section: string | null; items: MaterialPhrase[] }[] = [];
  for (const p of phrases) {
    const last = groups[groups.length - 1];
    if (last && last.section === (p.section ?? null)) last.items.push(p);
    else groups.push({ section: p.section ?? null, items: [p] });
  }

  const phraseCount = phrases.filter((p) => p.kind !== "NOTE").length;

  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    startMove(async () => {
      const res = await fn();
      setNotice(res.error ?? res.message ?? null);
    });

  function finishDrag() {
    setDragId(null);
    setDropAt(null);
    setDropSection(undefined);
  }

  /** Край карточки — встать рядом, середина — тоже рядом: слова плоские. */
  const cardDrag = (p: MaterialPhrase) => {
    if (!editable) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", p.id);
        setDragId(p.id);
      },
      onDragEnd: finishDrag,
      onDragOver: (e: React.DragEvent) => {
        if (!dragId || dragId === p.id) return;
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const where = e.clientY - r.top < r.height / 2 ? "before" : "after";
        if (dropAt?.id !== p.id || dropAt.where !== where) setDropAt({ id: p.id, where });
      },
      onDragLeave: () => {
        if (dropAt?.id === p.id) setDropAt(null);
      },
      onDrop: (e: React.DragEvent) => {
        if (!dragId || dragId === p.id) return;
        e.preventDefault();
        e.stopPropagation();
        const id = dragId;
        const where = dropAt?.where ?? "before";
        finishDrag();
        run(() => movePhraseAction(id, { phraseId: p.id, where }));
      },
    };
  };

  /** Заголовок принимает слово — оно уходит в конец этой категории. */
  const headerDrop = (section: string | null) => {
    if (!editable) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        setDropSection(section);
      },
      onDragLeave: () => setDropSection(undefined),
      onDrop: (e: React.DragEvent) => {
        if (!dragId) return;
        e.preventDefault();
        const id = dragId;
        finishDrag();
        run(() => movePhraseAction(id, { section }));
      },
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка страницы */}
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl p-5 text-white shadow-md sm:min-h-56 sm:p-6",
          coverImageUrl ? "bg-slate-950" : "grad-accent",
        )}
      >
        {coverImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
          </>
        )}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">
              {icon ?? "📖"}
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
              {description && (
                <p className="mt-0.5 text-sm text-white/80">{description}</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-white/70">
            {fmt(t.phrases.count, { n: phraseCount })}
          </p>
        </div>
        {!coverImageUrl && (
          <>
            <div className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute right-16 -top-10 h-24 w-24 rounded-full bg-white/10" />
          </>
        )}
      </header>

      {/* Управление */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-xl bg-surface px-3.5 text-xs font-semibold text-muted ring-1 ring-line transition hover:text-content"
        >
          {showTranslation ? (
            <IconEyeOff className="h-4 w-4" />
          ) : (
            <IconEye className="h-4 w-4" />
          )}
          {showTranslation ? t.phrases.hideTranslations : t.phrases.showTranslations}
        </button>
      </div>

      {/* Секции с фразами */}
      <div className="flex flex-col gap-5">
        {groups.map((g, gi) => (
          <section key={gi} className="flex flex-col gap-3">
            <div
              {...headerDrop(g.section)}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-1 py-1 transition",
                dropSection === g.section && "bg-accent-soft ring-1 ring-accent",
              )}
            >
              <span className="h-4 w-1 shrink-0 rounded-full bg-accent" />
              <h3 className="flex-1 text-sm font-bold text-content">
                {g.section ?? (editable ? "Без категории" : "")}
              </h3>

              {editable && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = prompt("Название категории", g.section ?? "");
                      if (next && next.trim() && next !== g.section) {
                        run(() => renameSectionAction(nodeId!, g.section, next));
                      }
                    }}
                    title="Переименовать категорию"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-faint opacity-0 transition hover:text-accent group-hover:opacity-100"
                  >
                    <IconPencil className="h-3.5 w-3.5" />
                  </button>
                  {g.section && (
                    <button
                      type="button"
                      onClick={() => {
                        const purge = confirm(
                          `Категория «${g.section}» — ${g.items.length} записей.\n\n` +
                            "OK — удалить вместе со словами.\n" +
                            "Отмена — убрать только заголовок, слова останутся.",
                        );
                        run(() => deleteSectionAction(nodeId!, g.section, purge));
                      }}
                      title="Убрать категорию"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-faint opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>

            {g.items.map((p, i) => (
              <div
                key={p.id}
                {...cardDrag(p)}
                className={cn(
                  "relative transition",
                  dragId === p.id && "opacity-40",
                  editable && "cursor-grab active:cursor-grabbing",
                )}
              >
                {dropAt?.id === p.id && (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-0 right-0 z-10 h-0.5 rounded-full bg-accent",
                      dropAt.where === "before" ? "-top-1.5" : "-bottom-1.5",
                    )}
                  />
                )}
                {p.kind === "NOTE" ? (
                  <NoteCard p={p} onEdit={onEditPhrase && (() => onEditPhrase(p))} />
                ) : (
                  <PhraseCard
                    p={p}
                    index={gi + i}
                    showTranslation={showTranslation}
                    speech={speech}
                    onEdit={onEditPhrase && (() => onEditPhrase(p))}
                  />
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      {editable && (
        <button
          type="button"
          onClick={() => {
            const name = prompt("Название новой категории");
            if (!name || !name.trim()) return;
            // Пустая категория нигде не хранится: заводим её на первом слове,
            // которое пока ни к какой не относится.
            const orphan = phrases.find((p) => !p.section);
            if (!orphan) {
              setNotice("Сначала перетащи сюда слово — пустая категория не хранится.");
              return;
            }
            run(() => movePhraseAction(orphan.id, { section: name.trim() }));
          }}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        >
          + Категория
        </button>
      )}

      {(busy || notice) && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-surface px-4 py-2.5 text-sm font-semibold text-content shadow-xl ring-1 ring-line">
          {notice ?? "Переношу…"}
        </div>
      )}
    </div>
  );
}
