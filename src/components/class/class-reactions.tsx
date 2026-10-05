"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { ScanLine, SmilePlus, Sparkles, Volume2, VolumeX, Wind } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { sendClassReactionAction } from "@/lib/actions/class-tools";
import {
  CLASS_REACTION_KINDS,
  type ClassReaction,
  type ClassReactionKind,
  type ClassReactionMode,
} from "@/lib/class-reaction";
import { cn } from "@/lib/utils";
import { IconX } from "@/components/icons";

const REACTION_LOOK: Record<
  ClassReactionKind,
  {
    emoji: string;
    panelLabel: string;
    studentLabel: string | null;
    accent: string;
    surface: string;
    glow: string;
  }
> = {
  great: {
    emoji: "🌟",
    panelLabel: "Great!",
    studentLabel: "Great!",
    accent: "text-violet-100",
    surface: "from-violet-600 via-fuchsia-600 to-indigo-700",
    glow: "bg-fuchsia-300/50",
  },
  "thumbs-up": {
    emoji: "👍",
    panelLabel: "Thumbs up",
    studentLabel: null,
    accent: "text-amber-50",
    surface: "from-amber-400 via-orange-500 to-rose-500",
    glow: "bg-amber-200/60",
  },
  confused: {
    emoji: "🤔",
    panelLabel: "Confused",
    studentLabel: "Confused",
    accent: "text-cyan-50",
    surface: "from-cyan-500 via-sky-600 to-indigo-700",
    glow: "bg-cyan-200/50",
  },
  "dont-understand": {
    emoji: "❓",
    panelLabel: "I don’t understand",
    studentLabel: "I don’t understand",
    accent: "text-emerald-50",
    surface: "from-emerald-500 via-teal-600 to-cyan-700",
    glow: "bg-emerald-200/50",
  },
  angry: {
    emoji: "😠",
    panelLabel: "Angry",
    studentLabel: null,
    accent: "text-rose-50",
    surface: "from-rose-500 via-red-600 to-orange-700",
    glow: "bg-rose-200/50",
  },
};

const FLOAT_EMOJI_COUNT = 13;

type FloatEmojiStyle = CSSProperties & {
  "--reaction-start-x": string;
  "--reaction-end-x": string;
  "--reaction-tilt": string;
  "--reaction-scale": string;
};

function playReactionSound(kind: ClassReactionKind) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
    gain.connect(ctx.destination);

    const notes: Record<ClassReactionKind, number[]> = {
      great: [523.25, 659.25, 783.99],
      "thumbs-up": [440, 659.25, 880],
      confused: [392, 329.63],
      "dont-understand": [349.23, 293.66],
      angry: [196, 155.56],
    };
    notes[kind].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = kind === "angry" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      const startsAt = ctx.currentTime + index * 0.12;
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 1_200);
  } catch {
    // Sound is optional: the visual reaction must always work.
  }
}

export function TeacherReactionPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [withSound, setWithSound] = useState(false);
  const [mode, setMode] = useState<ClassReactionMode>("emerge");
  const [sent, setSent] = useState<ClassReactionKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function send(kind: ClassReactionKind) {
    setError(null);
    startTransition(async () => {
      const result = await sendClassReactionAction(kind, withSound, mode);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(kind);
      window.setTimeout(() => setSent((current) => (current === kind ? null : current)), 1_500);
    });
  }

  return (
    <section
      role="dialog"
      aria-label={t.classRoom.reactionsTitle}
      className="fixed inset-x-3 bottom-[7.25rem] z-50 mx-auto w-[min(44rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl bg-surface/95 shadow-2xl ring-1 ring-line backdrop-blur-xl lg:bottom-[4.75rem]"
    >
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black text-content sm:text-base">{t.classRoom.reactionsTitle}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.classRoom.reactionsHint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3.5 sm:p-5">
        <div className="mb-3 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-2 rounded-2xl bg-surface-2 p-1 ring-1 ring-line">
            {([
              ["emerge", ScanLine, t.classRoom.reactionEmerge],
              ["float", Wind, t.classRoom.reactionFloat],
            ] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition",
                  mode === value
                    ? "bg-accent text-white shadow-md"
                    : "text-muted hover:bg-surface hover:text-content",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {value === "emerge" && (
                  <span className="hidden text-[9px] font-black uppercase tracking-wide opacity-65 md:inline">
                    {t.classRoom.reactionDefault}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={withSound}
            onClick={() => setWithSound((value) => !value)}
            className={cn(
              "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left ring-1 transition sm:w-auto",
              withSound
                ? "bg-accent-soft text-accent ring-accent/30"
                : "bg-surface-2 text-muted ring-line hover:text-content",
            )}
          >
            {withSound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            <span className="flex-1 text-sm font-bold">
              {withSound ? t.classRoom.reactionsSoundOn : t.classRoom.reactionsSoundOff}
            </span>
            <span
              aria-hidden
              className={cn(
                "relative h-6 w-11 rounded-full transition",
                withSound ? "bg-accent" : "bg-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
                  withSound ? "left-6" : "left-1",
                )}
              />
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {CLASS_REACTION_KINDS.map((kind) => {
            const look = REACTION_LOOK[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => send(kind)}
                className={cn(
                  "group relative min-h-28 overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:scale-[.97]",
                  look.surface,
                )}
              >
                <span className={cn("absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl", look.glow)} />
                <span className="block text-4xl transition duration-200 group-hover:scale-110" aria-hidden>
                  {sent === kind ? "✨" : look.emoji}
                </span>
                <span className="mt-2 block text-xs font-black leading-tight sm:text-[13px]">{look.panelLabel}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-center text-xs font-bold text-rose-500">{error}</p>}
        {sent && !error && (
          <p className="mt-3 text-center text-xs font-bold text-emerald-500" aria-live="polite">
            {t.classRoom.reactionSent}
          </p>
        )}
      </div>
    </section>
  );
}

export function StudentClassReaction({
  reaction,
  onDone,
}: {
  reaction: ClassReaction;
  onDone: (id: string) => void;
}) {
  const { t } = useT();
  const look = REACTION_LOOK[reaction.kind];

  useEffect(() => {
    if (reaction.sound) playReactionSound(reaction.kind);
    const timer = window.setTimeout(
      () => onDone(reaction.id),
      reaction.mode === "float" ? 3_600 : 4_200,
    );
    return () => window.clearTimeout(timer);
  }, [onDone, reaction.id, reaction.kind, reaction.mode, reaction.sound]);

  if (reaction.mode === "float") {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-[140] overflow-hidden"
      >
        <span className="sr-only">{look.panelLabel}</span>
        {Array.from({ length: FLOAT_EMOJI_COUNT }, (_, index) => {
          const side = index % 2 === 0 ? -1 : 1;
          const spread = 20 + ((index * 17) % 34);
          const end = side * (2 + ((index * 7) % 13));
          const style: FloatEmojiStyle = {
            "--reaction-start-x": `${side * spread}vw`,
            "--reaction-end-x": `${end}vw`,
            "--reaction-tilt": `${side * (18 + ((index * 23) % 44))}deg`,
            "--reaction-scale": `${0.72 + ((index * 11) % 55) / 100}`,
            animationDelay: `${index * 55}ms`,
          };
          return (
            <span
              key={index}
              aria-hidden
              className="class-reaction-float-emoji absolute bottom-[-7rem] left-1/2 text-[3.75rem] leading-none drop-shadow-[0_12px_24px_rgba(0,0,0,.35)] sm:text-[5.5rem]"
              style={style}
            >
              {look.emoji}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center overflow-hidden p-4 sm:p-8"
    >
      <div className="class-reaction-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-[3px]" />
      <div
        className={cn(
          "class-reaction-card relative flex min-h-80 w-full max-w-2xl flex-col items-center justify-center overflow-hidden rounded-[2.5rem] bg-gradient-to-br px-6 py-10 text-center text-white shadow-[0_35px_120px_rgba(0,0,0,.55)] ring-4 ring-white/25 sm:min-h-[30rem] sm:rounded-[3.5rem] sm:px-12",
          look.surface,
        )}
      >
        <div className={cn("absolute inset-16 rounded-full blur-[80px]", look.glow)} />
        {Array.from({ length: 12 }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className="class-reaction-particle absolute h-3 w-3 rounded-sm bg-white/80"
            style={{
              left: `${8 + ((index * 29) % 84)}%`,
              top: `${7 + ((index * 37) % 82)}%`,
              animationDelay: `${index * 70}ms`,
              transform: `rotate(${index * 31}deg)`,
            }}
          />
        ))}
        <Sparkles className="absolute left-8 top-8 h-8 w-8 text-white/60 sm:h-12 sm:w-12" />
        <Sparkles className="absolute bottom-10 right-9 h-6 w-6 text-white/55 sm:h-10 sm:w-10" />
        <span className="class-reaction-emoji relative text-[7.5rem] leading-none drop-shadow-2xl sm:text-[11rem]" aria-hidden>
          {look.emoji}
        </span>
        {reaction.kind !== "thumbs-up" && (
          <p className="relative mt-5 text-[10px] font-black uppercase tracking-[.3em] text-white/65 sm:text-xs">
            {t.classRoom.reactionFromTeacher}
          </p>
        )}
        {look.studentLabel ? (
          <p className={cn("class-reaction-title relative mt-2 text-balance text-4xl font-black leading-none drop-shadow-lg sm:text-6xl", look.accent)}>
            {look.studentLabel}
          </p>
        ) : (
          <span className="sr-only">{look.panelLabel}</span>
        )}
      </div>
    </div>
  );
}

export function ReactionToolbarIcon({ className }: { className?: string }) {
  return <SmilePlus className={className} />;
}
