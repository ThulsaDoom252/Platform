"use client";

import { upload } from "@vercel/blob/client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useT } from "@/components/i18n-provider";
import { IconCheck, IconVideo, IconVolume } from "@/components/icons";
import {
  saveLessonAction,
  syncLessonVideoAction,
  type LessonVideoUpdate,
} from "@/lib/actions/lessons";
import {
  expectedClassVideoTime,
  parseLessonVideoSource,
  withYouTubeClip,
  type ClassVideoState,
} from "@/lib/class-video";
import { cn } from "@/lib/utils";

export type LessonVideoSession = {
  assignmentId: string;
  teacher: boolean;
  state: ClassVideoState | null;
};

type YouTubeTrack = {
  languageCode?: string;
  languageName?: string;
  displayName?: string;
  name?: string | { simpleText?: string };
  kind?: string;
  vssId?: string;
  vss_id?: string;
  isDefault?: boolean;
  is_default?: boolean;
  [key: string]: unknown;
};

type CaptionOption = {
  code: string;
  name: string;
  automatic: boolean;
  track: YouTubeTrack;
};

type YouTubePlayer = {
  destroy(): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailableQualityLevels(): string[];
  setPlaybackQuality(quality: string): void;
  loadModule(module: string): void;
  unloadModule(module: string): void;
  getOption(module: string, option: string): unknown;
  setOption(module: string, option: string, value: unknown): void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady(event: { target: YouTubePlayer }): void;
        onStateChange(event: { data: number; target: YouTubePlayer }): void;
        onApiChange(event: { target: YouTubePlayer }): void;
        onError(event: { data: number }): void;
      };
    },
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required"));
  const target = window as YouTubeWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (target.YT?.Player) resolve(target.YT);
      else reject(new Error("YouTube API did not initialize"));
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-lingora-youtube-api]");
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.lingoraYoutubeApi = "1";
    script.onerror = () => reject(new Error("Could not load YouTube"));
    document.head.append(script);
  });
  return youtubeApiPromise;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

const formatEditorTime = (seconds: number | null) => {
  if (seconds === null) return "";
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
};

const parseEditorTime = (value: string): number | null => {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.floor(Number(raw));
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => part < 0 || part >= 60)) return null;
  return numbers.length === 2
    ? numbers[0] * 60 + numbers[1]
    : numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
};

const trackName = (track: YouTubeTrack, fallback: string) => {
  if (typeof track.languageName === "string" && track.languageName.trim()) return track.languageName.trim();
  if (typeof track.displayName === "string" && track.displayName.trim()) return track.displayName.trim();
  if (typeof track.name === "string" && track.name.trim()) return track.name.trim();
  if (track.name && typeof track.name === "object" && typeof track.name.simpleText === "string") {
    return track.name.simpleText.trim() || fallback;
  }
  return fallback;
};

const isAutomaticTrack = (track: YouTubeTrack) => {
  const kind = String(track.kind ?? "").toLowerCase();
  const vssId = String(track.vssId ?? track.vss_id ?? "").toLowerCase();
  const name = trackName(track, "").toLowerCase();
  return kind === "asr" || vssId.startsWith("a.") || /auto(?:matic)?(?:ally)? generated/.test(name);
};

const QUALITY_LABELS: Record<string, string> = {
  auto: "Auto",
  highres: "4K+",
  hd2160: "2160p",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
};

type PlayerControlsProps = {
  teacher: boolean;
  playing: boolean;
  startTime?: number;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  playbackRate: number;
  captions: boolean;
  captionsAvailable: boolean;
  captionLanguage: string;
  captionLanguages?: { code: string; name: string }[];
  quality: string;
  qualityLevels?: string[];
  syncError?: string | null;
  onTogglePlay(): void;
  onSeek(value: number): void;
  onToggleMute(): void;
  onVolume(value: number): void;
  onRate(value: number): void;
  onCaptions(value: boolean): void;
  onLanguage(value: string): void;
  onQuality(value: string): void;
  onFullscreen(): void;
};

function PlayerControls(props: PlayerControlsProps) {
  const { t } = useT();
  const locked = !props.teacher;
  const languages = props.captionLanguages?.length
    ? props.captionLanguages
    : [{ code: "en", name: "English" }];
  const qualities = [...new Set(["auto", ...(props.qualityLevels ?? [])])];
  const controlClass = cn(
    "flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/8 px-2.5 text-[11px] font-extrabold text-white transition",
    "enabled:hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-38",
  );

  return (
    <div className="border-t border-white/10 bg-slate-950/95 px-3 pb-3 pt-2 text-white">
      <input
        type="range"
        min={props.startTime ?? 0}
        max={Math.max((props.startTime ?? 0) + 1, props.duration)}
        step={0.05}
        value={Math.max(
          props.startTime ?? 0,
          Math.min(props.currentTime, Math.max((props.startTime ?? 0) + 1, props.duration)),
        )}
        disabled={locked}
        onChange={(event) => props.onSeek(Number(event.target.value))}
        aria-label="Video position"
        className="lesson-video-range w-full"
        style={{
          "--video-progress": `${props.duration > (props.startTime ?? 0)
            ? ((props.currentTime - (props.startTime ?? 0)) / (props.duration - (props.startTime ?? 0))) * 100
            : 0}%`,
        } as React.CSSProperties}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={locked}
          onClick={props.onTogglePlay}
          aria-label={props.playing ? "Pause" : "Play"}
          className={cn(controlClass, "w-9 px-0 text-base")}
        >
          {props.playing ? "Ⅱ" : "▶"}
        </button>
        <span className="min-w-[76px] text-[10px] font-bold tabular-nums text-white/70">
          {formatTime(props.currentTime)} / {formatTime(props.duration)}
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={props.onToggleMute}
          aria-label={props.muted ? "Unmute" : "Mute"}
          className={cn(controlClass, "w-9 px-0")}
        >
          {props.muted ? "🔇" : <IconVolume className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={props.muted ? 0 : props.volume}
          disabled={locked}
          onChange={(event) => props.onVolume(Number(event.target.value))}
          aria-label="Volume"
          className="lesson-video-range hidden w-20 sm:block"
          style={{ "--video-progress": `${(props.muted ? 0 : props.volume) * 100}%` } as React.CSSProperties}
        />
        <select
          value={props.playbackRate}
          disabled={locked}
          onChange={(event) => props.onRate(Number(event.target.value))}
          aria-label="Playback speed"
          className={controlClass}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <option key={rate} value={rate} className="bg-slate-950">{rate}×</option>
          ))}
        </select>
        <button
          type="button"
          disabled={locked || !props.captionsAvailable}
          onClick={() => props.onCaptions(!props.captions)}
          aria-pressed={props.captions}
          className={cn(
            controlClass,
            props.captions && props.captionsAvailable && "border-sky-300 bg-sky-400/25 text-sky-100",
          )}
        >
          CC
        </button>
        {props.captionLanguages && (
          <label className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/8 px-2 text-[10px] font-bold text-white/65">
            <span className="hidden xl:inline">{t.lessonUnits.videoSubtitleLanguage}</span>
            <select
              value={languages.some((item) => item.code === props.captionLanguage) ? props.captionLanguage : languages[0].code}
              disabled={locked || !props.captionsAvailable}
              onChange={(event) => props.onLanguage(event.target.value)}
              aria-label={t.lessonUnits.videoSubtitleLanguage}
              className="max-w-28 bg-transparent font-extrabold text-white outline-none disabled:opacity-45"
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code} className="bg-slate-950">
                  {language.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {props.qualityLevels && (
          <label className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/8 px-2 text-[10px] font-bold text-white/65">
            <span className="hidden xl:inline">{t.lessonUnits.videoQuality}</span>
            <select
              value={qualities.includes(props.quality) ? props.quality : "auto"}
              disabled={locked}
              onChange={(event) => props.onQuality(event.target.value)}
              aria-label={t.lessonUnits.videoQuality}
              className="bg-transparent font-extrabold text-white outline-none disabled:opacity-45"
            >
              {qualities.map((level) => (
                <option key={level} value={level} className="bg-slate-950">
                  {QUALITY_LABELS[level] ?? level}
                </option>
              ))}
            </select>
          </label>
        )}
        {!props.teacher && (
          <span className="ml-auto hidden items-center gap-1 text-[10px] font-bold text-white/45 sm:flex">
            <span aria-hidden>🔒</span>
            {t.lessonUnits.videoControlledByTeacher}
          </span>
        )}
        {props.syncError && (
          <span className="text-[10px] font-semibold text-rose-300">{props.syncError}</span>
        )}
        <button
          type="button"
          onClick={props.onFullscreen}
          aria-label={t.lessonUnits.videoFullscreen}
          title={t.lessonUnits.videoFullscreen}
          className={cn(controlClass, props.teacher ? "ml-auto" : "ml-auto", "w-9 px-0 text-lg")}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}

function requestPlayerFullscreen(element: HTMLElement | null) {
  if (!element) return;
  const candidate = element as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  if (candidate.requestFullscreen) void candidate.requestFullscreen();
  else void candidate.webkitRequestFullscreen?.();
}

function LocalVideoPlayer({
  src,
  teacher,
  session,
}: {
  src: string;
  teacher: boolean;
  session?: LessonVideoSession;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(session?.state?.muted ?? false);
  const [volume, setVolume] = useState(session?.state?.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState(session?.state?.playbackRate ?? 1);
  const [captions, setCaptions] = useState(session?.state?.captions ?? true);
  const [hasCaptions, setHasCaptions] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const assignmentId = session?.assignmentId;
  const canSync = session?.teacher === true;

  const publish = useCallback((patch: Partial<LessonVideoUpdate> = {}) => {
    const element = player.current;
    if (!canSync || !assignmentId || !element) return;
    const update: LessonVideoUpdate = {
      currentTime: element.currentTime || 0,
      playing: !element.paused && !element.ended,
      captions,
      muted: element.muted,
      volume: element.volume,
      playbackRate: element.playbackRate,
      captionLanguage: "en",
      quality: "auto",
      ...patch,
    };
    void syncLessonVideoAction(assignmentId, update).then((result) => {
      setSyncError(result.error ?? null);
    });
  }, [assignmentId, canSync, captions]);

  const schedulePublish = useCallback(() => {
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => publish(), 180);
  }, [publish]);

  const applyCaptions = useCallback((enabled: boolean) => {
    const tracks = player.current?.textTracks;
    if (!tracks) return;
    for (let index = 0; index < tracks.length; index += 1) {
      // The media TextTrack list is an imperative browser API, not React state.
      // eslint-disable-next-line react-hooks/immutability
      tracks[index].mode = enabled && index === 0 ? "showing" : "disabled";
    }
    setHasCaptions(tracks.length > 0);
  }, []);

  const applyStudentState = useCallback((state: ClassVideoState) => {
    const element = player.current;
    if (!element) return;
    element.volume = state.volume;
    element.playbackRate = state.playbackRate;
    if (state.muted) element.muted = true;
    else element.muted = false;
    setVolume(state.volume);
    setMuted(state.muted);
    setPlaybackRate(state.playbackRate);
    setCaptions(state.captions);
    applyCaptions(state.captions);
    const expected = Math.min(expectedClassVideoTime(state), Number.isFinite(element.duration) ? element.duration : Infinity);
    if (Math.abs(element.currentTime - expected) > 0.65) element.currentTime = expected;
    if (!state.playing) {
      element.pause();
      return;
    }
    void element.play().catch(async () => {
      const wantedMuted = state.muted;
      element.muted = true;
      try {
        await element.play();
        element.muted = wantedMuted;
      } catch {
        /* The next class tick tries again; the student still cannot take control. */
      }
    });
  }, [applyCaptions]);

  useEffect(() => {
    if (!session || session.teacher || !session.state) return;
    applyStudentState(session.state);
  }, [applyStudentState, session]);

  useEffect(() => () => {
    if (publishTimer.current) clearTimeout(publishTimer.current);
  }, []);

  const togglePlay = () => {
    const element = player.current;
    if (!teacher || !element) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  return (
    <div ref={shell} className="lesson-video-player overflow-hidden bg-black">
      <div className="relative aspect-video bg-black">
        <video
          ref={player}
          src={src}
          controls={false}
          preload="metadata"
          playsInline
          onLoadedMetadata={() => {
            const element = player.current;
            if (!element) return;
            setDuration(element.duration || 0);
            setVolume(element.volume);
            setMuted(element.muted);
            setPlaybackRate(element.playbackRate);
            applyCaptions(captions);
            if (!teacher && session?.state) applyStudentState(session.state);
          }}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
          onPlay={() => {
            setPlaying(true);
            publish({ playing: true });
          }}
          onPause={() => {
            setPlaying(false);
            publish({ playing: false });
          }}
          onEnded={() => {
            setPlaying(false);
            publish({ playing: false });
          }}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          disabled={!teacher}
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-transparent transition",
            teacher ? "cursor-pointer" : "cursor-default",
          )}
        >
          {!playing && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-slate-950/70 pl-1 text-2xl text-white shadow-2xl backdrop-blur-md sm:h-16 sm:w-16">
              ▶
            </span>
          )}
        </button>
      </div>
      <PlayerControls
        teacher={teacher}
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        muted={muted}
        volume={volume}
        playbackRate={playbackRate}
        captions={captions}
        captionsAvailable={hasCaptions}
        captionLanguage="en"
        quality="auto"
        syncError={syncError}
        onTogglePlay={togglePlay}
        onSeek={(value) => {
          if (!teacher || !player.current) return;
          player.current.currentTime = value;
          setCurrentTime(value);
          schedulePublish();
        }}
        onToggleMute={() => {
          if (!teacher || !player.current) return;
          player.current.muted = !player.current.muted;
          setMuted(player.current.muted);
          publish();
        }}
        onVolume={(value) => {
          if (!teacher || !player.current) return;
          player.current.volume = value;
          player.current.muted = value === 0;
          setVolume(value);
          setMuted(value === 0);
          schedulePublish();
        }}
        onRate={(value) => {
          if (!teacher || !player.current) return;
          player.current.playbackRate = value;
          setPlaybackRate(value);
          publish();
        }}
        onCaptions={(value) => {
          if (!teacher) return;
          setCaptions(value);
          applyCaptions(value);
          publish({ captions: value });
        }}
        onLanguage={() => {}}
        onQuality={() => {}}
        onFullscreen={() => requestPlayerFullscreen(shell.current)}
      />
    </div>
  );
}

function YouTubeVideoPlayer({
  videoId,
  startAt,
  endAt,
  teacher,
  session,
}: {
  videoId: string;
  startAt: number;
  endAt: number | null;
  teacher: boolean;
  session?: LessonVideoSession;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(session?.state?.muted ?? false);
  const [volume, setVolume] = useState(session?.state?.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState(session?.state?.playbackRate ?? 1);
  const [captions, setCaptions] = useState(session?.state?.captions ?? true);
  const [captionLanguage, setCaptionLanguage] = useState(session?.state?.captionLanguage ?? "en");
  const [quality, setQuality] = useState(session?.state?.quality ?? "auto");
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([
    { code: "en", name: "English" },
  ]);
  const captionOptions = useRef<CaptionOption[]>([]);
  const appliedCaptionKey = useRef("");
  const [hasCaptionTracks, setHasCaptionTracks] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const settings = useRef({ captions, captionLanguage, quality });
  const assignmentId = session?.assignmentId;
  const canSync = session?.teacher === true;

  useEffect(() => {
    settings.current = { captions, captionLanguage, quality };
  }, [captionLanguage, captions, quality]);

  const publish = useCallback((patch: Partial<LessonVideoUpdate> = {}) => {
    const element = player.current;
    if (!canSync || !assignmentId || !element) return;
    const update: LessonVideoUpdate = {
      currentTime: element.getCurrentTime() || 0,
      playing: element.getPlayerState() === 1,
      captions: settings.current.captions,
      muted: element.isMuted(),
      volume: Math.max(0, Math.min(1, element.getVolume() / 100)),
      playbackRate: element.getPlaybackRate() || 1,
      captionLanguage: settings.current.captionLanguage,
      quality: settings.current.quality,
      ...patch,
    };
    void syncLessonVideoAction(assignmentId, update).then((result) => {
      setSyncError(result.error ?? null);
    });
  }, [assignmentId, canSync]);

  const applyCaptions = useCallback((enabled: boolean, language: string) => {
    const element = player.current;
    if (!element) return;
    try {
      if (!enabled) {
        appliedCaptionKey.current = "off";
        element.unloadModule("captions");
        return;
      }
      const candidates = captionOptions.current.filter((item) => item.code === language);
      const selected = candidates.find((item) => !item.automatic) ?? candidates[0];
      const trackId = String(selected?.track.vssId ?? selected?.track.vss_id ?? "");
      const nextKey = selected
        ? `${language || "en"}:${selected.automatic ? "auto" : "manual"}:${trackId}`
        : `${language || "en"}:fallback`;
      if (appliedCaptionKey.current === nextKey) return;
      element.loadModule("captions");
      element.setOption(
        "captions",
        "track",
        selected?.track ?? { languageCode: language || "en" },
      );
      appliedCaptionKey.current = nextKey;
    } catch {
      /* A video without captions simply leaves CC unavailable. */
    }
  }, []);

  const refreshOptions = useCallback((element: YouTubePlayer) => {
    try {
      const raw = element.getOption("captions", "tracklist");
      if (Array.isArray(raw)) {
        const candidates = raw.flatMap((item: YouTubeTrack): CaptionOption[] => {
          const code = String(item?.languageCode ?? "").trim();
          if (!code) return [];
          const automatic = isAutomaticTrack(item);
          const baseName = trackName(item, code);
          return [{
            code,
            name: automatic && !/auto/i.test(baseName) ? `${baseName} (auto)` : baseName,
            automatic,
            track: item,
          }];
        });
        const preferredByLanguage = new Map<string, CaptionOption>();
        for (const candidate of candidates) {
          const key = candidate.code.toLowerCase();
          const current = preferredByLanguage.get(key);
          if (!current || (current.automatic && !candidate.automatic)) {
            preferredByLanguage.set(key, candidate);
          }
        }
        const next = [...preferredByLanguage.values()];
        if (next.length > 0) {
          captionOptions.current = next;
          setHasCaptionTracks(true);
          setLanguages(next.map(({ code, name }) => ({ code, name })));
          const current = settings.current.captionLanguage;
          const wantsEnglish = current.toLowerCase().startsWith("en");
          const selected = next.find((item) => item.code === current && !item.automatic)
            ?? (wantsEnglish
              ? next.find((item) => item.code.toLowerCase().startsWith("en") && !item.automatic)
              : undefined)
            ?? next.find((item) => item.code === current)
            ?? next.find((item) => item.code.toLowerCase().startsWith("en"))
            ?? next[0];
          settings.current.captionLanguage = selected.code;
          setCaptionLanguage(selected.code);
          if (settings.current.captions) applyCaptions(true, selected.code);
        } else if (settings.current.captions) setHasCaptionTracks(false);
      }
    } catch {
      /* Some videos expose captions only after playback starts. */
    }
    try {
      const next = element.getAvailableQualityLevels().filter(Boolean);
      setQualityLevels((current) => current.join("|") === next.join("|") ? current : next);
    } catch {
      /* Quality is allowed to remain automatic. */
    }
  }, [applyCaptions]);

  useEffect(() => {
    const target = mount.current;
    if (!target) return;
    let alive = true;
    let instance: YouTubePlayer | null = null;
    captionOptions.current = [];
    appliedCaptionKey.current = "";
    setReady(false);
    setPlayerError(null);
    loadYouTubeApi()
      .then((YT) => {
        if (!alive || !mount.current) return;
        instance = new YT.Player(mount.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            cc_load_policy: 1,
            cc_lang_pref: "en",
            hl: "en",
            origin: window.location.origin,
            ...(startAt > 0 ? { start: Math.floor(startAt) } : {}),
            ...(endAt !== null ? { end: Math.floor(endAt) } : {}),
          },
          events: {
            onReady: ({ target: loaded }) => {
              if (!alive) return;
              player.current = loaded;
              loaded.getIframe().tabIndex = -1;
              setReady(true);
              setDuration(loaded.getDuration() || 0);
              setVolume(loaded.getVolume() / 100);
              setMuted(loaded.isMuted());
              setPlaybackRate(loaded.getPlaybackRate() || 1);
              const initialTime = loaded.getCurrentTime() || 0;
              if (initialTime < startAt - 0.5 || (endAt !== null && initialTime >= endAt)) {
                loaded.seekTo(startAt, true);
                setCurrentTime(startAt);
              } else {
                setCurrentTime(initialTime);
              }
              applyCaptions(settings.current.captions, settings.current.captionLanguage || "en");
              refreshOptions(loaded);
            },
            onStateChange: ({ data, target: changed }) => {
              if (!alive) return;
              const isPlaying = data === 1;
              setPlaying(isPlaying);
              setCurrentTime(changed.getCurrentTime() || 0);
              setDuration(changed.getDuration() || 0);
              refreshOptions(changed);
              if (teacher) publish({ playing: isPlaying });
            },
            onApiChange: ({ target: changed }) => refreshOptions(changed),
            onError: ({ data }) => setPlayerError(`YouTube error ${data}`),
          },
        });
        player.current = instance;
      })
      .catch(() => alive && setPlayerError("YouTube player could not load"));
    return () => {
      alive = false;
      player.current = null;
      instance?.destroy();
    };
  }, [applyCaptions, endAt, publish, refreshOptions, startAt, teacher, videoId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      const element = player.current;
      if (!element) return;
      const time = element.getCurrentTime() || 0;
      if (endAt !== null && time >= endAt - 0.08) {
        element.pauseVideo();
        element.seekTo(endAt, true);
        setCurrentTime(endAt);
        setPlaying(false);
        if (teacher) publish({ currentTime: endAt, playing: false });
      } else {
        setCurrentTime(Math.max(startAt, time));
      }
      setDuration(element.getDuration() || 0);
      refreshOptions(element);
    }, 300);
    return () => window.clearInterval(timer);
  }, [endAt, publish, ready, refreshOptions, startAt, teacher]);

  useEffect(() => {
    if (!ready || !session || session.teacher || !session.state || !player.current) return;
    const state = session.state;
    const element = player.current;
    setCaptions(state.captions);
    setCaptionLanguage(state.captionLanguage);
    setQuality(state.quality);
    setMuted(state.muted);
    setVolume(state.volume);
    setPlaybackRate(state.playbackRate);
    element.setVolume(state.volume * 100);
    if (state.muted) element.mute();
    else element.unMute();
    element.setPlaybackRate(state.playbackRate);
    element.setPlaybackQuality(state.quality === "auto" ? "default" : state.quality);
    applyCaptions(state.captions, state.captionLanguage || "en");
    const clipEnd = endAt ?? (element.getDuration() || Infinity);
    const expected = Math.max(startAt, Math.min(expectedClassVideoTime(state), clipEnd));
    if (Math.abs(element.getCurrentTime() - expected) > 0.9) element.seekTo(expected, true);
    if (state.playing) element.playVideo();
    else element.pauseVideo();
  }, [applyCaptions, endAt, ready, session, startAt]);

  const togglePlay = () => {
    if (!teacher || !player.current) return;
    if (player.current.getPlayerState() === 1) player.current.pauseVideo();
    else {
      const time = player.current.getCurrentTime() || 0;
      if (time < startAt || (endAt !== null && time >= endAt - 0.15)) {
        player.current.seekTo(startAt, true);
        setCurrentTime(startAt);
      }
      player.current.playVideo();
    }
  };

  const captionsAvailable = hasCaptionTracks;

  return (
    <div ref={shell} className="lesson-video-player overflow-hidden bg-black">
      <div className="relative aspect-video overflow-hidden bg-black">
        <div ref={mount} className="h-full w-full" />
        <button
          type="button"
          disabled={!teacher || !ready}
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-transparent transition",
            teacher ? "cursor-pointer" : "cursor-default",
          )}
        >
          {!playing && !playerError && (
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-slate-950/70 pl-1 text-2xl text-white shadow-2xl backdrop-blur-md sm:h-16 sm:w-16">
              ▶
            </span>
          )}
        </button>
        {playerError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-5 text-center text-sm font-bold text-rose-300">
            {playerError}
          </div>
        )}
      </div>
      <PlayerControls
        teacher={teacher}
        playing={playing}
        startTime={startAt}
        currentTime={currentTime}
        duration={endAt ?? duration}
        muted={muted}
        volume={volume}
        playbackRate={playbackRate}
        captions={captions}
        captionsAvailable={captionsAvailable}
        captionLanguage={captionLanguage}
        captionLanguages={languages}
        quality={quality}
        qualityLevels={qualityLevels}
        syncError={syncError}
        onTogglePlay={togglePlay}
        onSeek={(value) => {
          if (!teacher || !player.current) return;
          player.current.seekTo(value, true);
          setCurrentTime(value);
          publish({ currentTime: value });
        }}
        onToggleMute={() => {
          if (!teacher || !player.current) return;
          if (player.current.isMuted()) player.current.unMute();
          else player.current.mute();
          const next = player.current.isMuted();
          setMuted(next);
          publish({ muted: next });
        }}
        onVolume={(value) => {
          if (!teacher || !player.current) return;
          player.current.setVolume(value * 100);
          if (value > 0) player.current.unMute();
          setVolume(value);
          setMuted(value === 0);
          publish({ volume: value, muted: value === 0 });
        }}
        onRate={(value) => {
          if (!teacher || !player.current) return;
          player.current.setPlaybackRate(value);
          setPlaybackRate(value);
          publish({ playbackRate: value });
        }}
        onCaptions={(value) => {
          if (!teacher) return;
          setCaptions(value);
          applyCaptions(value, captionLanguage);
          publish({ captions: value });
        }}
        onLanguage={(value) => {
          if (!teacher) return;
          setCaptionLanguage(value);
          setCaptions(true);
          applyCaptions(true, value);
          publish({ captions: true, captionLanguage: value });
        }}
        onQuality={(value) => {
          if (!teacher || !player.current) return;
          setQuality(value);
          player.current.setPlaybackQuality(value === "auto" ? "default" : value);
          publish({ quality: value });
        }}
        onFullscreen={() => requestPlayerFullscreen(shell.current)}
      />
    </div>
  );
}

async function resetSharedVideo(session?: LessonVideoSession, currentTime = 0) {
  if (!session?.teacher) return;
  await syncLessonVideoAction(session.assignmentId, {
    currentTime,
    playing: false,
    captions: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    captionLanguage: "en",
    quality: "auto",
  });
}

function LessonVideoPlayerState({
  lessonId,
  url,
  title,
  teacher,
  session,
}: {
  lessonId: string;
  url: string | null;
  title: string | null;
  teacher: boolean;
  session?: LessonVideoSession;
}) {
  const { t } = useT();
  const [activeUrl, setActiveUrl] = useState(url ?? "");
  const [activeTitle, setActiveTitle] = useState(title ?? "");
  const parsed = useMemo(() => parseLessonVideoSource(activeUrl), [activeUrl]);
  const [mode, setMode] = useState<"local" | "youtube">(
    parsed?.kind === "youtube" ? "youtube" : "local",
  );
  const [youtubeUrl, setYoutubeUrl] = useState(parsed?.kind === "youtube" ? activeUrl : "");
  const [clipFrom, setClipFrom] = useState(
    parsed?.kind === "youtube" ? formatEditorTime(parsed.startAt) : "0:00",
  );
  const [clipTo, setClipTo] = useState(
    parsed?.kind === "youtube" ? formatEditorTime(parsed.endAt) : "",
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, startTransition] = useTransition();

  const connectYoutube = () => {
    const next = parseLessonVideoSource(youtubeUrl);
    if (next?.kind !== "youtube") {
      setError(t.lessonUnits.videoInvalidYoutube);
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const nextTitle = activeTitle || "YouTube video";
      const result = await saveLessonAction(lessonId, {
        videoUrl: youtubeUrl.trim(),
        videoTitle: nextTitle,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setActiveUrl(youtubeUrl.trim());
      setActiveTitle(nextTitle);
      setClipFrom(formatEditorTime(next.startAt));
      setClipTo(formatEditorTime(next.endAt));
      setSaved(true);
      await resetSharedVideo(session, next.startAt);
    });
  };

  const saveClip = () => {
    if (parsed?.kind !== "youtube") return;
    const startAt = clipFrom.trim() ? parseEditorTime(clipFrom) : 0;
    const endAt = parseEditorTime(clipTo);
    if (startAt === null || (clipTo.trim() && endAt === null) || (endAt !== null && endAt <= startAt)) {
      setError(t.lessonUnits.videoClipInvalid);
      return;
    }
    const clippedUrl = withYouTubeClip(activeUrl, startAt, endAt);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveLessonAction(lessonId, {
        videoUrl: clippedUrl,
        videoTitle: activeTitle || "YouTube video",
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setActiveUrl(clippedUrl);
      setYoutubeUrl(clippedUrl);
      setClipFrom(formatEditorTime(startAt));
      setClipTo(formatEditorTime(endAt));
      setSaved(true);
      await resetSharedVideo(session, startAt);
    });
  };

  const uploadLocal = async (file: File) => {
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const suppliedExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const byMime: Record<string, string> = {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/ogg": "ogv",
        "video/quicktime": "mov",
        "video/x-m4v": "m4v",
      };
      const allowed = new Set(["mp4", "webm", "ogv", "ogg", "mov", "m4v"]);
      const extension = allowed.has(suppliedExtension) ? suppliedExtension : byMime[file.type];
      if (!extension) throw new Error(t.lessonUnits.videoUploadFailed);
      const nextTitle = file.name.replace(/\.[^.]+$/, "").trim() || "Video";
      const blob = await upload(
        `uploads/lesson-videos/${lessonId}-${crypto.randomUUID()}.${extension}`,
        file,
        {
          access: "public",
          handleUploadUrl: `/api/lesson-video/${lessonId}`,
          clientPayload: JSON.stringify({ lessonId, title: nextTitle }),
          multipart: true,
        },
      );
      const response = await fetch(`/api/lesson-video/${lessonId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: blob.url, title: nextTitle }),
      });
      const result = (await response.json()) as { url?: string; title?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? t.lessonUnits.videoUploadFailed);
      setActiveUrl(result.url);
      setActiveTitle(result.title ?? nextTitle);
      setMode("local");
      setSaved(true);
      await resetSharedVideo(session);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t.lessonUnits.videoUploadFailed);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="overflow-hidden bg-slate-950">
      {teacher && (
        <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/7 p-1 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => setMode("local")}
                className={cn(
                  "h-8 rounded-lg px-3 text-[11px] font-extrabold transition",
                  mode === "local" ? "bg-blue-500 text-white shadow-lg" : "text-white/55 hover:text-white",
                )}
              >
                {t.lessonUnits.videoLocalMode}
              </button>
              <button
                type="button"
                onClick={() => setMode("youtube")}
                className={cn(
                  "h-8 rounded-lg px-3 text-[11px] font-extrabold transition",
                  mode === "youtube" ? "bg-rose-500 text-white shadow-lg" : "text-white/55 hover:text-white",
                )}
              >
                {t.lessonUnits.videoYoutubeMode}
              </button>
            </div>
            {mode === "local" ? (
              <>
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-blue-500 px-3 text-[11px] font-extrabold text-white transition hover:bg-blue-400">
                  <span aria-hidden>⇧</span>
                  {uploading
                    ? t.lessonUnits.videoUploading
                    : parsed?.kind === "file"
                      ? t.lessonUnits.videoReplaceFile
                      : t.lessonUnits.videoUpload}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,.m4v"
                    disabled={uploading}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void uploadLocal(file);
                    }}
                  />
                </label>
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white/45">
                  {parsed?.kind === "file" ? activeTitle || t.lessonUnits.videoLocalReady : "MP4 · WebM · MOV · M4V"}
                </span>
              </>
            ) : (
              <>
                <input
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && connectYoutube()}
                  placeholder={t.lessonUnits.videoYoutubePlaceholder}
                  className="h-9 min-w-48 flex-1 rounded-xl border border-white/12 bg-white/7 px-3 text-[11px] font-semibold text-white outline-none placeholder:text-white/30 focus:border-rose-400"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={connectYoutube}
                  className="h-9 rounded-xl bg-rose-500 px-4 text-[11px] font-extrabold text-white transition hover:bg-rose-400 disabled:opacity-50"
                >
                  {busy ? t.lessonUnits.videoConnecting : t.lessonUnits.videoConnect}
                </button>
              </>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                <IconCheck className="h-3.5 w-3.5" />
                {t.lessonUnits.saved}
              </span>
            )}
          </div>
          {mode === "youtube" && parsed?.kind === "youtube" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/8 pt-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/45">
                {t.lessonUnits.videoClip}
              </span>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/55">
                {t.lessonUnits.videoClipFrom}
                <input
                  value={clipFrom}
                  inputMode="numeric"
                  onChange={(event) => setClipFrom(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && saveClip()}
                  placeholder="0:00"
                  className="h-8 w-[74px] rounded-lg border border-white/12 bg-white/7 px-2 text-center font-extrabold text-white outline-none placeholder:text-white/25 focus:border-sky-400"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-white/55">
                {t.lessonUnits.videoClipTo}
                <input
                  value={clipTo}
                  inputMode="numeric"
                  onChange={(event) => setClipTo(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && saveClip()}
                  placeholder={t.lessonUnits.videoClipFull}
                  className="h-8 w-[86px] rounded-lg border border-white/12 bg-white/7 px-2 text-center font-extrabold text-white outline-none placeholder:text-white/25 focus:border-sky-400"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={saveClip}
                className="h-8 rounded-lg bg-sky-500 px-3 text-[10px] font-extrabold text-white transition hover:bg-sky-400 disabled:opacity-50"
              >
                {t.lessonUnits.videoClipApply}
              </button>
              <span className="text-[10px] font-semibold text-white/35">0:00 · 1:25 · 1:02:30</span>
            </div>
          )}
          {error && <p className="mt-2 text-[11px] font-semibold text-rose-300">{error}</p>}
        </div>
      )}

      {!parsed ? (
        <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,_#1e3a8a55,_#020617_68%)] p-5 text-center">
          <div>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 text-blue-300 ring-1 ring-white/10">
              <IconVideo className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-bold text-white/55">{t.lessonUnits.videoSoon}</p>
          </div>
        </div>
      ) : parsed.kind === "youtube" ? (
        <YouTubeVideoPlayer
          videoId={parsed.videoId}
          startAt={parsed.startAt}
          endAt={parsed.endAt}
          teacher={teacher}
          session={session}
        />
      ) : parsed.kind === "file" ? (
        <LocalVideoPlayer src={parsed.src} teacher={teacher} session={session} />
      ) : (
        <div className="p-5 text-center text-sm font-bold text-rose-300">
          {teacher ? t.lessonUnits.videoInvalidYoutube : t.lessonUnits.videoSoon}
        </div>
      )}
    </div>
  );
}

export function LessonVideoPlayer(props: {
  lessonId: string;
  url: string | null;
  title: string | null;
  teacher: boolean;
  session?: LessonVideoSession;
}) {
  return (
    <LessonVideoPlayerState
      key={`${props.url ?? ""}\u0000${props.title ?? ""}`}
      {...props}
    />
  );
}
