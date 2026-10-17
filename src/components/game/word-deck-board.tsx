"use client";

import Image from "next/image";
import { LearningTranslationNotice } from "@/components/learning-translation-notice";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import {
  buildWordDeck,
  canDealNextWordDeckCard,
  isWordDeckDescriptionGame,
  isWordDeckFinished,
  normalizeWordDeckLiveState,
  normalizeWordDeckSettings,
  remainingWordDeckSeconds,
  restartWordDeckTimer,
  startWordDeckSentence,
  wordDeckTimerPaused,
  wordDeckTimerSeconds,
  shuffleWordDeckTail,
  type WordDeckLiveState,
  type WordDeckPhase,
  type WordDeckSettings,
  type WordDeckSourceCard,
} from "@/lib/word-deck";
import {
  saveClassWordDeckLiveStateAction,
  saveWordDeckHomeworkStateAction,
} from "@/lib/actions/word-deck";
import { cn } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { readClassLive } from "@/lib/class-live-request";
import { wordDeckTextSize } from "@/lib/word-deck-display";
import { TENSE_NAMES, tenseCorrectionExplanation } from "@/lib/tense-correction-settings";
import { WORD_DECK_SKINS } from "@/lib/word-deck-skins";
import { WordDeckScoreboard, wordDeckScoreCopy } from "./word-deck-scoreboard";

export type WordDeckPlayable = {
  translationWarning?: boolean;
  id: string;
  title: string;
  cards: WordDeckSourceCard[];
  settings: WordDeckSettings;
  backgroundImageUrl: string | null;
  liveState?: WordDeckLiveState | null;
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

function privateTeacherExamples(card: WordDeckSourceCard) {
  const word = card.word.trim();
  const stored = (card.examples ?? [])
    .map((example) => example.en.trim())
    .filter(Boolean);
  const fallbacks = [
    `I came across “${word}” today.`,
    `We discussed “${word}” during the lesson.`,
    `Can you use “${word}” in a different context?`,
  ];
  return [...new Set([...stored, ...fallbacks])].slice(0, 3);
}

export function WordDeckBoard({
  activity,
  compact = false,
  live = false,
  observer = false,
  realtimeChannel = null,
  homework = false,
  teacherSeesAnswers = false,
  timerControls = false,
  reviewEditor,
}: {
  activity: WordDeckPlayable;
  compact?: boolean;
  /** Публиковать действия учителя в живой класс. */
  live?: boolean;
  /** Ученик видит общий стол, но не может им управлять. */
  observer?: boolean;
  realtimeChannel?: string | null;
  /** Student owns controls and progress is saved into the assigned homework snapshot. */
  homework?: boolean;
  /** Private teacher-only answer/example rail. Never pass this in an observer/student view. */
  teacherSeesAnswers?: boolean;
  /** Teacher-only timer controls. Students keep their existing game controls. */
  timerControls?: boolean;
  /** Teacher's overall grade is available before the last card too. */
  reviewEditor?: ReactNode;
}) {
  const { t, locale } = useT();
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
  const [phase, setPhase] = useState<WordDeckPhase>(saved?.phase ?? "GUESS");
  const [sound, setSound] = useState(saved?.sound ?? settings.sound);
  const [time, setTime] = useState(
    saved ? (homework ? saved.time : remainingWordDeckSeconds(saved, settings)) : wordDeckTimerSeconds(settings),
  );
  const [expired, setExpired] = useState(saved?.expired ?? false);
  const [timerPaused, setTimerPaused] = useState(saved ? wordDeckTimerPaused(saved, settings) : false);
  const [timerVersion, setTimerVersion] = useState(0);
  const [readDescriptions, setReadDescriptions] = useState(saved?.readDescriptions ?? false);
  const [verdict, setVerdict] = useState(saved?.verdict ?? null);
  const [feedback, setFeedback] = useState(saved?.feedback ?? null);
  const [ratings, setRatings] = useState(saved?.ratings ?? {});
  const [showScores, setShowScores] = useState(saved?.showScores ?? false);
  const scoreLabels = wordDeckScoreCopy[locale];
  const canRateCards = settings.alternate && (live || timerControls) && !observer && !homework;
  const started = at >= 0;
  const canControlTimer = timerControls && !observer && !homework && settings.timerMode !== "NONE";
  const descriptionGame = isWordDeckDescriptionGame(settings.gameType);
  const combinedGame = settings.gameType === "DESCRIPTION_SENTENCE";
  const correctionGame = settings.gameType === "TENSE_CORRECTION";
  const spellingGame = settings.gameType === "SPELLING";
  const pictureGame = settings.gameType === "GUESS_PICTURE";
  const finished = isWordDeckFinished({ deck, at, faceUp, phase }, settings);
  const canDeal = canDealNextWordDeckCard({
    cardCount: deck.length,
    at,
    expired,
    observer,
    gameType: settings.gameType,
    phase,
  });
  const current = deck[at] ?? null;
  const flipTimer = useRef<number | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const spokenCard = useRef("");
  const lastRemoteAt = useRef(saved?.updatedAt ?? "");
  const publishQueue = useRef(Promise.resolve());

  useEffect(() => {
    const translations = new Map(activity.cards.map(card => [card.phraseId, card.translation]));
    let alive = true;
    void Promise.resolve().then(() => { if (alive) setDeck(current => {
      let changed = false;
      const next = current.map(card => {
        if (!translations.has(card.phraseId) || translations.get(card.phraseId) === card.translation) return card;
        changed = true;
        return { ...card, translation: translations.get(card.phraseId) ?? null };
      });
      return changed ? next : current;
    }); });
    return () => { alive = false; };
  }, [activity.cards]);

  const deal = useCallback(() => {
    if (!canDeal) return;
    if (sound) beep("deal");
    setFaceUp(spellingGame);
    setPhase("GUESS");
    setExpired(false);
    setVerdict(null);
    setFeedback(null);
    setAt((value) => value + 1);
    if (settings.timerMode === "CARD") {
      setTime(wordDeckTimerSeconds(settings));
      setTimerPaused(false);
      setTimerVersion((value) => value + 1);
    }
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    if (!descriptionGame && !spellingGame && !pictureGame) {
      flipTimer.current = window.setTimeout(() => setFaceUp(true), 260);
    }
  }, [canDeal, descriptionGame, pictureGame, settings, sound, spellingGame]);

  useEffect(() => () => {
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!started || (combinedGame && finished) || expired || timerPaused || settings.timerMode === "NONE" || time > 0) return;
    const frame = requestAnimationFrame(() => {
      setExpired(true);
      if (descriptionGame) setFeedback("TIME_UP");
    });
    return () => cancelAnimationFrame(frame);
  }, [combinedGame, descriptionGame, expired, finished, pictureGame, settings.timerMode, started, time, timerPaused]);

  useEffect(() => {
    if (
      !started || (combinedGame && finished) || expired || timerPaused || settings.timerMode === "NONE" || time <= 0
    ) return;
    const timer = window.setTimeout(() => {
      setTime((value) => Math.max(0, value - 1));
      if (time <= 1) {
        setExpired(true);
        if (descriptionGame) setFeedback("TIME_UP");
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [combinedGame, descriptionGame, expired, finished, observer, pictureGame, settings.timerMode, started, time, timerPaused, timerVersion]);

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
    if (!descriptionGame || faceUp || !started || !current?.description) return;
    if (spokenCard.current === current.instanceId) return;
    spokenCard.current = current.instanceId;
    readEnglish(current.description);
  }, [current?.description, current?.instanceId, descriptionGame, faceUp, readDescriptions, started]);

  useEffect(() => {
    if (!spellingGame || !started || !current?.word) return;
    if (!settings.autoPronounce && !settings.autoPronounceUk) return;
    const timer = window.setTimeout(() => {
      if (settings.autoPronounceUk) readEnglish(current.word, "UK");
      else if (settings.autoPronounce && settings.allowUsAudio) readEnglish(current.word, "US");
    }, 140);
    return () => window.clearTimeout(timer);
  }, [current?.instanceId, current?.word, settings.allowUsAudio, settings.autoPronounce, settings.autoPronounceUk, spellingGame, started]);

  const applyRemoteState = useCallback((state: WordDeckLiveState | null) => {
    if (!state || state.updatedAt === lastRemoteAt.current) return;
    lastRemoteAt.current = state.updatedAt;
    setDeck(state.deck);
    setAt(state.at);
    setFaceUp(state.faceUp);
    setPhase(state.phase ?? "GUESS");
    setSound(state.sound);
    setTime(remainingWordDeckSeconds(state, settings));
    setExpired(state.expired);
    setTimerPaused(wordDeckTimerPaused(state, settings));
    setReadDescriptions(state.readDescriptions);
    setVerdict(state.verdict);
    setFeedback(state.feedback);
    setRatings(state.ratings ?? {});
    setShowScores(state.showScores ?? false);
  }, [settings]);

  const pullRemoteState = useCallback(async () => {
    if (!observer) return;
    applyRemoteState(await readClassLive("deck", activity.id));
  }, [activity.id, applyRemoteState, observer]);

  useEffect(() => {
    if (observer) void pullRemoteState().catch(() => {});
  }, [observer, pullRemoteState]);

  useRealtimeSubscription({
    channel: observer ? realtimeChannel : null,
    events: "word-deck",
    onMessage: (message) => {
      const data = message.data as { gameId?: string; state?: WordDeckLiveState } | undefined;
      if (data?.gameId !== activity.id) return;
      applyRemoteState(data.state ?? null);
    },
    onFallback: pullRemoteState,
    // Card dealing is the most visible shared-class interaction. Keep the
    // observer close to the teacher even during a realtime outage.
    fallbackMs: 500,
    enabled: observer,
  });

  const captureState = useEffectEvent((): WordDeckLiveState => ({
      deck,
      at,
      faceUp,
      phase,
      sound,
      time,
      expired,
      timerPaused,
      readDescriptions,
      verdict,
      feedback,
      ratings,
      showScores,
      updatedAt: new Date().toISOString(),
    }));

  useEffect(() => {
    if (!live || observer) return;
    const timer = window.setTimeout(() => {
      const state = captureState();
      publishQueue.current = publishQueue.current.catch(() => {}).then(async () => {
        await saveClassWordDeckLiveStateAction(activity.id, state);
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activity.id, at, deck, expired, faceUp, feedback, live, observer, phase, ratings, showScores, readDescriptions, sound, timerPaused, timerVersion, verdict]);

  useEffect(() => {
    if (!homework || observer) return;
    const timer = window.setTimeout(() => {
      const state = captureState();
      publishQueue.current = publishQueue.current.catch(() => {}).then(async () => {
        await saveWordDeckHomeworkStateAction(activity.id, state);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activity.id, at, deck, expired, faceUp, feedback, homework, observer, phase, ratings, showScores, readDescriptions, sound, time, timerPaused, verdict]);

  const shuffle = () => {
    if (observer) return;
    if (sound) beep("shuffle");
    setDeck((cards) => shuffleWordDeckTail(cards, Math.max(0, at + 1)));
  };

  const previous = () => {
    if (observer || at <= 0) return;
    setAt((value) => value - 1);
    setFaceUp(!descriptionGame && !pictureGame);
    setPhase("GUESS");
    setExpired(false);
    setVerdict(null);
    setFeedback(null);
    if (settings.timerMode === "CARD") {
      setTime(wordDeckTimerSeconds(settings));
      setTimerPaused(false);
      setTimerVersion((value) => value + 1);
    }
  };

  const reset = () => {
    if (observer) return;
    setDeck(buildWordDeck(activity.cards, settings));
    setAt(-1);
    setFaceUp(false);
    setPhase("GUESS");
    setExpired(false);
    setTimerPaused(false);
    setVerdict(null);
    setFeedback(null);
    setTime(wordDeckTimerSeconds(settings));
    setRatings({});
    setShowScores(false);
  };

  const toggleTimerPause = () => {
    if (combinedGame && finished) return;
    if (!canControlTimer || !started || expired || time <= 0) return;
    setTimerPaused((value) => !value);
  };

  const restartTimer = () => {
    if (!canControlTimer || !started) return;
    if (combinedGame && finished) return;
    const next = restartWordDeckTimer({ feedback, phase }, settings);
    setTime(next.time);
    setExpired(next.expired);
    setTimerPaused(next.timerPaused);
    setFeedback(next.feedback);
    // Publish a restart even if time and pause already equal their initial values.
    setTimerVersion((value) => value + 1);
  };

  const revealSentence = () => {
    const next = startWordDeckSentence({ time, expired, timerPaused, feedback }, settings);
    setPhase(next.phase);
    setFaceUp(next.faceUp);
    setTime(next.time);
    setExpired(next.expired);
    setTimerPaused(next.timerPaused ?? false);
    setFeedback(next.feedback);
    setTimerVersion((value) => value + 1);
  };

  const finishSentence = () => {
    if (observer || !combinedGame || phase !== "SENTENCE") return;
    if (canDeal) deal();
    else {
      setPhase("COMPLETE");
      setTimerPaused(true);
      setFeedback(null);
    }
  };

  const rateCard = (next: "RIGHT" | "WRONG") => {
    if (!canRateCards || !current) return;
    setRatings(previous => ({ ...previous, [current.instanceId]: next }));
  };

  const judge = (next: "RIGHT" | "WRONG", reveal: boolean) => {
    if (observer || !descriptionGame || !started || faceUp || verdict) return;
    rateCard(next);
    setVerdict(next);
    if (settings.timerMode === "CARD") setTimerPaused(true);
    setFeedback(next);
    if (reveal) {
      if (combinedGame) revealSentence();
      else setFaceUp(true);
    }
  };

  const showAnswer = () => {
    if (observer || (!descriptionGame && !pictureGame) || !started) return;
    if (correctionGame && settings.timerMode === "CARD") setTimerPaused(true);
    if (combinedGame && phase === "GUESS") revealSentence();
    else setFaceUp(true);
  };

  const skin = WORD_DECK_SKINS[settings.background === "CUSTOM" ? "MIDNIGHT" : settings.background];
  const background =
    settings.background === "CUSTOM" && activity.backgroundImageUrl
      ? `linear-gradient(rgba(5,10,24,.38),rgba(5,10,24,.56)),url(${JSON.stringify(activity.backgroundImageUrl)}) center/cover`
      : skin.background;
  const skinStyle = { background, "--deck-card": skin.card, "--deck-back": skin.back, "--deck-ink": skin.ink, "--deck-accent": skin.accent } as CSSProperties;

  return (
    <section
      className={cn(
        "relative isolate min-w-0 w-full overflow-hidden rounded-[1.75rem] text-white shadow-2xl ring-1 ring-white/10",
        compact ? "min-h-[28rem] p-4 sm:p-6" : "min-h-[36rem] p-5 sm:p-8",
        feedback === "WRONG" && "word-deck-shake",
        skin.card && "word-deck-themed",
      )}
      style={skinStyle}
      data-word-deck-skin={settings.background}
    >
      <LearningTranslationNotice show={activity.translationWarning} />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      {skin.card && <div aria-hidden="true" className="word-deck-skin-art pointer-events-none absolute inset-0 -z-10 overflow-hidden"><span>{skin.icon}</span><span>{skin.icon}</span></div>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-white/55">
            {correctionGame ? t.tenseCorrection.title : spellingGame ? t.wordDeck.spellingEyebrow : t.wordDeck.eyebrow}
          </p>
          <h3 className="truncate text-xl font-black sm:text-2xl">{activity.title}</h3>
        </div>
        {settings.timerMode !== "NONE" && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <span data-word-deck-clock className={cn(
            "rounded-full border px-3 py-1.5 font-mono text-sm font-black backdrop-blur",
            expired ? "border-rose-300/50 bg-rose-500/25" : "border-white/15 bg-black/20",
          )}>
            {Math.floor(time / 60).toString().padStart(2, "0")}:{(time % 60).toString().padStart(2, "0")}
          </span>
          <span role="status" aria-live="polite" className="text-xs font-bold text-white/85">
            {!expired && timerPaused ? t.wordDeck.timerPaused : ""}
          </span>
          {canControlTimer && <>
            <button type="button" onClick={toggleTimerPause} disabled={!started || (combinedGame && finished) || expired || time <= 0}
              aria-label={timerPaused ? t.wordDeck.resumeTimer : t.wordDeck.pauseTimer}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-bold transition hover:bg-white/15 disabled:opacity-35">
              {timerPaused ? `▶ ${t.wordDeck.resumeTimer}` : `Ⅱ ${t.wordDeck.pauseTimer}`}
            </button>
            <button type="button" onClick={restartTimer} disabled={!started || (combinedGame && finished)} aria-label={t.wordDeck.restartTimer}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-bold transition hover:bg-white/15 disabled:opacity-35">
              ↻ {t.wordDeck.restartTimer}
            </button>
          </>}
          </div>
        )}
        {!observer && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {descriptionGame && (
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur transition hover:bg-white/15">
                <input
                  type="checkbox"
                  checked={readDescriptions}
                  onChange={(event) => setReadDescriptions(event.target.checked)}
                  className="h-3.5 w-3.5 accent-white"
                />
                🔊 {correctionGame ? t.tenseCorrection.readSentences : t.wordDeck.readDescriptions}
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

      {settings.timerMode !== "NONE" && <div className="mt-3 flex min-h-14 items-center justify-center" data-word-deck-time-notice>
        {expired && <div key={`${current?.instanceId}:${phase}:${timerVersion}`} role="status" aria-live="assertive" aria-label={t.wordDeck.timeUp} className="word-deck-time-stamp pointer-events-none inline-flex items-center gap-3 rounded-lg border-[3px] border-double border-amber-200 bg-amber-100 px-5 py-1.5 text-xl font-black uppercase tracking-[.12em] text-amber-950 shadow-lg sm:text-2xl"><span aria-hidden="true">⌛</span>Time is up</div>}
      </div>}

      <div className={cn(
        "relative mx-auto mt-3 flex items-center justify-center",
        spellingGame
          ? "min-h-[25rem] max-w-3xl sm:min-h-[29rem]"
          : "min-h-[18rem] max-w-xl sm:min-h-[23rem]",
      )}>
        {!started ? (
          <button type="button" onClick={deal} disabled={observer} className="group relative h-60 w-44 disabled:cursor-default sm:h-72 sm:w-52">
            {[2, 1, 0].map((layer) => (
              <span
                key={layer}
                className="word-deck-stack absolute inset-0 rounded-[1.6rem] border border-white/25 bg-gradient-to-br from-white/24 to-white/8 shadow-2xl backdrop-blur-md transition duration-300 group-hover:-translate-y-2"
                style={{ transform: `translate(${layer * 6}px,${layer * -7}px) rotate(${layer * 1.5}deg)` }}
              />
            ))}
            <span className="word-deck-cover absolute inset-0 flex flex-col items-center justify-center rounded-[1.6rem] border border-white/30 bg-black/15 p-5 shadow-2xl backdrop-blur-md">
              <span className="text-5xl">{skin.card ? skin.icon : spellingGame ? "🔤" : "♠"}</span>
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
            className={cn(
              "word-deck-card word-deck-deal-in w-full [perspective:1200px] disabled:cursor-default",
              spellingGame
                ? "min-h-[24rem] max-w-3xl sm:min-h-[27rem]"
                : "min-h-60 max-w-xl sm:min-h-72",
            )}
          >
            <span className={cn(
              "relative grid min-h-[inherit] w-full transition-transform duration-500 [transform-style:preserve-3d]",
              faceUp && "[transform:rotateY(180deg)]",
            )}>
              <span aria-hidden={faceUp} data-prompt={descriptionGame || pictureGame ? "content" : "back"} className={cn(
                "word-deck-front relative flex min-h-[inherit] min-w-0 [grid-area:1/1] flex-col items-center justify-center rounded-[1.75rem] border shadow-2xl [backface-visibility:hidden]",
                descriptionGame || pictureGame
                  ? "border-slate-200 bg-[#fffdf7] px-6 pb-12 pt-14 text-slate-950"
                  : "border-white/25 bg-gradient-to-br from-white/22 to-black/10 backdrop-blur-xl",
              )}>
                {skin.card && <span aria-hidden="true" className="word-deck-corner">{skin.icon}</span>}
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
                    <span data-card-text="description" className={cn("w-full min-w-0 max-w-full [overflow-wrap:anywhere] text-center font-bold leading-relaxed", wordDeckTextSize(current?.description, "description"))}>
                      {current?.description}
                    </span>
                    <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">
                      {at + 1} / {deck.length}
                    </span>
                  </>
                ) : pictureGame ? (
                  <>
                    {(current?.promptFace ?? (settings.guessMode === "TRANSLATION" ? "TRANSLATION" : "PICTURE")) === "TRANSLATION" ? (
                      <span data-card-text="translation" className={cn("w-full min-w-0 max-w-full [overflow-wrap:anywhere] text-center font-black leading-tight", wordDeckTextSize(current?.translation))}>{current?.translation}</span>
                    ) : current?.imageUrl ? (
                      <Image src={current.imageUrl} alt="" fill sizes="(max-width: 640px) 90vw, 23rem" unoptimized className="object-contain p-4" />
                    ) : (
                      <span className="text-sm font-bold text-slate-400">{t.wordDeck.noPicture}</span>
                    )}
                    <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">{at + 1} / {deck.length}</span>
                  </>
                ) : (
                  <span className="text-6xl">{skin.card ? skin.icon : "♠"}</span>
                )}
              </span>
              <span aria-hidden={!faceUp} className={cn(
                "word-deck-answer relative flex min-h-[inherit] min-w-0 [grid-area:1/1] [transform:rotateY(180deg)] flex-col items-center justify-center rounded-[1.75rem] bg-[#fffdf7] text-slate-950 shadow-2xl [backface-visibility:hidden]",
                spellingGame ? "px-5 pb-10 pt-6 sm:px-10 sm:pb-12 sm:pt-8" : "px-6 pb-12 pt-14",
              )}>
                {skin.card && <span aria-hidden="true" className="word-deck-corner">{skin.icon}</span>}
                {current?.owner && (
                  <span className={cn(
                    "absolute right-4 top-4 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide",
                    current.owner === "STUDENT" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800",
                  )}>
                    {current.owner === "STUDENT" ? t.wordDeck.forStudent : t.wordDeck.forTeacher}
                  </span>
                )}
                {(descriptionGame ? settings.answerIcons : (settings.showIcons || spellingGame)) && current?.icon && (
                  <span className={cn("mb-3 leading-none", spellingGame ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl")} aria-hidden>
                    {current.icon}
                  </span>
                )}
                <span data-card-text="word" className={cn(
                  "w-full min-w-0 max-w-full [overflow-wrap:anywhere] text-center font-black leading-[1.15]",
                  wordDeckTextSize(current?.word, spellingGame ? "spelling" : "word"),
                )}>
                  {current?.word}
                </span>
                {correctionGame && faceUp && current?.correction && (
                  <span data-tense-correction-answer className="mt-4 block w-full text-center">
                    <span className={cn("inline-block rounded-lg px-3 py-2 text-sm font-black", current.correction.originallyCorrect ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                      {current.correction.originallyCorrect ? `✓ ${t.tenseCorrection.initiallyCorrect}` : `✏️ ${t.tenseCorrection.needsCorrection}`}
                    </span>
                    <span className="mt-3 block text-base font-black text-indigo-700">{TENSE_NAMES[current.correction.tenseId]}</span>
                    <span className="mt-2 block text-sm font-bold text-slate-800">{t.tenseCorrection.explanation}</span>
                    <span className="mt-1 block break-words text-sm leading-relaxed text-slate-600">{tenseCorrectionExplanation(current.correction, locale)}</span>
                  </span>
                )}
                {spellingGame && (
                  <div className="mt-4 w-full max-w-2xl text-center">
                    {(current?.transcriptionUs || current?.transcriptionUk) && (
                      <p className="text-[11px] font-bold leading-snug text-slate-400 sm:text-xs">
                        {current.transcriptionUs ? `US ${current.transcriptionUs}` : ""}
                        {current.transcriptionUs && current.transcriptionUk ? " · " : ""}
                        {current.transcriptionUk ? `UK ${current.transcriptionUk}` : ""}
                      </p>
                    )}
                    {settings.showTips && current?.translation && <p className="mt-2 break-words text-sm font-bold leading-snug text-emerald-700 sm:text-base">{current.translation}</p>}
                    {settings.showTips && current?.tip && <p className="mt-2 break-words text-[11px] font-semibold leading-snug text-slate-500 sm:text-xs">💡 {current.tip}</p>}
                    {settings.showTips && current?.examples?.[0] && <p className="mt-2 break-words text-[10px] leading-snug text-slate-500 sm:text-[11px]">{current.examples[0].en}</p>}
                  </div>
                )}
                <span className="absolute bottom-4 left-0 right-0 text-center text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">
                  {at + 1} / {deck.length}
                </span>
              </span>
            </span>
          </button>
        )}
        {descriptionGame && !correctionGame && !combinedGame && feedback && feedback !== "TIME_UP" && (
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
                "border-rose-300/50 bg-rose-600/85 text-white",
              )}>
                {t.wordDeck.wrong}
              </p>
            )}
          </div>
        )}
      </div>

      {canRateCards && current?.owner && <div className="mx-auto mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2" data-word-deck-rating>
        <span className="mr-1 text-xs font-bold text-white/80">{current.owner === "STUDENT" ? scoreLabels.student : scoreLabels.teacher}</span>
        {(["RIGHT", "WRONG"] as const).map(value => <button key={value} type="button" aria-label={value === "RIGHT" ? scoreLabels.right : scoreLabels.wrong} aria-pressed={ratings[current.instanceId] === value}
          onClick={() => rateCard(value)} className={cn("flex h-11 min-w-14 items-center justify-center gap-2 rounded-xl border px-4 font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white", ratings[current.instanceId] === value ? value === "RIGHT" ? "border-emerald-200 bg-emerald-400 text-emerald-950" : "border-rose-200 bg-rose-400 text-rose-950" : "border-white/25 bg-black/20 text-white hover:bg-white/20")}>
          {value === "RIGHT" ? <ThumbsUp className="h-5 w-5" /> : <ThumbsDown className="h-5 w-5" />}<span className="text-xs">{value === "RIGHT" ? "+1" : "0"}</span>
        </button>)}
      </div>}

      {correctionGame && started && !faceUp && <p className="mx-auto mt-3 max-w-xl text-center text-sm font-semibold text-white/80">{t.tenseCorrection.prompt}</p>}

      {combinedGame && started && (
        <div data-word-deck-phase={phase} role="status" aria-live="polite" className="mx-auto mt-3 max-w-xl rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-center text-sm font-bold">
          {phase === "GUESS" ? t.wordDeck.guessPhase : phase === "SENTENCE" ? t.wordDeck.sentencePhase : t.wordDeck.sentenceComplete}
          {phase === "GUESS" && verdict && <span className="mt-1 block text-xs">{verdict === "RIGHT" ? t.wordDeck.correct : t.wordDeck.wrong}</span>}
        </div>
      )}

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

      {teacherSeesAnswers && !observer && started && current && (
        <aside className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-300/35 bg-slate-950/45 px-4 py-3 text-white shadow-xl backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">
            👁 {(descriptionGame && (!combinedGame || phase === "GUESS")) || pictureGame ? t.classRoom.privateAnswer : t.classRoom.privateExamples}
          </p>
          {((descriptionGame && (!combinedGame || phase === "GUESS")) || pictureGame) ? (
            <>
              <p className="mt-1 break-words text-lg font-black">{current.word}</p>
              {current.translation && <p className="mt-0.5 text-xs font-semibold text-white/65">{current.translation}</p>}
            </>
          ) : (
            <ol className="mt-2 grid gap-1.5 text-sm font-semibold leading-relaxed text-white/90">
              {privateTeacherExamples(current).map((example, index) => (
                <li key={`${current.instanceId}-example-${index}`} className="flex gap-2">
                  <span className="font-black text-amber-300">{index + 1}.</span>
                  <span>{example}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[11px] text-white/45">{t.classRoom.teacherSeesAnswersHint}</p>
        </aside>
      )}

      {!observer && descriptionGame && started && (!combinedGame || phase === "GUESS") && (
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

      {!observer && descriptionGame && started && !faceUp && (correctionGame || combinedGame || expired || !!verdict) && (
        <button
          type="button"
          onClick={showAnswer}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-white backdrop-blur transition hover:bg-white/20"
        >
          {correctionGame ? t.tenseCorrection.reveal : combinedGame ? t.wordDeck.startSentence : t.wordDeck.openAnswer}
        </button>
      )}

      {!observer && <div className="mt-5 grid grid-cols-3 gap-2">
        <button type="button" onClick={previous} disabled={at <= 0} className="rounded-xl border border-white/15 bg-black/20 px-2 py-3 text-xs font-black backdrop-blur transition hover:bg-white/15 disabled:opacity-35">
          ↶ {t.wordDeck.previous}
        </button>
        <button type="button" onClick={shuffle} disabled={deck.length < 2} className="rounded-xl border border-white/15 bg-black/20 px-2 py-3 text-xs font-black backdrop-blur transition hover:bg-white/15 disabled:opacity-35">
          ⇄ {t.wordDeck.shuffle}
        </button>
        <button type="button" onClick={finished ? reset : combinedGame && started ? finishSentence : deal} disabled={!finished && (combinedGame && started ? phase !== "SENTENCE" : !canDeal)} className="rounded-xl bg-white px-2 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:scale-[1.02] disabled:opacity-40">
          {finished ? `↻ ${t.wordDeck.again}` : combinedGame && started ? `✓ ${t.wordDeck.finishSentence}` : `➜ ${t.wordDeck.deal}`}
        </button>
      </div>}
      {settings.alternate && started && !finished && !observer && !homework && <button type="button" onClick={() => setShowScores(value => !value)} aria-expanded={showScores} className="mx-auto mt-4 flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-black hover:bg-white/20"><Trophy className="h-4 w-4 text-amber-200" />{showScores ? scoreLabels.hide : scoreLabels.results}</button>}
      {settings.alternate && started && (showScores || finished) && <WordDeckScoreboard deck={deck} ratings={ratings} final={finished} canEdit={canRateCards} />}
      {!observer && reviewEditor && <div className="mt-4">{reviewEditor}</div>}
    </section>
  );
}
