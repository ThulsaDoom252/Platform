"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  BellRing,
  Check,
  Eye,
  EyeOff,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useT } from "@/components/i18n-provider";
import {
  controlClassTimerAction,
  deleteClassStudentTimerAction,
  deleteClassTimerPresetAction,
  listClassStudentTimersAction,
  listClassTimerPresetsAction,
  prepareClassTimerAction,
  saveClassStudentTimerAction,
  saveClassTimerPresetAction,
  setClassTimerVisibleAction,
  updateActiveClassTimerAction,
  type ActiveClassTimerPatch,
  type SaveClassTimerPresetInput,
} from "@/lib/actions/class-tools";
import {
  CLASS_TIMER_END_SOUNDS,
  CLASS_TIMER_THEMES,
  CLASS_TIMER_TICK_SOUNDS,
  classTimerRemainingMs,
  type ClassTimerEndSound,
  type ClassTimerPreset,
  type ClassTimerState,
  type ClassTimerTheme,
  type ClassTimerTickSound,
} from "@/lib/class-timer";
import { cn } from "@/lib/utils";

type AudioKind = "tick" | "end";

function audioContext() {
  const Ctx = window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctx ? new Ctx() : null;
}

function tone(ctx: AudioContext, at: number, frequency: number, duration: number, type: OscillatorType) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.085, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

export function playClassTimerSound(kind: AudioKind, sound: string) {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const start = ctx.currentTime + 0.015;
    if (kind === "tick") {
      if (sound === "wood") {
        tone(ctx, start, 210, 0.08, "square");
        tone(ctx, start + 0.055, 150, 0.06, "square");
      } else if (sound === "digital") {
        tone(ctx, start, 1040, 0.055, "sine");
      } else if (sound === "pulse") {
        tone(ctx, start, 420, 0.05, "triangle");
        tone(ctx, start + 0.09, 520, 0.05, "triangle");
      } else {
        tone(ctx, start, 720, 0.07, "sine");
      }
    } else if (sound === "success") {
      [523, 659, 784].forEach((frequency, index) =>
        tone(ctx, start + index * 0.14, frequency, 0.3, "sine"),
      );
    } else if (sound === "gong") {
      tone(ctx, start, 196, 1.15, "sine");
      tone(ctx, start, 294, 0.85, "triangle");
    } else if (sound === "sparkle") {
      [880, 1175, 1397, 1760].forEach((frequency, index) =>
        tone(ctx, start + index * 0.09, frequency, 0.35, "sine"),
      );
    } else {
      [659, 988, 784].forEach((frequency, index) =>
        tone(ctx, start + index * 0.18, frequency, 0.45, "sine"),
      );
    }
    window.setTimeout(() => void ctx.close(), 1800);
  } catch {
    // Audio is an enhancement; browser autoplay policy can reject it.
  }
}

const THEME_STYLE: Record<ClassTimerTheme, { shell: string; clock: string; accent: string }> = {
  violet: {
    shell: "from-violet-100 via-white to-indigo-100 dark:from-violet-950 dark:via-slate-950 dark:to-indigo-950",
    clock: "from-violet-500 to-indigo-600",
    accent: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  },
  ocean: {
    shell: "from-sky-100 via-white to-cyan-100 dark:from-sky-950 dark:via-slate-950 dark:to-cyan-950",
    clock: "from-sky-500 to-cyan-600",
    accent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
  },
  mint: {
    shell: "from-emerald-100 via-white to-teal-100 dark:from-emerald-950 dark:via-slate-950 dark:to-teal-950",
    clock: "from-emerald-500 to-teal-600",
    accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  },
  sunset: {
    shell: "from-amber-100 via-white to-rose-100 dark:from-amber-950 dark:via-slate-950 dark:to-rose-950",
    clock: "from-amber-500 to-rose-500",
    accent: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
};

function useCountdown(state: ClassTimerState) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = classTimerRemainingMs(state, now);
  const lastSecond = useRef(Math.ceil(remaining / 1000));
  const playedStart = useRef<string | null>(null);
  const playedEnd = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== "RUNNING") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (
      state.status === "RUNNING" &&
      state.startedSignalAt &&
      state.startedSignalAt !== playedStart.current
    ) {
      playedStart.current = state.startedSignalAt;
      playedEnd.current = null;
      if (state.startVoiceEnabled && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const phrase = new SpeechSynthesisUtterance("Start");
        phrase.lang = "en-US";
        phrase.rate = 0.9;
        phrase.pitch = 1.08;
        window.speechSynthesis.speak(phrase);
      }
    }
  }, [state.startVoiceEnabled, state.startedSignalAt, state.status]);

  useEffect(() => {
    const second = Math.ceil(remaining / 1000);
    if (
      state.status === "RUNNING" &&
      state.tickSoundEnabled &&
      second > 0 &&
      second !== lastSecond.current
    ) {
      playClassTimerSound("tick", state.tickSound);
    }
    lastSecond.current = second;

    const runKey = `${state.id}:${state.startedSignalAt ?? "ready"}`;
    if (remaining === 0 && state.endSoundEnabled && playedEnd.current !== runKey) {
      playedEnd.current = runKey;
      playClassTimerSound("end", state.endSound);
    }
  }, [remaining, state]);

  return remaining;
}

function TimerArtwork({ theme }: { theme: ClassTimerTheme }) {
  const style = THEME_STYLE[theme];
  return (
    <div className="relative mx-auto h-44 w-full max-w-md overflow-hidden rounded-[2rem] bg-white/55 shadow-inner ring-1 ring-white/80 dark:bg-slate-950/25 dark:ring-white/10 sm:h-52">
      <span className="absolute left-7 top-8 text-5xl drop-shadow-sm">🌱</span>
      <span className="absolute bottom-5 left-10 rotate-[-7deg] text-5xl drop-shadow-sm">📚</span>
      <span className="absolute right-8 top-7 rotate-[7deg] rounded-lg bg-amber-200 px-3 py-2 text-center text-xs font-black leading-tight text-amber-900 shadow-md">
        One step<br />closer!
      </span>
      <span className="absolute bottom-6 right-9 text-5xl drop-shadow-sm">☕</span>
      <div className={cn(
        "absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br text-7xl shadow-2xl ring-8 ring-white/70 sm:h-40 sm:w-40 sm:text-8xl",
        style.clock,
      )}>
        ⏰
      </div>
    </div>
  );
}

function TimerFace({ state, student }: { state: ClassTimerState; student: boolean }) {
  const { t } = useT();
  const remaining = useCountdown(state);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const finished = remaining === 0 && state.status !== "READY";
  return (
    <div className={cn(
      "relative flex flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-br p-5 text-center shadow-xl ring-1 ring-black/5 sm:p-7",
      THEME_STYLE[state.theme].shell,
      student && "w-full max-w-3xl",
    )}>
      {state.status === "RUNNING" && state.startedSignalAt && (
        <div key={state.startedSignalAt} className="class-timer-start pointer-events-none absolute inset-x-0 top-1/2 z-20 text-5xl font-black uppercase italic text-emerald-500 drop-shadow-lg sm:text-7xl">
          {t.classRoom.timerStartBurst}
        </div>
      )}
      <TimerArtwork theme={state.theme} />
      <p className={cn(
        "mt-5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.14em]",
        THEME_STYLE[state.theme].accent,
      )}>
        {state.topic || state.name}
      </p>
      <div className="mt-4 rounded-2xl bg-white/70 px-7 py-3 shadow-inner ring-1 ring-white dark:bg-slate-950/35 dark:ring-white/10">
        {finished ? (
          <p className="class-timer-finish text-3xl font-black text-rose-500 sm:text-5xl">
            {t.classRoom.timerTimesUp}
          </p>
        ) : (
          <div className="flex items-end justify-center gap-2 font-mono text-5xl font-black tabular-nums text-content sm:text-6xl">
            <span>{String(minutes).padStart(2, "0")}</span>
            <span className="pb-1 text-accent">:</span>
            <span>{String(seconds).padStart(2, "0")}</span>
          </div>
        )}
        {!finished && (
          <div className="mt-1 flex justify-center gap-10 text-[10px] font-bold uppercase tracking-widest text-faint">
            <span>{t.classRoom.timerMinutes}</span>
            <span>{t.classRoom.timerSeconds}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentClassTimer({ state }: { state: ClassTimerState | null }) {
  if (!state?.visible) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-8">
      <TimerFace state={state} student />
    </div>
  );
}

const emptyPreset = (): SaveClassTimerPresetInput => ({
  name: "",
  topic: "",
  durationSeconds: 300,
  theme: "violet",
  tickSound: "soft",
  endSound: "bell",
  tickSoundEnabled: false,
  endSoundEnabled: true,
  startVoiceEnabled: true,
});

export function ClassTimerManager({
  state,
  studentName,
  onStateChange,
  onClose,
  notes,
}: {
  state: ClassTimerState | null;
  studentName: string;
  onStateChange: (state: ClassTimerState | null) => void;
  onClose: () => void;
  notes?: React.ReactNode;
}) {
  const { t } = useT();
  const [studentTimers, setStudentTimers] = useState<ClassTimerPreset[]>([]);
  const [presets, setPresets] = useState<ClassTimerPreset[]>([]);
  const [mode, setMode] = useState<"list" | "edit" | "active">(state ? "active" : "list");
  const [draft, setDraft] = useState<SaveClassTimerPresetInput>(emptyPreset);
  const [editTarget, setEditTarget] = useState<"student-new" | "student" | "preset">("student-new");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      listClassStudentTimersAction(),
      listClassTimerPresetsAction(),
    ]).then(([timers, presetItems]) => {
      if (!alive) return;
      setStudentTimers(timers);
      setPresets(presetItems);
    });
    return () => { alive = false; };
  }, [studentName]);

  const refreshLibrary = async () => {
    const [timers, presetItems] = await Promise.all([
      listClassStudentTimersAction(),
      listClassTimerPresetsAction(),
    ]);
    setStudentTimers(timers);
    setPresets(presetItems);
  };

  const act = (task: () => Promise<{ state?: ClassTimerState | null; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
      else if ("state" in result) onStateChange(result.state ?? null);
    });
  };

  const patch = (change: ActiveClassTimerPatch) =>
    act(() => updateActiveClassTimerAction(change));

  const closeManager = () => {
    if (!state) return onClose();
    act(async () => {
      const result = await controlClassTimerAction("CLOSE");
      if (!result.error) onClose();
      return result;
    });
  };

  const editTimer = (timer: ClassTimerPreset, target: "student" | "preset") => {
    setDraft({
      id: timer.id,
      name: timer.name,
      topic: timer.topic,
      durationSeconds: timer.durationSeconds,
      theme: timer.theme,
      tickSound: timer.tickSound,
      endSound: timer.endSound,
      tickSoundEnabled: timer.tickSoundEnabled,
      endSoundEnabled: timer.endSoundEnabled,
      startVoiceEnabled: timer.startVoiceEnabled,
    });
    setEditTarget(target);
    setSaveAsPreset(false);
    setMode("edit");
  };

  const removeTimer = (id: string, target: "student" | "preset") => {
    const deleteKey = `${target}:${id}`;
    if (pendingDelete !== deleteKey) {
      setPendingDelete(deleteKey);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = target === "student"
        ? await deleteClassStudentTimerAction(id)
        : await deleteClassTimerPresetAction(id);
      if (result.error) return setError(result.error);
      setPendingDelete(null);
      await refreshLibrary();
    });
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5">
      <section className="relative max-h-[96dvh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-surface p-4 shadow-2xl ring-1 ring-line sm:p-6">
        <button
          type="button"
          onClick={closeManager}
          aria-label={t.common.close}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted transition hover:text-rose-500"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 pr-12">
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-accent">
            {t.classRoom.timer}
          </p>
          <h2 className="text-xl font-black text-content">
            {mode === "list"
              ? t.classRoom.timerLibrary
              : mode === "edit"
                ? t.classRoom.timerEditor
                : state?.name}
          </h2>
          <p className="mt-1 text-xs text-muted">{studentName}</p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        )}

        {mode === "list" && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                setDraft(emptyPreset());
                setEditTarget("student-new");
                setSaveAsPreset(false);
                setPendingDelete(null);
                setMode("edit");
              }}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/35 bg-accent-soft/40 text-sm font-black text-accent transition hover:border-accent hover:bg-accent-soft"
            >
              <Plus className="h-5 w-5" /> {t.classRoom.timerCreate}
            </button>
            <TimerLibrarySection
              title={t.classRoom.timerStudentTimers}
              subtitle={studentName}
              items={studentTimers}
              empty={t.classRoom.timerEmpty}
              source="student"
              busy={busy}
              pendingDelete={pendingDelete}
              openLabel={t.classRoom.timerOpen}
              editLabel={t.classRoom.edit}
              deleteLabel={t.classRoom.timerDelete}
              deleteConfirmLabel={t.classRoom.timerDeleteConfirm}
              deleteCancelLabel={t.classRoom.timerDeleteCancel}
              onOpen={(timer) => act(async () => {
                const result = await prepareClassTimerAction(timer.id, "student");
                if (!result.error) setMode("active");
                return result;
              })}
              onEdit={(timer) => editTimer(timer, "student")}
              onDelete={(timer) => removeTimer(timer.id, "student")}
              onCancelDelete={() => setPendingDelete(null)}
            />
            <TimerLibrarySection
              title={t.classRoom.timerPresets}
              items={presets}
              empty={t.classRoom.timerPresetsEmpty}
              source="preset"
              busy={busy}
              pendingDelete={pendingDelete}
              openLabel={t.classRoom.timerOpen}
              editLabel={t.classRoom.edit}
              deleteLabel={t.classRoom.timerDelete}
              deleteConfirmLabel={t.classRoom.timerDeleteConfirm}
              deleteCancelLabel={t.classRoom.timerDeleteCancel}
              onOpen={(timer) => act(async () => {
                const result = await prepareClassTimerAction(timer.id, "preset");
                if (!result.error) setMode("active");
                return result;
              })}
              onEdit={(timer) => editTimer(timer, "preset")}
              onDelete={(timer) => removeTimer(timer.id, "preset")}
              onCancelDelete={() => setPendingDelete(null)}
            />
          </div>
        )}

        {mode === "edit" && (
          <TimerPresetEditor
            value={draft}
            busy={busy}
            saveAsPreset={saveAsPreset}
            offerPreset={editTarget === "student-new"}
            onChange={setDraft}
            onSaveAsPreset={setSaveAsPreset}
            onCancel={() => {
              setPendingDelete(null);
              setMode("list");
            }}
            onSave={() => {
              setError(null);
              startTransition(async () => {
                const result = editTarget === "preset"
                  ? await saveClassTimerPresetAction(draft)
                  : await saveClassStudentTimerAction(draft, editTarget === "student-new" && saveAsPreset);
                if (result.error) return setError(result.error);
                await refreshLibrary();
                setMode("list");
              });
            }}
          />
        )}

        {mode === "active" && state && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              <TimerFace state={state} student={false} />

              <div className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
                <label className="text-[10px] font-black uppercase tracking-wide text-faint">
                  {t.classRoom.timerTopic}
                </label>
                <input
                  key={`${state.id}:${state.topic}`}
                  defaultValue={state.topic}
                  disabled={state.status === "RUNNING"}
                  onBlur={(event) => patch({ topic: event.currentTarget.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  className="mt-1 h-10 w-full rounded-xl bg-surface px-3 text-sm font-bold text-content outline-none ring-1 ring-line transition focus:ring-accent disabled:opacity-60"
                />
                {state.status !== "RUNNING" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CLASS_TIMER_THEMES.map((theme) => (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => patch({ theme })}
                        className={cn(
                          "h-7 rounded-lg px-2.5 text-[11px] font-black capitalize ring-1 transition",
                          state.theme === theme
                            ? "bg-accent text-white ring-accent"
                            : "bg-surface text-muted ring-line hover:text-content",
                        )}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={busy || state.visible}
                  onClick={() => act(() => setClassTimerVisibleAction(true))}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition",
                    state.visible ? "bg-emerald-500 text-white" : "bg-surface-2 text-content ring-1 ring-line",
                    "disabled:cursor-default disabled:opacity-100",
                  )}
                >
                  {state.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {state.visible ? t.classRoom.timerFocused : t.classRoom.timerFocus}
                </button>
                {state.status === "RUNNING" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => controlClassTimerAction("PAUSE"))}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 shadow-md transition hover:scale-105 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300"
                    aria-label={t.classRoom.timerPause}
                  >
                    <Pause className="h-5 w-5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => controlClassTimerAction("START"))}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:scale-105 disabled:opacity-50"
                    aria-label={t.classRoom.timerStart}
                  >
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => controlClassTimerAction("RESET"))}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted shadow-md ring-1 ring-line transition hover:scale-105 hover:text-content disabled:opacity-50"
                  aria-label={t.classRoom.timerReset}
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeManager}
                  className="flex h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-black text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> {t.classRoom.timerClose}
                </button>
              </div>

              <LiveSoundSettings state={state} onPatch={patch} />
            </div>
            <aside className="min-w-0">{notes}</aside>
          </div>
        )}
      </section>
    </div>
  );
}

function TimerLibrarySection({
  title,
  subtitle,
  items,
  empty,
  source,
  busy,
  pendingDelete,
  openLabel,
  editLabel,
  deleteLabel,
  deleteConfirmLabel,
  deleteCancelLabel,
  onOpen,
  onEdit,
  onDelete,
  onCancelDelete,
}: {
  title: string;
  subtitle?: string;
  items: ClassTimerPreset[];
  empty: string;
  source: "student" | "preset";
  busy: boolean;
  pendingDelete: string | null;
  openLabel: string;
  editLabel: string;
  deleteLabel: string;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
  onOpen: (timer: ClassTimerPreset) => void;
  onEdit: (timer: ClassTimerPreset) => void;
  onDelete: (timer: ClassTimerPreset) => void;
  onCancelDelete: () => void;
}) {
  return (
    <section className="rounded-3xl bg-surface-2/65 p-3 ring-1 ring-line sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-content">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-muted">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-black text-accent ring-1 ring-line">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm font-semibold text-faint">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((timer) => {
            const deleteKey = `${source}:${timer.id}`;
            const confirming = pendingDelete === deleteKey;
            return (
              <article key={timer.id} className={cn("rounded-2xl bg-gradient-to-br p-4 ring-1 ring-line", THEME_STYLE[timer.theme].shell)}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl text-white shadow-md", THEME_STYLE[timer.theme].clock)}>⏰</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-black text-content">{timer.name}</h4>
                    <p className="mt-0.5 truncate text-xs text-muted">{timer.topic || "—"}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-accent">
                      {Math.floor(timer.durationSeconds / 60)}:{String(timer.durationSeconds % 60).padStart(2, "0")}
                    </p>
                  </div>
                </div>
                {confirming ? (
                  <div className="mt-4 rounded-xl bg-rose-50/90 p-2 ring-1 ring-rose-200 dark:bg-rose-950/70 dark:ring-rose-900">
                    <p className="text-center text-xs font-black text-rose-600 dark:text-rose-200">{deleteConfirmLabel}</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} onClick={onCancelDelete} className="h-8 flex-1 rounded-lg bg-surface text-[11px] font-bold text-muted ring-1 ring-line disabled:opacity-50">
                        {deleteCancelLabel}
                      </button>
                      <button type="button" disabled={busy} onClick={() => onDelete(timer)} className="h-8 flex-1 rounded-lg bg-rose-500 text-[11px] font-black text-white disabled:opacity-50">
                        {deleteLabel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onOpen(timer)}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent text-xs font-black text-white transition hover:brightness-95 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" /> {openLabel}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onEdit(timer)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/80 text-muted ring-1 ring-line transition hover:text-accent disabled:opacity-50"
                      aria-label={editLabel}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(timer)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/80 text-muted ring-1 ring-line transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/50"
                      aria-label={deleteLabel}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TimerPresetEditor({
  value,
  busy,
  saveAsPreset,
  offerPreset,
  onChange,
  onSaveAsPreset,
  onCancel,
  onSave,
}: {
  value: SaveClassTimerPresetInput;
  busy: boolean;
  saveAsPreset: boolean;
  offerPreset: boolean;
  onChange: (value: SaveClassTimerPresetInput) => void;
  onSaveAsPreset: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useT();
  const minutes = Math.floor(value.durationSeconds / 60);
  const seconds = value.durationSeconds % 60;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2 p-4 ring-1 ring-line">
        <Field label={t.classRoom.timerName}>
          <input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} className="timer-input" autoFocus />
        </Field>
        <Field label={t.classRoom.timerTopic}>
          <input value={value.topic} onChange={(event) => onChange({ ...value, topic: event.target.value })} className="timer-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.classRoom.timerMinutes}>
            <input type="number" min={0} max={1440} value={minutes} onChange={(event) => onChange({ ...value, durationSeconds: Math.max(5, Number(event.target.value) * 60 + seconds) })} className="timer-input" />
          </Field>
          <Field label={t.classRoom.timerSeconds}>
            <input type="number" min={0} max={59} value={seconds} onChange={(event) => onChange({ ...value, durationSeconds: Math.max(5, minutes * 60 + Math.min(59, Number(event.target.value))) })} className="timer-input" />
          </Field>
        </div>
        <Field label={t.classRoom.timerTheme}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CLASS_TIMER_THEMES.map((theme) => (
              <button key={theme} type="button" onClick={() => onChange({ ...value, theme })} className={cn("rounded-xl px-3 py-2 text-xs font-black capitalize ring-1", value.theme === theme ? "bg-accent text-white ring-accent" : "bg-surface text-muted ring-line")}>{theme}</button>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <SoundPicker
          title={t.classRoom.timerEndSound}
          icon={<BellRing className="h-4 w-4" />}
          enabled={value.endSoundEnabled}
          value={value.endSound}
          choices={CLASS_TIMER_END_SOUNDS}
          onEnabled={(enabled) => onChange({ ...value, endSoundEnabled: enabled })}
          onPick={(sound) => onChange({ ...value, endSound: sound as ClassTimerEndSound })}
          kind="end"
        />
        <SoundPicker
          title={t.classRoom.timerTickSound}
          icon={<Music2 className="h-4 w-4" />}
          enabled={value.tickSoundEnabled}
          value={value.tickSound}
          choices={CLASS_TIMER_TICK_SOUNDS}
          onEnabled={(enabled) => onChange({ ...value, tickSoundEnabled: enabled })}
          onPick={(sound) => onChange({ ...value, tickSound: sound as ClassTimerTickSound })}
          kind="tick"
        />
        <ToggleRow
          label={t.classRoom.timerStartVoice}
          enabled={value.startVoiceEnabled}
          onChange={(enabled) => onChange({ ...value, startVoiceEnabled: enabled })}
          icon={<Sparkles className="h-4 w-4" />}
        />
        {offerPreset && (
          <button
            type="button"
            role="checkbox"
            aria-checked={saveAsPreset}
            onClick={() => onSaveAsPreset(!saveAsPreset)}
            className={cn(
              "rounded-2xl p-3 text-left ring-1 transition",
              saveAsPreset
                ? "bg-accent-soft text-content ring-accent/40"
                : "bg-surface-2 text-content ring-line hover:ring-accent/30",
            )}
          >
            <span className="flex items-center gap-2 text-xs font-black">
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md ring-1",
                saveAsPreset ? "bg-accent text-white ring-accent" : "bg-surface text-transparent ring-line",
              )}>
                <Check className="h-3.5 w-3.5" />
              </span>
              {t.classRoom.timerSavePreset}
            </span>
            <span className="mt-2 block text-[11px] font-semibold leading-relaxed text-muted">
              {t.classRoom.timerSavePresetHint}
            </span>
          </button>
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-bold text-muted ring-1 ring-line">{t.common.cancel}</button>
          <button type="button" disabled={busy} onClick={onSave} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-black text-white disabled:opacity-50"><Check className="h-4 w-4" />{t.common.save}</button>
        </div>
      </div>
    </div>
  );
}

function LiveSoundSettings({ state, onPatch }: { state: ClassTimerState; onPatch: (patch: ActiveClassTimerPatch) => void }) {
  const { t } = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SoundPicker title={t.classRoom.timerEndSound} icon={<BellRing className="h-4 w-4" />} enabled={state.endSoundEnabled} value={state.endSound} choices={CLASS_TIMER_END_SOUNDS} onEnabled={(enabled) => onPatch({ endSoundEnabled: enabled })} onPick={(sound) => onPatch({ endSound: sound as ClassTimerEndSound })} kind="end" compact />
      <SoundPicker title={t.classRoom.timerTickSound} icon={<Music2 className="h-4 w-4" />} enabled={state.tickSoundEnabled} value={state.tickSound} choices={CLASS_TIMER_TICK_SOUNDS} onEnabled={(enabled) => onPatch({ tickSoundEnabled: enabled })} onPick={(sound) => onPatch({ tickSound: sound as ClassTimerTickSound })} kind="tick" compact />
      <ToggleRow label={t.classRoom.timerStartVoice} enabled={state.startVoiceEnabled} onChange={(enabled) => onPatch({ startVoiceEnabled: enabled })} icon={<Sparkles className="h-4 w-4" />} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-[10px] font-black uppercase tracking-wide text-faint">{label}{children}</label>;
}

function SoundPicker({ title, icon, enabled, value, choices, onEnabled, onPick, kind, compact = false }: {
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
  value: string;
  choices: readonly string[];
  onEnabled: (enabled: boolean) => void;
  onPick: (value: string) => void;
  kind: AudioKind;
  compact?: boolean;
}) {
  const { t } = useT();
  return (
    <div className={cn("rounded-2xl bg-surface-2 p-3 ring-1 ring-line", compact && "min-w-0") }>
      <div className="flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-black text-content">{title}</span>
        <button type="button" onClick={() => onEnabled(!enabled)} className={cn("flex h-6 w-10 items-center rounded-full p-0.5 transition", enabled ? "justify-end bg-accent" : "justify-start bg-line")}>
          <span className="h-5 w-5 rounded-full bg-white shadow" />
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        <select value={value} onChange={(event) => onPick(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg bg-surface px-2 text-[11px] font-bold capitalize text-content outline-none ring-1 ring-line">
          {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </select>
        <button type="button" onClick={() => playClassTimerSound(kind, value)} title={t.classRoom.timerPreviewSound} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-accent ring-1 ring-line transition hover:bg-accent hover:text-white">
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, enabled, onChange, icon }: { label: string; enabled: boolean; onChange: (enabled: boolean) => void; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!enabled)} className="flex min-h-14 items-center gap-2 rounded-2xl bg-surface-2 p-3 text-left ring-1 ring-line">
      <span className="text-accent">{icon}</span>
      <span className="min-w-0 flex-1 text-xs font-black text-content">{label}</span>
      {enabled ? <Volume2 className="h-4 w-4 text-accent" /> : <VolumeX className="h-4 w-4 text-faint" />}
    </button>
  );
}
