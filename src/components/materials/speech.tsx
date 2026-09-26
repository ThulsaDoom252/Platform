"use client";

/**
 * Произношение через Web Speech API — без серверов и без платных ключей.
 *
 * Общий на читалку словника и на страницы правил: раньше в каждой лежала
 * своя копия, и они успели разойтись — в правилах говорил только
 * американский голос.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { speakableText } from "@/lib/speech";
import { IconVolume } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Accent = "en-US" | "en-GB";

/** Синтез речи в браузере, если он вообще есть. */
function synthesizer() {
  return typeof window === "undefined" ? undefined : window.speechSynthesis;
}

/**
 * Голоса подгружаются не сразу, поэтому браузер сообщает о них событием.
 * Это внешнее состояние, а не состояние компонента: читаем его напрямую,
 * иначе после монтирования получаем лишний каскад рендеров.
 */
function subscribeVoices(listener: () => void) {
  const synth = synthesizer();
  synth?.addEventListener?.("voiceschanged", listener);
  return () => synth?.removeEventListener?.("voiceschanged", listener);
}

const readSupported = () => !!synthesizer();

const readUkVoice = () =>
  (synthesizer()?.getVoices() ?? []).some(
    (voice) => voice.lang.replace("_", "-") === "en-GB",
  );

export function useSpeech() {
  const supported = useSyncExternalStore(subscribeVoices, readSupported, () => false);
  const ukAvailable = useSyncExternalStore(subscribeVoices, readUkVoice, () => false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  /** Какая по счёту часть звучит сейчас — для подсветки слова в ряду. */
  const [part, setPart] = useState<number | null>(null);
  /*
   * Номер текущего чтения. cancel() прерванного чтения присылает end и
   * error уже после того, как запустили новое, — без номера они гасили бы
   * подсветку только что начатого.
   */
  const run = useRef(0);

  // Уходим со страницы — обрываем чтение, иначе голос продолжит говорить.
  useEffect(() => () => synthesizer()?.cancel(), []);

  /**
   * Прочитать несколько частей подряд, отдельными фразами. Так браузер
   * сообщает, какая из них звучит, — события о границах слов приходят
   * не от всех голосов.
   */
  function speakParts(key: string, parts: string[], lang: Accent) {
    const synth = synthesizer();
    if (!synth) return;
    const spoken = parts.map(speakableText).filter(Boolean);
    if (spoken.length === 0) return;
    synth.cancel();

    const id = ++run.current;
    const voices = synth.getVoices();
    const exact = voices.find((v) => v.lang.replace("_", "-") === lang);
    const fallback = voices.find((v) => v.lang.toLowerCase().startsWith("en"));

    const finish = () => {
      if (run.current !== id) return;
      setSpeaking(null);
      setPart(null);
    };

    spoken.forEach((text, index) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      if (exact ?? fallback) u.voice = exact ?? fallback!;
      u.rate = 0.95;
      u.onstart = () => {
        if (run.current === id) setPart(index);
      };
      if (index === spoken.length - 1) u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    });

    setSpeaking(key);
    setPart(0);
  }

  function speak(key: string, text: string, lang: Accent) {
    speakParts(key, [text], lang);
  }

  return { speak, speakParts, ukAvailable, supported, speaking, part };
}

/**
 * Пара кнопок «US / UK» рядом со словом.
 *
 * Британского голоса в системе может не быть — тогда кнопка остаётся, но
 * приглушена и объясняет, чего не хватает: молча подсовывать американский
 * вместо британского в правиле про произношение нельзя.
 */
export function SpeakPair({
  text,
  id,
  speech,
}: {
  text: string;
  /** Свой ключ на каждое слово, чтобы подсвечивалось только звучащее. */
  id: string;
  speech: ReturnType<typeof useSpeech>;
}) {
  if (!speech.supported) return null;

  const button = (accent: Accent, label: string) => {
    const key = `${id}-${accent}`;
    const missing = accent === "en-GB" && !speech.ukAvailable;

    return (
      <button
        type="button"
        onClick={() => speech.speak(key, text, accent)}
        disabled={missing}
        title={
          missing
            ? "Британский голос не установлен в системе"
            : `Произнести «${text}» (${label})`
        }
        aria-label={`${text} — ${label}`}
        className={cn(
          "flex h-5 items-center gap-0.5 rounded px-1 text-[10px] font-bold leading-none transition",
          missing && "opacity-30",
          speech.speaking === key
            ? "bg-accent text-white"
            : "text-faint hover:bg-accent-soft hover:text-accent",
        )}
      >
        <IconVolume className="h-3 w-3" />
        {label}
      </button>
    );
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 align-middle">
      {button("en-US", "US")}
      {button("en-GB", "UK")}
    </span>
  );
}
