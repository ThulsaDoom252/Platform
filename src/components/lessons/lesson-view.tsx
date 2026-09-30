"use client";

/**
 * Урок глазами ученика.
 *
 * Открыт всегда только словник — с него урок и начинается. Остальные
 * секции появляются, когда учитель их откроет: список вкладок растёт по
 * ходу занятия, а не встречает ученика пятью закрытыми дверями.
 *
 * Подсветки приходят из закрепления, а не из урока: у каждого ученика
 * подчёркнуто своё, и заготовка от этого не меняется.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { useLocalNumber } from "@/lib/use-local-number";
import {
  lineKey,
  lexisBlockKey,
  lineWordKey,
  lineWords,
  parseKey,
  speakerTint,
  speakersOf,
  type LessonSection,
} from "@/lib/lesson-unit";
import { LessonVocab } from "@/components/lessons/lesson-vocab";
import { RuleReader } from "@/components/materials/rule-reader";
import {
  focusLessonVideoAction,
  syncLessonVideoAction,
  type LessonView as Lesson,
  type LessonVideoUpdate,
} from "@/lib/actions/lessons";
import { IconEye, IconEyeOff } from "@/components/icons";
import { cn } from "@/lib/utils";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import {
  expectedClassVideoTime,
  type ClassVideoState,
} from "@/lib/class-video";

export type LessonViewProps = {
  lesson: Lesson;
  /** Какие секции показывать. */
  open: LessonSection[];
  /**
   * Что из показанного закрыто ученику.
   *
   * Учителю показываем все секции: подсветить место в закрытой секции
   * надо до того, как её откроют, а не после. Но какие ученик видит, а
   * какие нет — должно быть написано.
   */
  closed?: LessonSection[];
  highlights: Record<string, string>;
  /** Куда смотреть прямо сейчас — ключ места из lesson-unit. */
  focus?: string | null;
  /** Нажатие по месту: учителю — подсветить, ученику ничего. */
  onPick?: (key: string) => void;
  /** В диалоге клики ставят независимые жёлтые выделения. */
  highlightMode?: boolean;
  onHighlight?: (key: string) => void;
  /** Показать ученику UK-звук и UK-транскрипцию одиночных слов. */
  showBritish?: boolean;
  /** Какая лексическая группа сейчас выбрана учителем для ученика. */
  selectedLexisId?: string | null;
  onSelectLexis?: (groupId: string) => void;
  /** Общий плеер существует только внутри живого класса. */
  videoSession?: {
    assignmentId: string;
    teacher: boolean;
    state: ClassVideoState | null;
  };
};

/** Сколько секций держать на экране разом. */
const PANELS_KEY = "lingora.lesson.panels";
const MAX_PANELS = 4;

export function LessonView({
  lesson,
  open,
  closed,
  highlights,
  focus,
  onPick,
  highlightMode = false,
  onHighlight,
  showBritish = false,
  selectedLexisId,
  onSelectLexis,
  videoSession,
}: LessonViewProps) {
  const { t } = useT();
  /*
   * Сколько окон показывать разом — привычка человека, а не свойство
   * урока, поэтому живёт в браузере. На телефоне выбор не действует:
   * второе окно там ничего не добавляет, только режет первое пополам.
   */
  const [panels, setPanels] = useLocalNumber(PANELS_KEY, 1);
  const shown = Math.min(Math.max(1, panels), MAX_PANELS, open.length);

  /** Что стоит в каждом окне. Первое окно ведёт себя как вкладки. */
  const [picked, setPicked] = useState<LessonSection[]>([]);

  const LABEL: Record<LessonSection, string> = {
    vocab: t.lessonUnits.secVocab,
    lexis: t.lessonUnits.secLexis,
    video: t.lessonUnits.secVideo,
    transcript: t.lessonUnits.secTranscript,
    questions: t.lessonUnits.secQuestions,
    homework: t.lessonUnits.secHomework,
  };

  /*
   * Окна добираются по порядку урока: открыл второе — рядом встаёт
   * следующая секция, а не пустое место, которое надо заполнять руками.
   */
  const slots: LessonSection[] = [];
  for (let i = 0; i < shown; i++) {
    const wanted = picked[i];
    const fallback = open.filter((s) => !slots.includes(s))[0] ?? open[0];
    slots.push(wanted && open.includes(wanted) && !slots.includes(wanted) ? wanted : fallback);
  }

  const parsedFocus = focus ? parseKey(focus) : null;
  const focusSection =
    parsedFocus?.kind === "word"
      ? "vocab"
      : parsedFocus?.kind === "lexisBlock"
        ? "lexis"
      : parsedFocus?.kind === "line" || parsedFocus?.kind === "lineWord"
        ? "transcript"
        : null;
  const focusSectionOpen = !!focusSection && open.includes(focusSection);
  const lexisSectionOpen = open.includes("lexis");
  const videoFocusAt = videoSession?.state?.focusAt;

  /*
   * Новый фокус один раз приводит ученика в нужную секцию. Дальше его
   * собственный клик по вкладке имеет приоритет: периодическое обновление
   * класса больше не возвращает его насильно к старому фокусу.
   */
  useEffect(() => {
    if (!focus || !focusSection || !focusSectionOpen) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => {
        if (current.includes(focusSection)) return current;
        const next = [...current];
        next[0] = focusSection;
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus, focusSection, focusSectionOpen]);

  // Выбор учителем лексической группы приводит ученика в секцию Lexis.
  useEffect(() => {
    if (!selectedLexisId || !lexisSectionOpen) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => {
        if (current.includes("lexis")) return current;
        const next = [...current];
        next[0] = "lexis";
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [lexisSectionOpen, selectedLexisId]);

  // Явная команда Focus открывает ученику Video даже поверх другой секции.
  useEffect(() => {
    if (!videoFocusAt || !open.includes("video")) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => {
        if (current.includes("video")) return current;
        const next = [...current];
        next[0] = "video";
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, videoFocusAt]);

  const setSlot = (at: number, section: LessonSection) =>
    setPicked(() => {
      const next = [...slots];
      const occupied = next.indexOf(section);
      if (occupied >= 0 && occupied !== at) next[occupied] = next[at];
      next[at] = section;
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Сколько окон. Показываем, только когда есть что раскладывать. */}
      {open.length > 1 && (
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="text-[11px] font-semibold text-faint">
            {t.lessonUnits.panels}
          </span>
          {Array.from({ length: Math.min(MAX_PANELS, open.length) }, (_, i) => i + 1).map(
            (n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPanels(n)}
                className={cn(
                  "h-7 w-7 rounded-lg text-[12px] font-bold transition",
                  shown === n
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-muted hover:text-content",
                )}
              >
                {n}
              </button>
            ),
          )}
        </div>
      )}

      <div
        className={cn(
          "grid gap-3",
          shown === 2 && "lg:grid-cols-2",
          shown === 3 && "lg:grid-cols-3",
          shown === 4 && "lg:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {slots.map((section, at) => (
          <div key={at} className="flex min-w-0 flex-col gap-2">
            {/* Свои вкладки у каждого окна: в нём выбирают, что показать. */}
            <div className="flex flex-wrap gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
              {open.map((key) => {
                const hidden = closed?.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSlot(at, key)}
                    title={hidden ? t.lessonUnits.hiddenFromStudent : undefined}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition",
                      section === key
                        ? "bg-accent text-white"
                        : "text-muted hover:bg-surface-2 hover:text-content",
                      hidden && section !== key && "opacity-50",
                    )}
                  >
                    {LABEL[key]}
                    {hidden && <IconEyeOff className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>

            <div className="min-h-0">
              {section === "vocab" && (
                <LessonVocab
                  words={lesson.words}
                  highlights={highlights}
                  focus={focus}
                  onPick={onPick}
                  showBritish={showBritish}
                />
              )}
              {section === "lexis" &&
                (lesson.lexis.length > 0 ? (
                  <LexisGroups
                    groups={lesson.lexis}
                    selectedId={selectedLexisId}
                    onSelect={onSelectLexis}
                    focus={focus}
                    onPick={onPick}
                    showBritish={showBritish}
                  />
                ) : (
                  <p className="text-sm text-faint">{t.lessonUnits.emptyLexis}</p>
                ))}
              {section === "video" && (
                <Video lesson={lesson} session={videoSession} />
              )}
              {section === "transcript" && (
                <Transcript
                  lines={lesson.transcript}
                  highlights={highlights}
                  focus={focus}
                  onPick={onPick}
                  highlightMode={highlightMode}
                  onHighlight={onHighlight}
                />
              )}
              {section === "questions" && <Questions lesson={lesson} />}
              {section === "homework" && <Homework lesson={lesson} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LexisGroups({
  groups,
  selectedId,
  onSelect,
  focus,
  onPick,
  showBritish,
}: {
  groups: Lesson["lexis"];
  selectedId?: string | null;
  onSelect?: (groupId: string) => void;
  focus?: string | null;
  onPick?: (key: string) => void;
  showBritish: boolean;
}) {
  const { t } = useT();
  const [activeId, setActiveId] = useState(
    groups.some((group) => group.id === selectedId) ? selectedId! : groups[0].id,
  );

  useEffect(() => {
    if (!selectedId || !groups.some((group) => group.id === selectedId)) return;
    const frame = requestAnimationFrame(() => setActiveId(selectedId));
    return () => cancelAnimationFrame(frame);
  }, [groups, selectedId]);

  const parsedFocus = focus ? parseKey(focus) : null;
  const focusedGroup = parsedFocus?.kind === "lexisBlock" ? parsedFocus.groupId : null;
  useEffect(() => {
    if (!focusedGroup || !groups.some((group) => group.id === focusedGroup)) return;
    const frame = requestAnimationFrame(() => setActiveId(focusedGroup));
    return () => cancelAnimationFrame(frame);
  }, [focusedGroup, groups]);

  const active = groups.find((group) => group.id === activeId) ?? groups[0];
  const choose = (groupId: string) => {
    setActiveId(groupId);
    onSelect?.(groupId);
  };
  const focusedBlock =
    parsedFocus?.kind === "lexisBlock" && parsedFocus.groupId === active.id
      ? parsedFocus.block
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-surface p-1.5 ring-1 ring-line">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => choose(group.id)}
              className={cn(
                "min-h-9 rounded-xl px-3 text-[12px] font-bold transition",
                active.id === group.id
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-content",
              )}
            >
              {group.title}
            </button>
          ))}
        </div>
      )}
      <RuleReader
        title={active.title}
        icon="🔀"
        description={active.intro}
        blocks={active.blocks}
        showBritish={showBritish}
        focusedBlock={focusedBlock}
        onBlockPick={onPick ? (block) => onPick(lexisBlockKey(active.id, block)) : undefined}
        focusLabel={t.lessonUnits.focusLexisItem}
      />
    </div>
  );
}

/**
 * Чем показывать ссылку.
 *
 * YouTube идёт своим плеером, обычный файл — родным браузерным: у него
 * есть и перемотка, и скорость, и громкость, и полный экран. Всё
 * остальное — просто ссылка: чужой плеер в iframe может и не открыться,
 * а битый кадр вместо видео посреди урока хуже честной ссылки.
 */
const VIDEO_FILE = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i;

export function videoSource(
  url: string,
): { kind: "youtube" | "file" | "link"; src: string } {
  const raw = String(url ?? "").trim();

  try {
    const u = new URL(raw);
    if (u.hostname === "youtu.be" && u.pathname.length > 1) {
      return { kind: "youtube", src: `https://www.youtube.com/embed${u.pathname}` };
    }
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return { kind: "youtube", src: `https://www.youtube.com/embed/${id}` };
      if (u.pathname.startsWith("/embed/")) return { kind: "youtube", src: u.toString() };
    }
    if (VIDEO_FILE.test(u.pathname)) return { kind: "file", src: raw };
    return { kind: "link", src: raw };
  } catch {
    // Не адрес целиком, а путь вроде /uploads/video/lesson.mp4 — тоже файл.
    if (VIDEO_FILE.test(raw)) return { kind: "file", src: raw };
    return { kind: "link", src: raw };
  }
}

function Video({
  lesson,
  session,
}: {
  lesson: Lesson;
  session?: LessonViewProps["videoSession"];
}) {
  const { t } = useT();
  const video = lesson.videoUrl ? videoSource(lesson.videoUrl) : null;
  const [focusError, setFocusError] = useState<string | null>(null);
  const [focusBusy, startFocus] = useTransition();

  const focusStudent = () => {
    if (!session?.teacher) return;
    setFocusError(null);
    startFocus(async () => {
      const result = await focusLessonVideoAction(session.assignmentId);
      if (result.error) setFocusError(result.error);
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {(lesson.videoTitle || (session?.teacher && video)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          {lesson.videoTitle && (
            <p className="mr-auto text-sm font-semibold text-content">
              {lesson.videoTitle}
            </p>
          )}
          {session?.teacher && video && (
            <button
              type="button"
              disabled={focusBusy}
              onClick={focusStudent}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              <IconEye className="h-3.5 w-3.5" />
              {t.lessonUnits.focusVideo}
            </button>
          )}
          {focusError && <p className="w-full text-[12px] text-rose-500">{focusError}</p>}
        </div>
      )}

      {!video ? (
        /* Видео ещё нет: место под него уже стоит, чтобы урок не прыгал. */
        <div className="flex aspect-video w-full items-center justify-center bg-surface-2">
          <p className="text-sm text-faint">{t.lessonUnits.videoSoon}</p>
        </div>
      ) : video.kind === "youtube" ? (
        <iframe
          src={video.src}
          title={lesson.videoTitle ?? "video"}
          allowFullScreen
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          className="aspect-video w-full border-0"
        />
      ) : video.kind === "file" ? (
        <NativeClassVideo src={video.src} session={session} />
      ) : (
        <a
          href={video.src}
          target="_blank"
          rel="noreferrer"
          className="block px-4 py-6 text-sm font-semibold text-accent underline"
        >
          {video.src}
        </a>
      )}
    </section>
  );
}

function NativeClassVideo({
  src,
  session,
}: {
  src: string;
  session?: LessonViewProps["videoSession"];
}) {
  const { t } = useT();
  const player = useRef<HTMLVideoElement>(null);
  const [captions, setCaptions] = useState(session?.state?.captions ?? true);
  const [hasCaptions, setHasCaptions] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [, startSync] = useTransition();

  const applyCaptions = useCallback((enabled: boolean) => {
    const tracks = player.current?.textTracks;
    if (!tracks) return;
    for (let index = 0; index < tracks.length; index += 1) {
      tracks[index].mode = enabled && index === 0 ? "showing" : "disabled";
    }
    setHasCaptions(tracks.length > 0);
  }, []);

  const publish = useCallback((patch: Partial<LessonVideoUpdate> = {}) => {
    if (!session?.teacher || !player.current) return;
    const element = player.current;
    const update: LessonVideoUpdate = {
      currentTime: element.currentTime || 0,
      playing: !element.paused && !element.ended,
      captions,
      muted: element.muted,
      volume: element.volume,
      playbackRate: element.playbackRate,
      ...patch,
    };
    startSync(async () => {
      const result = await syncLessonVideoAction(session.assignmentId, update);
      setSyncError(result.error ?? null);
    });
  }, [captions, session]);

  const applyStudentState = useCallback((state: ClassVideoState) => {
    const element = player.current;
    if (!element) return;

    element.muted = state.muted;
    element.volume = state.volume;
    element.playbackRate = state.playbackRate;
    setCaptions(state.captions);
    applyCaptions(state.captions);

    const expected = expectedClassVideoTime(state);
    const capped = Number.isFinite(element.duration)
      ? Math.min(expected, element.duration)
      : expected;
    if (Math.abs(element.currentTime - capped) > 0.65) element.currentTime = capped;

    if (!state.playing) {
      element.pause();
      setPlayBlocked(false);
      return;
    }
    void element.play().then(
      () => setPlayBlocked(false),
      () => setPlayBlocked(true),
    );
  }, [applyCaptions]);

  // Ученик не управляет общим состоянием: каждый новый такт класса
  // выравнивает позицию и повторяет Play/Pause учителя.
  useEffect(() => {
    if (!session || session.teacher || !session.state) return;
    const state = session.state;
    const frame = requestAnimationFrame(() => applyStudentState(state));
    return () => cancelAnimationFrame(frame);
  }, [applyStudentState, session]);

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    const tracks = element.textTracks;
    const refresh = () => applyCaptions(captions);
    refresh();
    tracks.addEventListener("addtrack", refresh);
    tracks.addEventListener("removetrack", refresh);
    return () => {
      tracks.removeEventListener("addtrack", refresh);
      tracks.removeEventListener("removetrack", refresh);
    };
  }, [applyCaptions, captions]);

  const toggleCaptions = () => {
    const next = !captions;
    setCaptions(next);
    applyCaptions(next);
    publish({ captions: next });
  };

  const unlockPlayback = () => {
    if (!session?.state || !player.current) return;
    applyStudentState(session.state);
  };

  return (
    <div className="relative bg-black">
      {session?.teacher && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-950 px-3 py-2">
          <button
            type="button"
            onClick={toggleCaptions}
            disabled={!hasCaptions}
            aria-pressed={captions && hasCaptions}
            className={cn(
              "h-8 rounded-lg px-3 text-[11px] font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-45",
              captions && hasCaptions
                ? "bg-white text-slate-950 ring-white"
                : "text-white ring-white/25 hover:bg-white/10",
            )}
          >
            CC · {hasCaptions
              ? captions
                ? t.lessonUnits.captionsOn
                : t.lessonUnits.captionsOff
              : t.lessonUnits.noCaptions}
          </button>
          <span className="text-[11px] text-white/55">
            {t.lessonUnits.videoSyncHint}
          </span>
          {syncError && <span className="text-[11px] text-rose-400">{syncError}</span>}
        </div>
      )}
      <video
        ref={player}
        src={src}
        controls={!session || session.teacher}
        controlsList="nodownload"
        preload="metadata"
        playsInline
        onLoadedMetadata={() => {
          applyCaptions(captions);
          if (session?.teacher) publish({ captions });
          else if (session?.state) applyStudentState(session.state);
        }}
        onPlay={() => publish({ playing: true })}
        onPause={() => publish({ playing: false })}
        onSeeked={() => publish()}
        onRateChange={() => publish()}
        onVolumeChange={() => publish()}
        onEnded={() => publish({ playing: false })}
        className="aspect-video w-full bg-black"
      />
      {playBlocked && !session?.teacher && (
        <button
          type="button"
          onClick={unlockPlayback}
          className="absolute inset-0 flex items-center justify-center bg-black/55 p-5 text-center text-sm font-bold text-white"
        >
          {t.lessonUnits.enableSyncedVideo}
        </button>
      )}
    </div>
  );
}

function Transcript({
  lines,
  highlights,
  focus,
  onPick,
  highlightMode,
  onHighlight,
}: {
  lines: Lesson["transcript"];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
  highlightMode: boolean;
  onHighlight?: (key: string) => void;
}) {
  const { t } = useT();
  const speakers = useMemo(() => speakersOf(lines), [lines]);
  const focusedWord = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!focus || !focusedWord.current) return;
    focusedWord.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  if (lines.length === 0) {
    return <p className="text-sm text-faint">{t.lessonUnits.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const phraseKey = lineKey(i);
        const phraseMarked = highlights[phraseKey];
        return (
          <div
            key={i}
            className={cn(
              "relative rounded-2xl bg-surface p-3 ring-1 ring-line transition",
              highlightMode && "pr-24",
              phraseMarked && "bg-yellow-300 ring-yellow-500/70",
            )}
          >
            <span
              className={cn(
                "mr-2 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                speakerTint(speakers, line.speaker),
              )}
            >
              {line.speaker || "—"}
            </span>

            {/* По слову: подсветить можно и отдельное слово реплики. */}
            <span
              className={cn(
                "text-[14px] leading-relaxed",
                phraseMarked ? "text-slate-950" : "text-content",
              )}
            >
              {lineWords(line.text).map((part, at) => {
                if (!part.trim()) return <span key={at}>{part}</span>;
                const wKey = lineWordKey(i, at);
                const wMark = highlights[wKey];
                return (
                  <span
                    key={at}
                    ref={focus === wKey ? focusedWord : undefined}
                    onClick={
                      highlightMode && onHighlight
                        ? () => onHighlight(wKey)
                        : onPick
                          ? () => onPick(wKey)
                          : undefined
                    }
                    className={cn(
                      "rounded px-0.5",
                      (onPick || onHighlight) && "cursor-pointer",
                      highlightMode
                        ? "hover:bg-yellow-200"
                        : onPick && "hover:bg-accent-soft",
                      wMark && "bg-yellow-300 text-slate-950 ring-1 ring-yellow-500/70",
                      focus === wKey && "ring-2 ring-accent",
                    )}
                  >
                    {part}
                  </span>
                );
              })}
            </span>

            {highlightMode && onHighlight && (
              <button
                type="button"
                onClick={() => onHighlight(phraseKey)}
                title={t.lessonUnits.highlightPhrase}
                className={cn(
                  "absolute right-2 top-2 flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-bold ring-1 transition",
                  phraseMarked
                    ? "bg-yellow-400 text-slate-950 ring-yellow-600"
                    : "bg-surface-2 text-muted ring-line hover:bg-yellow-200 hover:text-slate-950",
                )}
              >
                <span aria-hidden>🖍️</span>
                {t.lessonUnits.highlightPhrase}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Questions({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  const blocks: [string, string[]][] = [
    [t.lessonUnits.afterVideo, lesson.questions.afterVideo],
    [t.lessonUnits.afterReading, lesson.questions.afterReading],
  ];

  return (
    <div className="flex flex-col gap-4">
      {blocks.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">
              {label}
            </h3>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {list.map((q, i) => (
                <li key={i} className="text-[14px] leading-snug text-content">
                  {q}
                </li>
              ))}
            </ol>
          </section>
        ),
      )}
    </div>
  );
}

function Homework({ lesson }: { lesson: Lesson }) {
  const { t } = useT();

  if (lesson.homework.length === 0 && lesson.activities.length === 0) {
    return <p className="text-sm text-faint">{t.lessonUnits.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {lesson.activities.map((activity) => (
        <WordDeckBoard key={activity.id} activity={activity} compact />
      ))}
      {lesson.homework.map((task, i) => (
        <section key={i} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          {task.title && (
            <p className="text-sm font-bold text-content">{task.title}</p>
          )}
          {task.text && (
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">
              {task.text}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
