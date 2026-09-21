"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  IconVolume,
  IconChevronDown,
  IconEye,
  IconEyeOff,
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

/**
 * Текст для озвучки.
 * Пометки в скобках — «cook (noun)», «no love lost (between ...)» — это
 * подсказки для чтения глазами, вслух их произносить не нужно.
 */
export function speakableText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

function PhraseCard({
  p,
  index,
  showTranslation,
  speech,
}: {
  p: MaterialPhrase;
  index: number;
  showTranslation: boolean;
  speech: ReturnType<typeof useSpeech>;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const grad = ["grad-c1", "grad-c2", "grad-c3", "grad-c4"][index % 4];
  const visible = showTranslation || revealed;

  return (
    <article className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:ring-accent/40">
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
function NoteCard({ p }: { p: MaterialPhrase }) {
  return (
    <div className="tint-amber rounded-2xl px-4 py-3.5 text-sm">
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
  phrases,
}: {
  title: string;
  icon: string | null;
  description: string | null;
  phrases: MaterialPhrase[];
}) {
  const { t } = useT();
  const [showTranslation, setShowTranslation] = useState(true);
  const speech = useSpeech();

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

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка страницы */}
      <header className="grad-accent relative overflow-hidden rounded-2xl p-5 text-white shadow-md sm:p-6">
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
        <div className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-16 -top-10 h-24 w-24 rounded-full bg-white/10" />
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
            {g.section && (
              <h3 className="flex items-center gap-2 px-1 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full bg-accent" />
                {g.section}
              </h3>
            )}
            {g.items.map((p, i) =>
              p.kind === "NOTE" ? (
                <NoteCard key={p.id} p={p} />
              ) : (
                <PhraseCard
                  key={p.id}
                  p={p}
                  index={gi + i}
                  showTranslation={showTranslation}
                  speech={speech}
                />
              ),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
