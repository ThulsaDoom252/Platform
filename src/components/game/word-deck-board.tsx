"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  buildWordDeck,
  canDealNextWordDeckCard,
  normalizeWordDeckLiveState,
  normalizeWordDeckSettings,
  shuffleWordDeckTail,
  type WordDeckLiveState,
  type WordDeckSettings,
  type WordDeckSourceCard,
} from "@/lib/word-deck";
import {
  classWordDeckLiveStateAction,
  saveClassWordDeckLiveStateAction,
} from "@/lib/actions/word-deck";
import { cn } from "@/lib/utils";

export type WordDeckPlayable = {
  id: string;
  title: string;
  cards: WordDeckSourceCard[];
  settings: WordDeckSettings;
  backgroundImageUrl: string | null;
  liveState?: WordDeckLiveState | null;
};

const backgrounds: Record<Exclude<WordDeckSettings["background"], "CUSTOM">, string> = {
  MIDNIGHT:
    "radial-gradient(circle at 18% 18%,rgba(45,212,191,.24),transparent 32%),radial-gradient(circle at 82% 12%,rgba(99,102,241,.28),transparent 35%),linear-gradient(145deg,#0f172a,#111827 52%,#172554)",
  EMERALD:
    "radial-gradient(circle at 80% 20%,rgba(253,224,71,.24),transparent 28%),linear-gradient(145deg,#064e3b,#047857 54%,#0f766e)",
  VIOLET:
    "radial-gradient(circle at 20% 10%,rgba(244,114,182,.28),transparent 30%),linear-gradient(145deg,#312e81,#6d28d9 55%,#701a75)",
  SUNSET:
    "radial-gradient(circle at 70% 18%,rgba(254,240,138,.34),transparent 28%),linear-gradient(145deg,#7c2d12,#ea580c 55%,#9f1239)",
};

function beep(kind: "deal" | "shuffle") {
  if (typeof window === "undefined") return;
  const Audio = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Audio) return;
  const audio = new Audio();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);
  gain.connect(audio.destination);
  const tones = kind === "shuffle" ? [260, 390, 310] : [360, 540];
  tones.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    oscillator.type = kind === "shuffle" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(audio.currentTime + index * 0.045);
    oscillator.stop(audio.currentTime + 0.12 + index * 0.045);
  });
  window.setTimeout(() => void audio.close(), 450);
}

export function WordDeckBoard({ activity, compact = false, live = false, observer = false }: {
  activity: WordDeckPlayable;
  compact?: boolean;
  /** Публиковать действия учителя в живой класс. */
  live?: boolean;
  /** Ученик видит общий стол, но не может им управлять. */
  observer?: boolean;
}) {
  const { t } = useT();
  const settings = useMemo(() => normalizeWordDeckSettings(activity.settings), [activity.settings]);
  const initial = useMemo(
    () => buildWordDeck(activity.cards, settings),
    [activity.cards, settings],
  );
  const saved = useMemo(
    () => normalizeWordDeckLiveState(activity.cards, settings, activity.liveState),
    [activity.cards, activity.liveState, settings],
  );
  const [deck, setDeck] = useState(saved?.deck ?? initial);
  const [at, setAt] = useState(saved?.at ?? -1);
  const [faceUp, setFaceUp] = useState(saved?.faceUp ?? false);
  const [sound, setSound] = useState(saved?.sound ?? settings.sound);
  const [time, setTime] = useState(
    saved?.time ?? (settings.timerMode === "GAME" ? settings.gameSeconds : settings.cardSeconds),
  );
  const [expired, setExpired] = useState(saved?.expired ?? false);
  const started = at >= 0;
  const finished = at >= deck.length - 1 && started;
  const canDeal = canDealNextWordDeckCard({
    cardCount: deck.length,
    at,
    expired,
    observer,
  });
  const current = deck[at] ?? null;
  const flipTimer = useRef<number | null>(null);
  const lastRemoteAt = useRef(saved?.updatedAt ?? "");
  const publishQueue = useRef(Promise.resolve());

  const deal = useCallback(() => {
    if (!canDeal) return;
    if (sound) beep("deal");
    setFaceUp(false);
    setExpired(false);
    setAt((value) => value + 1);
    if (settings.timerMode === "CARD") setTime(settings.cardSeconds);
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    flipTimer.current = window.setTimeout(() => setFaceUp(true), 260);
  }, [canDeal, settings.cardSeconds, settings.timerMode, sound]);

  useEffect(() => () => {
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
  }, []);

  useEffect(() => {
    if (observer || !started || expired || settings.timerMode === "NONE" || time <= 0) return;
    const timer = window.setTimeout(() => {
      setTime((value) => Math.max(0, value - 1));
      if (time <= 1) setExpired(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [expired, observer, settings.timerMode, started, time]);

  useEffect(() => {
    if (!observer) return;
    let alive = true;
    let pulling = false;
    const pull = async () => {
      if (pulling) return;
      pulling = true;
      try {
        const state = await classWordDeckLiveStateAction(activity.id);
        if (!alive || !state || state.updatedAt === lastRemoteAt.current) return;
        lastRemoteAt.current = state.updatedAt;
        setDeck(state.deck);
        setAt(state.at);
        setFaceUp(state.faceUp);
        setSound(state.sound);
        setTime(state.time);
        setExpired(state.expired);
      } finally {
        pulling = false;
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 250);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activity.id, observer]);

  useEffect(() => {
    if (!live || observer) return;
    const state: WordDeckLiveState = {
      deck,
      at,
      faceUp,
      sound,
      time,
      expired,
      updatedAt: new Date().toISOString(),
    };
    const timer = window.setTimeout(() => {
      publishQueue.current = publishQueue.current.then(async () => {
        await saveClassWordDeckLiveStateAction(activity.id, state);
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activity.id, at, deck, expired, faceUp, live, observer, sound, time]);

  const shuffle = () => {
    if (observer) return;
    if (sound) beep("shuffle");
    setDeck((cards) => shuffleWordDeckTail(cards, Math.max(0, at + 1)));
  };

  const previous = () => {
    if (observer || at <= 0) return;
    setAt((value) => value - 1);
    setFaceUp(true);
    setExpired(false);
    if (settings.timerMode === "CARD") setTime(settings.cardSeconds);
  };

  const reset = () => {
    if (observer) return;
    setDeck(buildWordDeck(activity.cards, settings));
    setAt(-1);
    setFaceUp(false);
    setExpired(false);
    setTime(settings.timerMode === "GAME" ? settings.gameSeconds : settings.cardSeconds);
  };

  const background =
    settings.background === "CUSTOM" && activity.backgroundImageUrl
      ? `linear-gradient(rgba(5,10,24,.38),rgba(5,10,24,.56)),url(${JSON.stringify(activity.backgroundImageUrl)}) center/cover`
      : backgrounds[settings.background === "CUSTOM" ? "MIDNIGHT" : settings.background];

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[1.75rem] text-white shadow-2xl ring-1 ring-white/10",
        compact ? "min-h-[28rem] p-4 sm:p-6" : "min-h-[36rem] p-5 sm:p-8",
      )}
      style={{ background }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-white/55">
            {t.wordDeck.eyebrow}
          </p>
          <h3 className="truncate text-xl font-black sm:text-2xl">{activity.title}</h3>
        </div>
        {settings.timerMode !== "NONE" && (
          <span className={cn(
            "rounded-full border px-3 py-1.5 font-mono text-sm font-black backdrop-blur",
            expired ? "border-rose-300/50 bg-rose-500/25" : "border-white/15 bg-black/20",
          )}>
            {Math.floor(time / 60).toString().padStart(2, "0")}:{(time % 60).toString().padStart(2, "0")}
          </span>
        )}
        {!observer && (
          <button
            type="button"
            onClick={() => setSound((value) => !value)}
            className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur transition hover:bg-white/15"
          >
            {sound ? `🔊 ${t.wordDeck.soundOn}` : `🔇 ${t.wordDeck.soundOff}`}
          </button>
        )}
      </div>

      <div className="relative mx-auto mt-7 flex min-h-[18rem] max-w-xl items-center justify-center sm:min-h-[23rem]">
        {!started ? (
          <button type="button" onClick={deal} disabled={observer} className="group relative h-60 w-44 disabled:cursor-default sm:h-72 sm:w-52">
            {[2, 1, 0].map((layer) => (
              <span
                key={layer}
                className="absolute inset-0 rounded-[1.6rem] border border-white/25 bg-gradient-to-br from-white/24 to-white/8 shadow-2xl backdrop-blur-md transition duration-300 group-hover:-translate-y-2"
                style={{ transform: `translate(${layer * 6}px,${layer * -7}px) rotate(${layer * 1.5}deg)` }}
              />
            ))}
            <span className="absolute inset-0 flex flex-col items-center justify-center rounded-[1.6rem] border border-white/30 bg-black/15 p-5 shadow-2xl backdrop-blur-md">
              <span className="text-5xl">♠</span>
              <span className="mt-5 text-sm font-black uppercase tracking-[.18em]">{t.wordDeck.tapDeck}</span>
              <span className="mt-2 text-xs text-white/60">{deck.length} {t.wordDeck.cardsShort}</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={deal}
            disabled={!canDeal}
            className="word-deck-card h-60 w-full max-w-[23rem] [perspective:1200px] disabled:cursor-default sm:h-72"
          >
            <span className={cn(
              "relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
              faceUp && "[transform:rotateY(180deg)]",
            )}>
              <span className="absolute inset-0 flex items-center justify-center rounded-[1.75rem] border border-white/25 bg-gradient-to-br from-white/22 to-black/10 shadow-2xl backdrop-blur-xl [backface-visibility:hidden]">
                <span className="text-6xl">♠</span>
              </span>
              <span className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center rounded-[1.75rem] bg-[#fffdf7] p-6 text-slate-950 shadow-2xl [backface-visibility:hidden]">
                {current?.owner && (
                  <span className={cn(
                    "absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide",
                    current.owner === "STUDENT" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800",
                  )}>
                    {current.owner === "STUDENT" ? t.wordDeck.forStudent : t.wordDeck.forTeacher}
                  </span>
                )}
                {settings.showIcons && current?.icon && (
                  <span className="mb-3 text-5xl leading-none sm:text-6xl" aria-hidden>
                    {current.icon}
                  </span>
                )}
                <span className="max-w-full break-words text-center text-3xl font-black leading-tight sm:text-5xl">
                  {current?.word}
                </span>
                <span className="absolute bottom-4 text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">
                  {at + 1} / {deck.length}
                </span>
              </span>
            </span>
          </button>
        )}
        {expired && (
          <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-slate-950/70 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-3xl font-black">{t.wordDeck.timeUp}</p>
              {!observer && (
                <button type="button" onClick={finished ? reset : deal} className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-slate-950">
                  {finished ? t.wordDeck.again : t.wordDeck.deal}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!observer && <div className="mt-5 grid grid-cols-3 gap-2">
        <button type="button" onClick={previous} disabled={at <= 0} className="rounded-xl border border-white/15 bg-black/20 px-2 py-3 text-xs font-black backdrop-blur transition hover:bg-white/15 disabled:opacity-35">
          ↶ {t.wordDeck.previous}
        </button>
        <button type="button" onClick={shuffle} disabled={deck.length < 2} className="rounded-xl border border-white/15 bg-black/20 px-2 py-3 text-xs font-black backdrop-blur transition hover:bg-white/15 disabled:opacity-35">
          ⇄ {t.wordDeck.shuffle}
        </button>
        <button type="button" onClick={finished ? reset : deal} disabled={!finished && !canDeal} className="rounded-xl bg-white px-2 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:scale-[1.02] disabled:opacity-40">
          {finished ? `↻ ${t.wordDeck.again}` : `➜ ${t.wordDeck.deal}`}
        </button>
      </div>}
    </section>
  );
}
