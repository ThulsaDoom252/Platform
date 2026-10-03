"use client";

/**
 * Урок глазами ученика.
 *
 * Открыт всегда только словник — с него урок и начинается. В живом
 * классе закрытые вкладки скрыты. Учитель всё равно может разово
 * привести ученика в любую из них — команда фокуса сильнее доступа.
 *
 * Подсветки приходят из закрепления, а не из урока: у каждого ученика
 * подчёркнуто своё, и заготовка от этого не меняется.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { useLocalNumber } from "@/lib/use-local-number";
import {
  lineKey,
  lexisBlockKey,
  lineWordKey,
  lessonSectionNavigation,
  richLineWords,
  parseKey,
  speakerTint,
  speakersOf,
  GREEN_HIGHLIGHT,
  RED_HIGHLIGHT,
  type HighlightColor,
  type LessonSection,
  type LessonVocabularyReveal,
} from "@/lib/lesson-unit";
import { LessonVocab } from "@/components/lessons/lesson-vocab";
import { RuleReader } from "@/components/materials/rule-reader";
import {
  focusLessonVideoAction,
  type LessonView as Lesson,
} from "@/lib/actions/lessons";
import { IconEye, IconEyeOff, IconPlus } from "@/components/icons";
import { cn } from "@/lib/utils";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import type { ClassVideoState } from "@/lib/class-video";
import { LessonVideoPlayer } from "@/components/lessons/lesson-video-player";
import {
  InteractiveHomework,
  type InteractiveHomeworkSession,
} from "@/components/lessons/interactive-homework";
import { homeworkExerciseProgress } from "@/lib/lesson-homework";

export type LessonViewProps = {
  lesson: Lesson;
  teacher?: boolean;
  defaultStudentId?: string | null;
  /** Open this tab first when the viewer came from a direct navigation item. */
  initialSection?: LessonSection;
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
  /** Запретить зрителю самому выбирать закрытые вкладки. */
  lockClosed?: boolean;
  /** Разовая команда учителя показать секцию, даже если она закрыта. */
  sectionFocus?: { section: LessonSection; elementId?: string | null; at: string } | null;
  /** Управление постоянной видимостью прямо из вкладок учителя. */
  sectionVisibilityBusy?: boolean;
  onSectionVisibilityChange?: (section: string, open: boolean) => void;
  highlights: Record<string, string>;
  /** Куда смотреть прямо сейчас — ключ места из lesson-unit. */
  focus?: string | null;
  /** Нажатие по месту: учителю — подсветить, ученику ничего. */
  onPick?: (key: string) => void;
  /** В диалоге клики ставят независимые жёлтые выделения. */
  highlightMode?: boolean;
  highlightColor?: HighlightColor;
  onHighlight?: (key: string) => void;
  /** Показать ученику UK-звук и UK-транскрипцию одиночных слов. */
  showBritish?: boolean;
  /** Может ли этот зритель сам раскрывать перевод и описание слов. */
  canRevealVocabulary?: boolean;
  vocabularyReveal?: LessonVocabularyReveal;
  onVocabularyRevealChange?: (next: LessonVocabularyReveal) => void;
  /** Какая лексическая группа сейчас выбрана учителем для ученика. */
  selectedLexisId?: string | null;
  onSelectLexis?: (groupId: string) => void;
  /** Общий плеер существует только внутри живого класса. */
  videoSession?: {
    assignmentId: string;
    teacher: boolean;
    state: ClassVideoState | null;
  };
  homeworkSession?: InteractiveHomeworkSession;
  /** Teacher command to focus one homework exercise or sentence. */
  onFocusHomework?: (elementId: string) => void;
};

/** Сколько секций держать на экране разом. */
const PANELS_KEY = "lingora.lesson.panels";
const MAX_PANELS = 4;

export function LessonView({
  lesson,
  teacher = false,
  defaultStudentId,
  initialSection,
  open,
  closed,
  lockClosed = false,
  sectionFocus,
  sectionVisibilityBusy = false,
  onSectionVisibilityChange,
  highlights,
  focus,
  onPick,
  highlightMode = false,
  highlightColor = "yellow",
  onHighlight,
  showBritish = false,
  canRevealVocabulary = true,
  vocabularyReveal,
  onVocabularyRevealChange,
  selectedLexisId,
  onSelectLexis,
  videoSession,
  homeworkSession,
  onFocusHomework,
}: LessonViewProps) {
  const { t } = useT();
  /*
   * Сколько окон показывать разом — привычка человека, а не свойство
   * урока, поэтому живёт в браузере. На телефоне выбор не действует:
   * второе окно там ничего не добавляет, только режет первое пополам.
   */
  const [panels, setPanels] = useLocalNumber(PANELS_KEY, 1);
  const [dismissedSectionFocusAt, setDismissedSectionFocusAt] = useState<string | null>(null);
  const navigation = lessonSectionNavigation(
    open,
    closed,
    lockClosed,
    sectionFocus?.section,
  );
  const selectable = navigation.selectable;
  const sectionFocusAt = sectionFocus?.at;
  const forcedSection = sectionFocusAt === dismissedSectionFocusAt
    ? null
    : navigation.forced;
  const tabSections = teacher
    ? open
    : open.filter((section) => selectable.includes(section) || section === forcedSection);
  const visibleSlotCount = selectable.length + (
    forcedSection && !selectable.includes(forcedSection) ? 1 : 0
  );
  const shown = Math.min(
    Math.max(1, panels),
    MAX_PANELS,
    Math.max(1, visibleSlotCount),
  );

  /** Что стоит в каждом окне. Первое окно ведёт себя как вкладки. */
  const [picked, setPicked] = useState<LessonSection[]>(
    initialSection ? [initialSection] : [],
  );
  const [homeworkCounterState, setHomeworkCounterState] = useState(
    homeworkSession?.state ?? {},
  );

  const LABEL: Record<LessonSection, string> = {
    vocab: t.lessonUnits.secVocab,
    lexis: t.lessonUnits.secLexis,
    video: t.lessonUnits.secVideo,
    transcript: t.lessonUnits.secTranscript,
    questions: t.lessonUnits.secQuestions,
    homework: t.lessonUnits.secHomework,
  };
  const homeworkCounters = lesson.interactiveHomework && homeworkSession
    ? homeworkExerciseProgress(lesson.interactiveHomework, homeworkCounterState)
    : null;

  useEffect(() => {
    if (!homeworkSession) return;
    const frame = requestAnimationFrame(() => setHomeworkCounterState(homeworkSession.state));
    return () => cancelAnimationFrame(frame);
  }, [homeworkSession]);

  useEffect(() => {
    if (!initialSection) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => current[0] === initialSection
        ? current
        : [initialSection, ...current.slice(1)]);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection]);

  /*
   * Окна добираются по порядку урока: открыл второе — рядом встаёт
   * следующая секция, а не пустое место, которое надо заполнять руками.
   */
  const slots: LessonSection[] = [];
  for (let i = 0; i < shown; i++) {
    const wanted = picked[i];
    const fallback = selectable.filter((s) => !slots.includes(s))[0] ?? selectable[0] ?? open[0];
    const allowed = !!wanted && (
      selectable.includes(wanted) || wanted === forcedSection
    );
    slots.push(allowed && !slots.includes(wanted) ? wanted : fallback);
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
  const focusSectionOpen = !!focusSection && (
    selectable.includes(focusSection) || focusSection === forcedSection
  );
  const videoSectionOpen = selectable.includes("video") || forcedSection === "video";
  const videoFocusAt = videoSession?.state?.focusAt;

  // Явная команда секции сильнее её видимости, но не меняет разрешение.
  useEffect(() => {
    if (!sectionFocusAt || !forcedSection) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => {
        const next = [...current];
        const occupied = next.indexOf(forcedSection);
        if (occupied > 0) next[occupied] = next[0];
        next[0] = forcedSection;
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [forcedSection, sectionFocusAt]);

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

  // Явная команда Focus открывает ученику Video даже поверх другой секции.
  useEffect(() => {
    if (
      !videoFocusAt ||
      !videoSectionOpen
    ) return;
    const frame = requestAnimationFrame(() => {
      setPicked((current) => {
        if (current.includes("video")) return current;
        const next = [...current];
        next[0] = "video";
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [videoFocusAt, videoSectionOpen]);

  const setSlot = (at: number, section: LessonSection) => {
    if (lockClosed && sectionFocusAt) setDismissedSectionFocusAt(sectionFocusAt);
    setPicked(() => {
      const next = [...slots];
      const occupied = next.indexOf(section);
      if (occupied >= 0 && occupied !== at) next[occupied] = next[at];
      next[at] = section;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Сколько окон. Показываем, только когда есть что раскладывать. */}
      {visibleSlotCount > 1 && (
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="text-[11px] font-semibold text-faint">
            {t.lessonUnits.panels}
          </span>
          {Array.from(
            { length: Math.min(MAX_PANELS, visibleSlotCount) },
            (_, i) => i + 1,
          ).map(
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
              {tabSections.map((key) => {
                const hidden = closed?.includes(key);
                const unavailable = !!hidden && lockClosed;
                const visibilityLocked = key === "vocab";
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex min-h-8 overflow-hidden rounded-xl transition",
                      section === key
                        ? "bg-accent text-white"
                        : "text-muted hover:bg-surface-2 hover:text-content",
                      hidden && section !== key && "opacity-50",
                      unavailable && "cursor-not-allowed hover:bg-transparent hover:text-muted",
                    )}
                  >
                    <button
                      type="button"
                      disabled={unavailable}
                      onClick={() => setSlot(at, key)}
                      title={hidden ? t.lessonUnits.hiddenFromStudent : undefined}
                      aria-disabled={unavailable}
                      className="flex min-w-0 items-center px-3 py-1.5 text-[13px] font-semibold"
                    >
                      <span className="flex flex-col items-start leading-tight">
                        <span>{LABEL[key]}</span>
                        {key === "homework" && homeworkCounters && (
                          <span className={cn(
                            "text-[9px] font-bold",
                            section === key ? "text-white/80" : "text-faint",
                          )}>
                            {t.interactiveHomework.exercisesProgress} {homeworkCounters.required.done}/{homeworkCounters.required.total}
                            {" · "}{t.interactiveHomework.bonusesProgress} {homeworkCounters.bonuses.done}/{homeworkCounters.bonuses.total}
                          </span>
                        )}
                      </span>
                    </button>
                    {teacher && onSectionVisibilityChange && (
                      <button
                        type="button"
                        disabled={sectionVisibilityBusy || visibilityLocked}
                        onClick={() => onSectionVisibilityChange(key, !!hidden)}
                        title={hidden ? t.lessonUnits.openForStudent : t.lessonUnits.hideFromStudent}
                        aria-label={`${hidden ? t.lessonUnits.openForStudent : t.lessonUnits.hideFromStudent}: ${LABEL[key]}`}
                        aria-pressed={!hidden}
                        className={cn(
                          "flex w-9 shrink-0 items-center justify-center border-l transition disabled:cursor-default",
                          section === key
                            ? "border-white/20 text-white/90 hover:bg-white/10"
                            : "border-line text-accent hover:bg-accent-soft",
                          visibilityLocked && "opacity-60",
                        )}
                      >
                        {hidden
                          ? <IconEyeOff className="h-3.5 w-3.5" />
                          : <IconEye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="min-h-0"
              data-lesson-highlight-scope={`section-${section}`}
            >
              {section === "vocab" && (
                <LessonVocab
                  words={lesson.words}
                  highlights={highlights}
                  focus={focus}
                  onPick={onPick}
                  showBritish={showBritish}
                  canReveal={canRevealVocabulary}
                  revealState={vocabularyReveal}
                  onRevealStateChange={onVocabularyRevealChange}
                  teacher={teacher}
                  unitId={lesson.id}
                  lessonTitle={lesson.title}
                  defaultStudentId={defaultStudentId}
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
                lesson.kind === "SHORTS" ? (
                  <div className="flex flex-col gap-4">
                    <Video lesson={lesson} session={videoSession} teacher={teacher} />
                    <section className="rounded-2xl bg-surface-2 p-3 ring-1 ring-line sm:p-4">
                      <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-faint">
                        {t.lessonUnits.secTranscript}
                      </h3>
                      <Transcript
                        lines={lesson.transcript}
                        highlights={highlights}
                        focus={focus}
                        onPick={onPick}
                        highlightMode={highlightMode}
                        highlightColor={highlightColor}
                        onHighlight={onHighlight}
                      />
                    </section>
                  </div>
                ) : (
                  <Video lesson={lesson} session={videoSession} teacher={teacher} />
                )
              )}
              {section === "transcript" && (
                <Transcript
                  lines={lesson.transcript}
                  highlights={highlights}
                  focus={focus}
                  onPick={onPick}
                  highlightMode={highlightMode}
                  highlightColor={highlightColor}
                  onHighlight={onHighlight}
                />
              )}
              {section === "questions" && <Questions lesson={lesson} />}
              {section === "homework" && (
                <Homework
                  lesson={lesson}
                  session={homeworkSession}
                  onStateChange={setHomeworkCounterState}
                  focusId={
                    sectionFocus?.section === "homework"
                      ? (sectionFocus.elementId ?? null)
                      : null
                  }
                  onFocus={onFocusHomework}
                />
              )}
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

function Video({
  lesson,
  session,
  teacher,
}: {
  lesson: Lesson;
  session?: LessonViewProps["videoSession"];
  teacher: boolean;
}) {
  const { t } = useT();
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
    <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-900/20 shadow-[0_18px_50px_rgba(2,6,23,.18)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20">
          ▶
        </span>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-extrabold text-white">
            {lesson.videoTitle || t.lessonUnits.secVideo}
          </p>
          <p className="text-[10px] font-semibold text-white/40">
            {teacher ? t.lessonUnits.videoSyncHint : t.lessonUnits.videoControlledByTeacher}
          </p>
        </div>
        {session?.teacher && lesson.videoUrl && (
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
        {focusError && <p className="w-full text-[11px] font-semibold text-rose-300">{focusError}</p>}
      </div>
      <LessonVideoPlayer
        lessonId={lesson.id}
        url={lesson.videoUrl}
        title={lesson.videoTitle}
        teacher={teacher}
        session={session}
      />
    </section>
  );
}

function Transcript({
  lines,
  highlights,
  focus,
  onPick,
  highlightMode,
  highlightColor,
  onHighlight,
}: {
  lines: Lesson["transcript"];
  highlights: Record<string, string>;
  focus?: string | null;
  onPick?: (key: string) => void;
  highlightMode: boolean;
  highlightColor: HighlightColor;
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
              phraseMarked === GREEN_HIGHLIGHT
                ? "bg-emerald-300 ring-emerald-500/70"
                : phraseMarked === RED_HIGHLIGHT
                  ? "bg-rose-300 ring-rose-500/70"
                : phraseMarked && "bg-yellow-300 ring-yellow-500/70",
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
              {richLineWords(line.text).map((part, at) => {
                if (!part.text.trim()) return <span key={at}>{part.text}</span>;
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
                        ? highlightColor === GREEN_HIGHLIGHT
                          ? "hover:bg-emerald-200"
                          : highlightColor === RED_HIGHLIGHT
                            ? "hover:bg-rose-200"
                            : "hover:bg-yellow-200"
                        : onPick && "hover:bg-accent-soft",
                      wMark === GREEN_HIGHLIGHT
                        ? "bg-emerald-300 text-slate-950 ring-1 ring-emerald-500/70"
                        : wMark === RED_HIGHLIGHT
                          ? "bg-rose-300 text-slate-950 ring-1 ring-rose-500/70"
                        : wMark && "bg-yellow-300 text-slate-950 ring-1 ring-yellow-500/70",
                      focus === wKey && "ring-2 ring-accent",
                      part.bold && "font-extrabold",
                    )}
                  >
                    {part.text}
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
                  phraseMarked === GREEN_HIGHLIGHT
                    ? "bg-emerald-400 text-slate-950 ring-emerald-600"
                    : phraseMarked === RED_HIGHLIGHT
                      ? "bg-rose-400 text-slate-950 ring-rose-600"
                    : phraseMarked
                      ? "bg-yellow-400 text-slate-950 ring-yellow-600"
                    : highlightColor === GREEN_HIGHLIGHT
                      ? "bg-surface-2 text-muted ring-line hover:bg-emerald-200 hover:text-slate-950"
                      : highlightColor === RED_HIGHLIGHT
                        ? "bg-surface-2 text-muted ring-line hover:bg-rose-200 hover:text-slate-950"
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

function Homework({
  lesson,
  session,
  onStateChange,
  focusId,
  onFocus,
}: {
  lesson: Lesson;
  session?: InteractiveHomeworkSession;
  onStateChange?: (state: InteractiveHomeworkSession["state"]) => void;
  focusId?: string | null;
  onFocus?: (elementId: string) => void;
}) {
  const { t } = useT();

  if (
    lesson.homework.length === 0 &&
    lesson.activities.length === 0 &&
    !lesson.interactiveHomework
  ) {
    return (
      <div className="rounded-2xl bg-surface p-6 text-center ring-1 ring-line">
        <p className="text-sm font-semibold text-faint">{t.lessonUnits.noHomework}</p>
        {session?.teacher && (
          <Link
            href={`/teacher/lessons/${session.unitId}#lesson-homework`}
            className="mx-auto mt-3 flex h-10 w-fit items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:brightness-95"
          >
            <IconPlus className="h-4 w-4" />
            {t.lessonUnits.addHomework}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {lesson.activities.map((activity) => (
        <WordDeckBoard key={activity.id} activity={activity} compact />
      ))}
      {lesson.interactiveHomework && session && (
        <InteractiveHomework
          key={`${session.assignmentId}:${JSON.stringify(session.state)}`}
          plan={lesson.interactiveHomework}
          session={session}
          onStateChange={onStateChange}
          focusId={focusId}
          onFocus={onFocus}
        />
      )}
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
