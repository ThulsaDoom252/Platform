"use client";

/**
 * Произношение через Web Speech API — без серверов и без платных ключей.
 *
 * Общий на читалку словника и на страницы правил: раньше в каждой лежала
 * своя копия, и они успели разойтись — в правилах говорил только
 * американский голос.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
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

  // Уходим со страницы — обрываем чтение, иначе голос продолжит говорить.
  useEffect(() => () => synthesizer()?.cancel(), []);

  function speak(key: string, text: string, lang: Accent) {
    const synth = synthesizer();
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
