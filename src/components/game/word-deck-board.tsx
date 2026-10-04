"use client";

import Image from "next/image";
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
  saveWordDeckHomeworkStateAction,
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

function readEnglish(text: string, variant: "US" | "UK" = "US") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const clean = text.trim();
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = variant === "UK" ? "en-GB" : "en-US";
  utterance.rate = 0.92;
  const voice = window.speechSynthesis
    .getVoices()
    .find((candidate) => candidate.lang.toLowerCase().startsWith(variant === "UK" ? "en-gb" : "en-us"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function WordDeckBoard({ activity, compact = false, live = false, observer = false, homework = false }: {
  activity: WordDeckPlayable;
  compact?: boolean;
  /** Публиковать действия учителя в живой класс. */
  live?: boolean;
  /** Ученик видит общий стол, но не может им управлять. */
  observer?: boolean;
  /** Student owns controls and progress is saved into the assigned homework snapshot. */
  homework?: boolean;
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
  const [readDescriptions, setReadDescriptions] = useState(saved?.readDescriptions ?? false);
  const [verdict, setVerdict] = useState(saved?.verdict ?? null);
  const [feedback, setFeedback] = useState(saved?.feedback ?? null);
  const started = at >= 0;
  const descriptionGame = settings.gameType === "GUESS_DESCRIPTION";
  const spellingGame = settings.gameType === "SPELLING";
  const pictureGame = settings.gameType === "GUESS_PICTURE";
  const finished = at >= deck.length - 1 && started && ((!descriptionGame && !pictureGame) || faceUp);
  const canDeal = canDealNextWordDeckCard({
    cardCount: deck.length,
    at,
    expired,
    observer,
  });
  const current = deck[at] ?? null;
  const flipTimer = useRef<number | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const spokenCard = useRef("");
  const lastRemoteAt = useRef(saved?.updatedAt ?? "");
  const publishQueue = useRef(Promise.resolve());

  const deal = useCallback(() => {
    if (!canDeal) return;
    if (sound) beep("deal");
    setFaceUp(spellingGame);
    setExpired(false);
    setVerdict(null);
    setFeedback(null);
    setAt((value) => value + 1);
    if (settings.timerMode === "CARD") setTime(settings.cardSeconds);
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    if (!descriptionGame && !spellingGame && !pictureGame) {
      flipTimer.current = window.setTimeout(() => setFaceUp(true), 260);
    }
  }, [canDeal, descriptionGame, pictureGame, settings.cardSeconds, settings.timerMode, sound, spellingGame]);

  useEffect(() => () => {
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (
      observer || !started || expired || settings.timerMode === "NONE" || time <= 0 ||
      (verdict && settings.timerMode === "CARD")
    ) return;
    const timer = window.setTimeout(() => {
      setTime((value) => Math.max(0, value - 1));
      if (time <= 1) {
        setExpired(true);
        if (descriptionGame) setFeedback("TIME_UP");
        if (pictureGame) setFaceUp(true);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [descriptionGame, expired, observer, pictureGame, settings.timerMode, started, time, verdict]);

  useEffect(() => {
    if (!feedback) return;
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(
      () => setFeedback(null),
      feedback === "TIME_UP" ? 2800 : 2300,
    );
    return () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    };
  }, [feedback]);

  useEffect(() => {
    if (!readDescriptions) {
      spokenCard.current = "";
      return;
    }
    if (!descriptionGame || !started || !current?.description) return;
    if (spokenCard.current === current.instanceId) return;
    spokenCard.current = current.instanceId;
    readEnglish(current.description);
  }, [current?.description, current?.instanceId, descriptionGame, readDescriptions, started]);

  useEffect(() => {
    if (!spellingGame || !started || !current?.word) return;
    if (!settings.autoPronounce && !settings.autoPronounceUk) return;
    const timer = window.setTimeout(() => {
      if (settings.autoPronounceUk) readEnglish(current.word, "UK");
      else if (settings.autoPronounce && settings.allowUsAudio) readEnglish(current.word, "US");
    }, 140);
    return () => window.clearTimeout(timer);
  }, [current?.instanceId, current?.word, settings.allowUsAudio, settings.autoPronounce, settings.autoPronounceUk, spellingGame, started]);

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
        setReadDescriptions(state.readDescriptions);
        setVerdict(state.verdict);
        setFeedback(state.feedback);
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
      readDescriptions,
      verdict,
      feedback,
      updatedAt: new Date().toISOString(),
    };
    const timer = window.setTimeout(() => {
      publishQueue.current = publishQueue.current.then(async () => {
        await saveClassWordDeckLiveStateAction(activity.id, state);
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activity.id, at, deck, expired, faceUp, feedback, live, observer, readDescriptions, sound, time, verdict]);

  useEffect(() => {
    if (!homework || observer) return;
    const state: WordDeckLiveState = {
      deck, at, faceUp, sound, time, expired, readDescriptions, verdict, feedback,
      updatedAt: new Date().toISOString(),
    };
    const timer = window.setTimeout(() => {
      publishQueue.current = publishQueue.current.then(async () => {
        await saveWordDeckHomeworkStateAction(activity.id, state);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activity.id, at, deck, expired, faceUp, feedback, homework, observer, readDescriptions, sound, time, verdict]);

  const shuffle = () => {
    if (observer) return;
    if (sound) beep("shuffle");
    setDeck((cards) => shuffleWordDeckTail(cards, Math.max(0, at + 1)));
  };

  const previous = () => {
    if (observer || at <= 0) return;
    setAt((value) => value - 1);
    setFaceUp(!descriptionGame && !pictureGame);
    setExpired(false);
    setVerdict(null);
    setFeedback(null);
    if (settings.timerMode === "CARD") setTime(settings.cardSeconds);
  };

  const reset = () => {
    if (observer) return;
    setDeck(buildWordDeck(activity.cards, settings));
    setAt(-1);
    setFaceUp(false);
    setExpired(false);
    setVerdict(null);
    setFeedback(null);
    setTime(settings.timerMode === "GAME" ? settings.gameSeconds : settings.cardSeconds);
  };

  const judge = (next: "RIGHT" | "WRONG", reveal: boolean) => {
    if (observer || !descriptionGame || !started || faceUp || verdict) return;
    setVerdict(next);
    setFeedback(next);
    if (reveal) setFaceUp(true);
  };

  const showAnswer = () => {
    if (observer || (!descriptionGame && !pictureGame) || !started) return;
    setFaceUp(true);
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
        feedback === "WRONG" && "word-deck-shake",
      )}
      style={{ background }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-white/55">
            {spellingGame ? t.wordDeck.spellingEyebrow : t.wordDeck.eyebrow}
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
          <div className="flex flex-wrap items-center gap-2">
            {descriptionGame && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur transition hover:bg-white/15">
                <input
                  type="checkbox"
                  checked={readDescriptions}
                  onChange={(event) => setReadDescriptions(event.target.checked)}
                  className="h-3.5 w-3.5 accent-white"
                />
                🔊 {t.wordDeck.readDescriptions}
              </label>
            )}
            <button
              type="button"
              onClick={() => setSound((value) => !value)}
              className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur transition hover:bg-white/15"
            >
              {sound ? `🔊 ${t.wordDeck.soundOn}` : `🔇 ${t.wordDeck.soundOff}`}
            </button>
          </div>
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
              <span className="text-5xl">{spellingGame ? "🔤" : "♠"}</span>
              <span className="mt-5 text-sm font-black uppercase tracking-[.18em]">{t.wordDeck.tapDeck}</span>
              <span className="mt-2 text-xs text-white/60">{deck.length} {t.wordDeck.cardsShort}</span>
            </span>
          </button>
        ) : (
          <button
            key={current?.instanceId}
            type="button"
            onClick={pictureGame ? showAnswer : descriptionGame ? undefined : deal}
            disabled={descriptionGame || (pictureGame ? faceUp : !canDeal)}
            className="word-deck-card word-deck-deal-in h-60 w-full max-w-[23rem] [perspective:1200px] disabled:cursor-default sm:h-72"
          >
            <span className={cn(
              "relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
              faceUp && "[transform:rotateY(180deg)]",
            )}>
              <span className={cn(
                "absolute inset-0 flex flex-col items-center justify-center rounded-[1.75rem] border shadow-2xl [backface-visibility:hidden]",
                descriptionGame || pictureGame
                  ? "border-slate-200 bg-[#fffdf7] px-6 pb-12 pt-14 text-slate-950"
                  : "border-white/25 bg-gradient-to-br from-white/22 to-black/10 backdrop-blur-xl",
              )}>
                {descriptionGame ? (
                  <>
                    {current?.owner && (
                      <span className={cn(
                        "absolute right-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide",
                        current.owner === "STUDENT" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800",
                      )}>
                        {current.owner === "STUDENT" ? t.wordDeck.forStudent : t.wordDeck.forTeacher}
                      </span>
                    )}
                    {settings.descriptionIcons && current?.icon && (
                      <span className="mb-2 text-4xl leading-none sm:text-5xl" aria-hidden>{current.icon}</span>
                    )}
                    <span className="max-h-full max-w-full overflow-y-auto break-words text-center text-lg font-bold leading-relaxed sm:text-2xl">
                      {current?.description}
                    </span>
                    <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">
                      {at + 1} / {deck.length}
                    </span>
                  </>
                ) : pictureGame ? (
                  <>
                    {(current?.promptFace ?? (settings.guessMode === "TRANSLATION" ? "TRANSLATION" : "PICTURE")) === "TRANSLATION" ? (
                      <span className="max-h-full max-w-full overflow-y-auto break-words text-center text-3xl font-black leading-tight sm:text-5xl">{current?.translation}</span>
                    ) : current?.imageUrl ? (
                      <Image src={current.imageUrl} alt="" fill sizes="(max-width: 640px) 90vw, 23rem" unoptimized className="object-contain p-4" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">{t.wordDeck.noPicture}</span>
                    )}
                    <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">{at + 1} / {deck.length}</span>
                  </>
                ) : (
                  <span className="text-6xl">♠</span>
                )}
              </span>
              <span className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center rounded-[1.75rem] bg-[#fffdf7] px-6 pb-12 pt-14 text-slate-950 shadow-2xl [backface-visibility:hidden]">
                {current?.owner && (
                  <span className={cn(
                    "absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide",
                    current.owner === "STUDENT" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800",
                  )}>
                    {current.owner === "STUDENT" ? t.wordDeck.forStudent : t.wordDeck.forTeacher}
                  </span>
                )}
                {(descriptionGame ? settings.answerIcons : (settings.showIcons || spellingGame)) && current?.icon && (
                  <span className="mb-3 text-5xl leading-none sm:text-6xl" aria-hidden>
                    {current.icon}
                  </span>
                )}
                <span className="max-h-full max-w-full overflow-y-auto break-words text-center text-3xl font-black leading-tight sm:text-5xl">
                  {current?.word}
                </span>
                {spellingGame && (
                  <div className="mt-3 max-h-24 w-full overflow-y-auto text-center">
                    {(current?.transcriptionUs || current?.transcriptionUk) && (
                      <p className="text-xs font-bold text-slate-400">
                        {current.transcriptionUs ? `US ${current.transcriptionUs}` : ""}
                        {current.transcriptionUs && current.transcriptionUk ? " · " : ""}
                        {current.transcriptionUk ? `UK ${current.transcriptionUk}` : ""}
                      </p>
                    )}
                    {settings.showTips && current?.translation && <p className="mt-1 text-sm font-bold text-emerald-700">{current.translation}</p>}
                    {settings.showTips && current?.tip && <p className="mt-1 text-[11px] font-semibold text-slate-500">💡 {current.tip}</p>}
                    {settings.showTips && current?.examples?.[0] && <p className="mt-1 text-[10px] text-slate-500">{current.examples[0].en}</p>}
                  </div>
                )}
                <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">
                  {at + 1} / {deck.length}
                </span>
              </span>
            </span>
          </button>
        )}
        {expired && !descriptionGame && !pictureGame && (
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
        {descriptionGame && feedback && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            {feedback === "RIGHT" ? (
              <div className="word-deck-correct text-center drop-shadow-2xl">
                <div className="text-7xl sm:text-8xl">😄</div>
                <p className="mt-2 text-4xl font-black uppercase tracking-wide text-emerald-300 sm:text-5xl">
                  {t.wordDeck.correct}
                </p>
              </div>
            ) : (
              <p className={cn(
                "word-deck-verdict rounded-2xl border px-5 py-3 text-center text-4xl font-black uppercase tracking-wide shadow-2xl backdrop-blur-sm sm:text-6xl",
                feedback === "WRONG"
                  ? "border-rose-300/50 bg-rose-600/85 text-white"
                  : "border-amber-200/50 bg-slate-950/80 text-amber-300",
              )}>
                {feedback === "WRONG" ? t.wordDeck.wrong : t.wordDeck.timeUp}
              </p>
            )}
          </div>
        )}
      </div>

      {spellingGame && started && current && (
        <div className="mx-auto mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2">
          {settings.allowUsAudio && (
            <button type="button" onClick={() => readEnglish(current.word, "US")} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white/20">
              🔊 US {t.wordDeck.listenAgain}
            </button>
          )}
          {settings.allowUkAudio && (
            <button type="button" onClick={() => readEnglish(current.word, "UK")} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white/20">
              🔊 UK {t.wordDeck.listenAgain}
            </button>
          )}
        </div>
      )}

      {pictureGame && started && !faceUp && !observer && (
        <button type="button" onClick={showAnswer} className="mx-auto mt-3 block rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20">
          {t.wordDeck.openAnswer}
        </button>
      )}

      {!observer && descriptionGame && started && (
        <div className="mt-4 grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
          <button
            type="button"
            disabled={faceUp || expired || !!verdict}
            onClick={() => judge("RIGHT", true)}
            className="rounded-xl bg-emerald-500 px-3 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-emerald-400 disabled:opacity-35"
          >
            ✓ {t.wordDeck.correct}
          </button>
          <button
            type="button"
            disabled={faceUp || expired || !!verdict}
            onClick={() => judge("WRONG", false)}
            className="rounded-xl bg-rose-600 px-3 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-35"
          >
            × {t.wordDeck.wrong}
          </button>
          <button
            type="button"
            disabled={faceUp || expired || !!verdict}
            onClick={() => judge("WRONG", true)}
            className="rounded-xl border border-rose-300/40 bg-rose-950/55 px-3 py-3 text-xs font-black uppercase tracking-wide text-rose-100 backdrop-blur transition hover:bg-rose-900/70 disabled:opacity-35"
          >
            × {t.wordDeck.wrongOpen}
          </button>
        </div>
      )}

      {!observer && descriptionGame && started && !faceUp && (expired || !!verdict) && (
        <button
          type="button"
          onClick={showAnswer}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20"
        >
          {t.wordDeck.openAnswer}
        </button>
      )}

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
