"use client";

/**
 * Класс: общая оболочка для учителя и ученика.
 *
 * Снизу панель, которую видят оба; таймер в ней есть только у учителя.
 * Справа сворачиваемые панели — чат и табличка глаголов. Они включены
 * по умолчанию и у учителя работают даже вне класса: переписку можно
 * вести и между уроками.
 *
 * Присутствие держится опросом: раз в полминуты браузер отмечается и
 * заодно узнаёт, на месте ли собеседник.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  SCHEDULE_FORMAT_TIME_ZONE,
  scheduleNow,
} from "@/lib/schedule-time";
import {
  CLASS_SORTS,
  orderClassPeople,
  type ClassSortKey,
} from "@/lib/class-order";
import { useLocalJson } from "@/lib/use-local-json";
import {
  classSyncAction,
  classTeacherProfileAction,
  heartbeatAction,
  unreadMessagesAction,
  listClassPeopleAction,
  enterClassAction,
  summonStudentToClassAction,
  leaveClassAction,
  type ClassPerson,
  type ClassPartnerProfile,
  type Presence,
} from "@/lib/actions/class";
import { PresenceIndicator } from "@/components/student-presence";
import { ClassChat } from "./class-chat";
import { QuickVerbs } from "./quick-verbs";
import {
  DEFAULT_CLASS_PANEL_LAYOUT,
  DockablePanel,
  normalizeClassPanelPlacement,
  type ClassPanelPlacement,
  type ClassUtilityPanel,
} from "./dockable-panel";
import { Avatar } from "@/components/avatar";
import {
  IconMessage,
  IconMaterials,
  IconClock,
  IconFile,
  IconGrid,
  IconList,
  IconX,
  IconUser,
  IconCap,
} from "@/components/icons";
import { ClassScript } from "./class-script";
import { ClassBoard } from "./class-board";
import { ClassTwister } from "./class-twister";
import { TwisterViewer } from "@/components/twisters/twister-viewer";
import {
  twisterSessionAction,
  type ClassTwisterSession,
} from "@/lib/actions/tongue-twisters";
import { ClassActivities } from "./class-activities";
import { ClassLesson } from "./class-lesson";
import {
  ClassVocabulary,
} from "./class-vocabulary";
import type { ClassVocabularyWord } from "@/lib/actions/class-vocabulary";
import {
  SelectionTranslationPopover,
  type ClassTextSelection,
} from "./selection-translation-popover";
import { StudentGuess } from "@/components/game/student-guess";
import { WordDeckBoard } from "@/components/game/word-deck-board";
import {
  focusedClassWordDeckAction,
  type ClassWordDeckActivity,
} from "@/lib/actions/word-deck";
import { RevisionClassRunner } from "@/components/revision/revision-class-runner";
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";
import type { ClassTimerState } from "@/lib/class-timer";
import { ClassTimerManager, StudentClassTimer } from "./class-timer";
import {
  ClassNotes,
  StudentFocusedNote,
  type FocusedClassNote,
} from "./class-notes";
import { ClassGameReviewBanner } from "./class-game-review";
import type { ClassGameReview } from "@/lib/class-game-meta";
import type { ClassReaction } from "@/lib/class-reaction";
import {
  ReactionToolbarIcon,
  StudentClassReaction,
  TeacherReactionPanel,
} from "./class-reactions";

const BEAT_MS = 30_000;
const CHAT_UNREAD_MS = 4_000;
/*
 * «Перейди на доску» не должно ждать полминуты до отметки о живости,
 * поэтому у команд свой такт — короткий и с двумя полями в ответе.
 */
const SYNC_MS = 4_000;
const STUDENT_FOCUS_SYNC_MS = 1_000;

type PanelKey = "chat" | "verbs" | "dictionary" | "board" | "script" | "notes";

/** Части урока. Их разбор видит только учитель — ученику показан сам урок. */
type LessonTab = "lesson" | "twister" | "activities";

export function ClassRoom({
  role,
  selfId,
  selfName,
}: {
  role: "TEACHER" | "STUDENT";
  selfId: string;
  selfName: string;
}) {
  const teacher = role === "TEACHER";

  const [people, setPeople] = useState<ClassPerson[] | null>(null);
  const [partner, setPartner] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
    presence: Presence;
  } | null>(null);
  const { t, locale } = useT();
  /*
   * Урок начинается с пустого стола: панели включает учитель, когда они
   * понадобились. Открытые по умолчанию чат и глаголы отъедали у урока
   * треть экрана всё занятие, даже если в них не заглядывали.
   */
  const [open, setOpen] = useState<Record<PanelKey, boolean>>({
    chat: false,
    verbs: false,
    dictionary: false,
    board: false,
    script: false,
    notes: false,
  });
  const [panelLayout, setPanelLayout] = useLocalJson<
    Record<ClassUtilityPanel, ClassPanelPlacement>
  >(`class-panel-layout:${selfId}`, DEFAULT_CLASS_PANEL_LAYOUT);
  const [lessonTab, setLessonTab] = useState<LessonTab>("lesson");
  // Порядок в списке — привычка учителя, поэтому живёт в браузере.
  const [sort, setSort] = useLocalJson<ClassSortKey>("class-sort", "lessons");
  const [sortDesc, setSortDesc] = useLocalJson("class-sort-desc", false);
  const [showTimer, setShowTimer] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [timerState, setTimerState] = useState<ClassTimerState | null>(null);
  const [studentReaction, setStudentReaction] = useState<ClassReaction | null>(null);
  const [focusedNote, setFocusedNote] = useState<FocusedClassNote | null>(null);
  const [unreadState, setUnreadState] = useState<{
    conversation: string | null;
    count: number;
  }>({ conversation: null, count: 0 });
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [partnerOnBoard, setPartnerOnBoard] = useState(false);
  const [boardFocus, setBoardFocus] = useState<{
    objectId: number | null;
    command: "SHOW" | "FOCUS" | "FLASH";
    at: string;
  } | null>(null);
  const [twisterSession, setTwisterSession] = useState<ClassTwisterSession | null>(null);
  const [focusedWordDeck, setFocusedWordDeck] = useState<ClassWordDeckActivity | null>(null);
  const [focusedRevisionId, setFocusedRevisionId] = useState<string | null>(null);
  const [gameReview, setGameReview] = useState<ClassGameReview | null>(null);
  const [gameReviewNotice, setGameReviewNotice] = useState<ClassGameReview | null>(null);
  const [videoSync, setVideoSync] = useState<ClassVideoState | null>(null);
  const [lessonSectionFocus, setLessonSectionFocus] = useState<{
    assignmentId: string;
    section: string;
    elementId: string | null;
    at: string;
  } | null>(null);
  const [textSelection, setTextSelection] = useState<ClassTextSelection | null>(null);
  const [vocabularyNotice, setVocabularyNotice] = useState<{
    id: string;
    english: string;
    translation: string;
  } | null>(null);
  const [busy, startBusy] = useTransition();
  const [profileBusy, startProfile] = useTransition();
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<ClassPartnerProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [summonNotice, setSummonNotice] = useState<string | null>(null);
  const chime = useRef<(() => void) | null>(null);
  const unreadRef = useRef(0);
  const boardOpen = useRef(false);
  const appliedView = useRef<string | null>(null);
  const appliedNote = useRef<string | null>(null);
  const appliedGameReviewNotice = useRef<string | null>(null);
  const appliedReaction = useRef<string | null>(null);
  const seenVocabularyEvents = useRef(new Set<string>());
  const vocabularyEventsReady = useRef(false);
  const vocabularyNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    boardOpen.current = open.board;
  }, [open.board]);

  // Короткий сигнал на новое сообщение: файл не нужен, хватает генератора.
  useEffect(() => {
    chime.current = () => {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        setTimeout(() => ctx.close(), 400);
      } catch {
        /* звук — приятность, а не обязанность */
      }
    };
  }, []);

  // Вход и выход из класса меняют обстановку сразу, не дожидаясь такта.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;

    const beat = () => {
      heartbeatAction()
        .then(async (b) => {
          if (!alive) return;
          setPartner(b.partner);
          if (!teacher) return;
          const list = await listClassPeopleAction();
          if (alive) setPeople(list);
        })
        .catch(() => {
          /* следующий такт подхватит */
        });
    };

    beat();
    const t = setInterval(beat, BEAT_MS);

    /*
     * Правку расписания подхватываем сразу по возвращении на вкладку.
     *
     * Урок назначают и отменяют в соседнем окне, а сюда возвращаются
     * через секунду — ждать полминуты до следующего такта и видеть уже
     * несуществующее занятие незачем.
     */
    const wake = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);

    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [teacher, nonce]);

  // У учителя разговор принадлежит ученику, у ученика — ему самому.
  const conversation = teacher ? (partner?.id ?? null) : selfId;
  const unread = unreadState.conversation === conversation ? unreadState.count : 0;

  useEffect(() => {
    unreadRef.current = 0;
    if (open.chat || !conversation) return;

    let alive = true;
    let ready = false;

    const loadUnread = () => {
      unreadMessagesAction()
        .then((next) => {
          if (!alive) return;
          const previous = unreadRef.current;
          unreadRef.current = next;
          setUnreadState({ conversation, count: next });
          // При первом такте показываем уже накопленное без внезапного звука.
          if (ready && next > previous) chime.current?.();
          ready = true;
        })
        .catch(() => {
          /* следующий такт подхватит */
        });
    };

    loadUnread();
    const timer = setInterval(loadUnread, CHAT_UNREAD_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [conversation, open.chat]);

  useEffect(() => {
    seenVocabularyEvents.current.clear();
    vocabularyEventsReady.current = false;
  }, [conversation]);

  useEffect(() => () => {
    if (vocabularyNoticeTimer.current) clearTimeout(vocabularyNoticeTimer.current);
  }, []);

  const showVocabularyNotice = useCallback((word: {
    id: string;
    english: string;
    translation: string;
  }) => {
    setVocabularyNotice(word);
    chime.current?.();
    if (vocabularyNoticeTimer.current) clearTimeout(vocabularyNoticeTimer.current);
    vocabularyNoticeTimer.current = setTimeout(() => setVocabularyNotice(null), 6_000);
  }, []);

  const translateSelectedText = useCallback((selection: ClassTextSelection) => {
    setTextSelection(selection);
  }, []);

  const closeSelectionTranslation = useCallback(() => {
    setTextSelection(null);
  }, []);

  const closeStudentReaction = useCallback(() => {
    setStudentReaction(null);
  }, []);

  const toggle = (key: PanelKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    if (key === "chat" && !open.chat) {
      unreadRef.current = 0;
      setUnreadState({ conversation, count: 0 });
    }
  };

  const placementOf = (key: ClassUtilityPanel) =>
    normalizeClassPanelPlacement(panelLayout[key], DEFAULT_CLASS_PANEL_LAYOUT[key]);

  const updatePlacement = (key: ClassUtilityPanel, placement: ClassPanelPlacement) => {
    setPanelLayout({
      ...DEFAULT_CLASS_PANEL_LAYOUT,
      ...panelLayout,
      [key]: placement,
    });
  };

  const detachPanel = (key: ClassUtilityPanel) => {
    const current = placementOf(key);
    const right = Math.max(12, window.innerWidth - 372);
    updatePlacement(key, {
      ...current,
      floating: true,
      x: key === "dictionary" ? 12 : right,
      y: key === "verbs" ? Math.max(12, window.innerHeight - 432) : 84,
    });
  };

  const dockPanel = (key: ClassUtilityPanel) => {
    const current = placementOf(key);
    updatePlacement(key, { ...current, floating: false });
  };

  const movePanel = (key: ClassUtilityPanel, x: number, y: number) => {
    updatePlacement(key, { ...placementOf(key), floating: true, x, y });
  };

  const resizePanel = (key: ClassUtilityPanel, width: number, height: number) => {
    updatePlacement(key, { ...placementOf(key), width, height });
  };

  /*
   * Нижние панели остаются индивидуальными. Исключение — две явные команды
   * учителя: показать доску и вернуть ученика к сфокусированному элементу
   * урока. Текущее положение нужно только для подписи на кнопке доски.
   */
  useEffect(() => {
    let alive = true;

    const tick = () => {
      classSyncAction(boardOpen.current)
        .then((sync) => {
          if (!alive) return;
          setActiveLessonId(sync.lessonAssignmentId);
          setPartnerOnBoard(sync.partnerOnBoard);
          setVideoSync(sync.video);
          setTimerState(sync.timer);
          if (!teacher) {
            setGameReview(sync.gameReview);
            const noticeAt = sync.gameReviewNotice?.at;
            const noticeAge = noticeAt ? Date.now() - Date.parse(noticeAt) : Number.POSITIVE_INFINITY;
            if (
              sync.gameReviewNotice &&
              noticeAt &&
              appliedGameReviewNotice.current !== noticeAt &&
              Number.isFinite(noticeAge) &&
              noticeAge <= 120_000
            ) {
              appliedGameReviewNotice.current = noticeAt;
              setGameReviewNotice(sync.gameReviewNotice);
              chime.current?.();
              window.setTimeout(() => setGameReviewNotice((current) => current?.at === noticeAt ? null : current), 8_000);
            }
            if (sync.reaction && appliedReaction.current !== sync.reaction.id) {
              appliedReaction.current = sync.reaction.id;
              try {
                const key = `class-reaction-seen:${selfId}`;
                if (window.sessionStorage.getItem(key) !== sync.reaction.id) {
                  window.sessionStorage.setItem(key, sync.reaction.id);
                  setStudentReaction(sync.reaction);
                }
              } catch {
                setStudentReaction(sync.reaction);
              }
            }
          }
          if (!teacher && sync.noteFocus && appliedNote.current !== sync.noteFocus.at) {
            appliedNote.current = sync.noteFocus.at;
            setFocusedNote(sync.noteFocus);
          }

          if (!vocabularyEventsReady.current) {
            sync.vocabularyEvents.forEach((event) => seenVocabularyEvents.current.add(event.id));
            vocabularyEventsReady.current = true;
          } else {
            const fresh = sync.vocabularyEvents.filter(
              (event) => !seenVocabularyEvents.current.has(event.id),
            );
            sync.vocabularyEvents.forEach((event) => seenVocabularyEvents.current.add(event.id));
            if (fresh.length > 0) showVocabularyNotice(fresh[0]);
          }

          if (teacher || !sync.view || appliedView.current === sync.view.at) return;
          if (sync.view.target === "TWISTER") {
            const commandAt = sync.view.at;
            void twisterSessionAction()
              .then((next) => {
                if (!alive || !next || appliedView.current === commandAt) return;
                setLessonSectionFocus(null);
                setFocusedWordDeck(null);
                setFocusedRevisionId(null);
                setOpen((prev) => ({ ...prev, board: false }));
                setTwisterSession(next);
                // Считаем команду выполненной только после успешной загрузки.
                // При временном сбое следующий такт попробует ещё раз.
                appliedView.current = commandAt;
              })
              .catch(() => {});
            return;
          }
          appliedView.current = sync.view.at;
          setTwisterSession(null);
          if (sync.view.target === "BOARD") {
            setLessonSectionFocus(null);
            setFocusedWordDeck(null);
            setFocusedRevisionId(null);
            setBoardFocus({
              objectId: sync.view.boardObjectId,
              command: sync.view.boardCommand ?? "SHOW",
              at: sync.view.at,
            });
            setOpen((prev) => ({ ...prev, board: true }));
          } else if (sync.view.target === "GAME" && sync.view.revisionId) {
            setLessonSectionFocus(null);
            setFocusedWordDeck(null);
            setFocusedRevisionId(sync.view.revisionId);
            setOpen((prev) => ({ ...prev, board: false }));
          } else if (sync.view.target === "GAME" && sync.view.gameId) {
            setLessonSectionFocus(null);
            setFocusedRevisionId(null);
            setOpen((prev) => ({ ...prev, board: false }));
            const commandAt = sync.view.at;
            void focusedClassWordDeckAction().then((activity) => {
              if (alive && appliedView.current === commandAt) {
                setFocusedWordDeck(activity);
              }
            });
          } else {
            setFocusedWordDeck(null);
            setFocusedRevisionId(null);
            setLessonSectionFocus(
              sync.view.target === "LESSON" &&
                sync.view.lessonSection &&
                sync.lessonAssignmentId
                ? {
                    assignmentId: sync.lessonAssignmentId,
                    section: sync.view.lessonSection,
                    elementId: sync.view.lessonElementId,
                    at: sync.view.at,
                  }
                : null,
            );
            /*
             * Урок и игра лежат в той же колонке, поверх которой стоит
             * доска во весь экран. Поэтому «покажи игру» — это прежде
             * всего «убери доску»: игра под ней уже идёт сама.
             */
            setOpen((prev) => ({ ...prev, board: false }));
          }
        })
        .catch(() => {
          /* следующий такт подхватит */
        });
    };

    tick();
    // Учителю достаточно редкой проверки положения ученика, а ученик
    // должен получать явную команду фокусировки почти сразу.
    const id = setInterval(tick, teacher ? SYNC_MS : STUDENT_FOCUS_SYNC_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selfId, showVocabularyNotice, teacher]);

  /*
   * Сегодня и завтра называем словами, остальные дни — днём недели: на
   * «Wednesday» в середине списка взгляд цепляется хуже, чем на «Завтра».
   */
  const hhmm = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const dayShort = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    weekday: "long",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });

  const dayLabel = (day: Date) => {
    const today = scheduleNow();
    const diff = Math.round(
      (day.setUTCHours(0, 0, 0, 0) -
        new Date(today).setUTCHours(0, 0, 0, 0)) /
        86400000,
    );
    if (diff === 0) return t.classRoom.today;
    if (diff === 1) return t.classRoom.tomorrow;
    return weekday.format(day);
  };

  const groups = orderClassPeople(people ?? [], sort, sortDesc);

  const tabBtn = (key: PanelKey, icon: React.ReactNode, label: string, badge?: number) => {
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggle(key)}
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
          open[key] ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content",
          key === "chat" && !open.chat && !!badge && badge > 0 && "class-chat-unread",
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {!!badge && badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-surface">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  const stub = (title: string) => (
    <div className="rounded-2xl bg-surface p-5 text-center ring-1 ring-line">
      <p className="text-sm font-semibold text-content">{title}</p>
      <p className="mt-1 text-[12px] text-faint">{t.classRoom.soon}</p>
    </div>
  );

  /*
   * Урок у учителя разложен на части: сам урок, скороговорка и активности.
   * Ученику этот разбор не нужен — он видит только урок, поэтому вкладки
   * живут здесь, а не в общей нижней панели.
   */
  const LESSON_TABS: { key: LessonTab; label: string }[] = [
    { key: "lesson", label: t.classRoom.lesson },
    { key: "twister", label: t.classRoom.tongueTwister },
    { key: "activities", label: t.classRoom.activities },
  ];

  const lessonSection = (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-1">
        {LESSON_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setLessonTab(tab.key)}
            className={cn(
              "h-9 rounded-xl px-3.5 text-sm font-semibold transition",
              lessonTab === tab.key
                ? "bg-accent text-white"
                : "text-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">{t.classRoom.onlyYou}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {lessonTab === "lesson" && partner ? (
          <ClassLesson
            teacher
            assignmentId={activeLessonId}
            videoSync={videoSync}
            onAssigned={setActiveLessonId}
            onTextSelect={translateSelectedText}
          />
        ) : lessonTab === "twister" && partner ? (
          <ClassTwister studentId={partner.id} studentName={partner.name} />
        ) : lessonTab === "activities" && partner ? (
          <ClassActivities studentId={partner.id} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            {stub(LESSON_TABS.find((tab) => tab.key === lessonTab)!.label)}
          </div>
        )}
      </div>
    </section>
  );

  const SORT_LABEL: Record<ClassSortKey, string> = {
    lessons: t.classRoom.sortLessons,
    name: t.classRoom.sortName,
    balance: t.classRoom.sortBalance,
  };

  /**
   * Кружок ученика. Сам кружок начинает класс, уголок ведёт в карточку.
   *
   * Время приходит снаружи: у человека за неделю несколько занятий, и в
   * каждом дне он стоит со своим.
   */
  const circle = (p: ClassPerson, at: string | null, minutes = 0, parts = 1) => (
    /* Ссылку нельзя вложить в кнопку, поэтому они рядом. */
    <div
      key={`${p.id}-${at ?? "x"}`}
      className="group relative flex w-24 flex-col items-center gap-2"
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => startBusy(async () => {
          setActiveLessonId(null);
          await enterClassAction(p.id);
          setNonce((n) => n + 1);
        })}
        className="flex flex-col items-center gap-2"
      >
        <span className="relative">
          <Avatar
            name={p.name}
            src={p.avatarUrl}
            className="h-20 w-20 text-xl ring-2 ring-line transition group-hover:ring-accent"
          />
          <span className="absolute bottom-1 right-1">
            <PresenceIndicator presence={p.presence} />
          </span>
          {p.unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
              {p.unread}
            </span>
          )}
        </span>
        <span className="w-full truncate text-center text-[13px] font-semibold text-content group-hover:text-accent">
          {p.name}
        </span>
      </button>

      <span className="flex flex-col items-center gap-0.5 text-[11px] text-faint">
        {/* Время урока важнее уровня: по нему список и построен.
            У сдвоенного показываем промежуток целиком — по одному
            началу не видно, что занятие длинное. */}
        {at && sort === "lessons" && (
          <span className="font-mono font-bold text-muted">
            {hhmm.format(new Date(at))}
            {parts > 1 &&
              `–${hhmm.format(new Date(new Date(at).getTime() + minutes * 60000))}`}
          </span>
        )}
        {sort === "balance" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-semibold",
              p.balance > 3 ? "tint-green" : p.balance > 0 ? "tint-amber" : "tint-rose",
            )}
          >
            {fmt(t.classRoom.lessonsLeft, { n: p.balance })}
          </span>
        )}
        {p.level && sort === "name" && <span>{p.level}</span>}
      </span>

      <Link
        href={`/teacher/students/${p.id}`}
        title={fmt(t.classRoom.profileOf, { name: p.name })}
        aria-label={fmt(t.classRoom.profileOf, { name: p.name })}
        className="absolute -left-1 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-faint opacity-0 ring-1 ring-line transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
      >
        <IconUser className="h-3.5 w-3.5" />
      </Link>
    </div>
  );

  /** Выбор ученика: пока класс не начат, кружочки на весь экран. */
  const picker = (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="text-lg font-bold text-content">{t.classRoom.pickTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.classRoom.pickHint}</p>

      {/* Порядок списка */}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
          {t.classRoom.sortBy}
        </span>
        {CLASS_SORTS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (sort === key) setSortDesc(!sortDesc);
              else {
                setSort(key);
                setSortDesc(false);
              }
            }}
            className={cn(
              "flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold transition",
              sort === key
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-content",
            )}
          >
            {SORT_LABEL[key]}
            <span aria-hidden className={sort === key ? "" : "opacity-40"}>
              {sort === key && sortDesc ? "↓" : "↑"}
            </span>
          </button>
        ))}
      </div>

      {people === null && (
        <p className="mt-6 text-sm text-faint">{t.classRoom.loading}</p>
      )}

      {groups.map((group) => (
        <div key={group.day ?? "rest"} className="mt-5">
          {sort === "lessons" && (
            <p className="mb-2 flex items-baseline gap-2 text-[12px] font-bold uppercase tracking-wide text-faint">
              {group.day ? dayLabel(new Date(group.day)) : t.classRoom.noLessons}
              {group.day && (
                <span className="font-mono normal-case text-faint/70">
                  {dayShort.format(new Date(group.day))}
                </span>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-5">
            {group.entries.map((entry) =>
              circle(entry.person, entry.at, entry.minutes, entry.parts),
            )}
          </div>
        </div>
      ))}
    </div>
  );

  function openTeacherProfile() {
    setProfileError(null);
    startProfile(async () => {
      const result = await classTeacherProfileAction();
      if (result.profile) setTeacherProfile(result.profile);
      else setProfileError(result.error ?? t.classRoom.profileUnavailable);
    });
  }

  const profileRows = teacherProfile
    ? [
        [t.profile.email, teacherProfile.email],
        [t.profile.phone, teacherProfile.phone],
        [t.profile.telegram, teacherProfile.telegram],
        [t.profile.viber, teacherProfile.viber],
        [t.profile.hobby, teacherProfile.hobby],
        [t.profile.goal, teacherProfile.goal],
        [t.profile.homeland, teacherProfile.homeland],
        [t.profile.country, teacherProfile.country],
        [t.profile.city, teacherProfile.city],
        [t.profile.contactNote, teacherProfile.contactNote],
      ].filter((row): row is [string, string] => Boolean(row[1]))
    : [];

  const dictionaryPlacement = placementOf("dictionary");
  const chatPlacement = placementOf("chat");
  const verbsPlacement = placementOf("verbs");
  const notesPlacement = placementOf("notes");
  const scriptPlacement = placementOf("script");
  const dockedDictionary = open.dictionary && !dictionaryPlacement.floating;
  const dockedRight =
    (open.chat && !chatPlacement.floating) ||
    (open.verbs && !verbsPlacement.floating) ||
    Boolean(teacher && partner && open.script && !scriptPlacement.floating) ||
    Boolean(teacher && partner && open.notes && !notesPlacement.floating);
  const chatTitle = partner
    ? fmt(t.classRoom.chatWith, { name: partner.name })
    : t.classRoom.chat;
  const notesTitle = partner
    ? fmt(t.classRoom.notesWith, { name: partner.name })
    : t.classRoom.notes;

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 pb-20 lg:pb-24">
      {!teacher && gameReviewNotice && (
        <ClassGameReviewBanner review={gameReviewNotice} floating onClose={() => setGameReviewNotice(null)} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
          <PresenceIndicator presence="online" />
          <span className="text-sm font-semibold text-content">{selfName}</span>
          <span className="text-[11px] text-faint">{t.classRoom.youAre}</span>
        </div>

        {partner ? (
          /* Аватар ученика раскрывается отдельно и не уводит учителя из
             класса. Имя по-прежнему ведёт в рабочую карточку ученика. */
          teacher ? (
            <div className="flex items-center gap-2 rounded-xl bg-surface py-1.5 pl-1.5 pr-3 ring-1 ring-line">
              <button
                type="button"
                onClick={() => setAvatarPreview(true)}
                title={fmt(t.classRoom.viewAvatar, { name: partner.name })}
                aria-label={fmt(t.classRoom.viewAvatar, { name: partner.name })}
                className="relative rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Avatar
                  name={partner.name}
                  src={partner.avatarUrl}
                  className="h-9 w-9 text-sm ring-1 ring-line"
                />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceIndicator presence={partner.presence} />
                </span>
              </button>
              <Link
                href={`/teacher/students/${partner.id}`}
                title={fmt(t.classRoom.profileOf, { name: partner.name })}
                className="group flex items-center gap-2"
              >
                <span className="text-sm font-semibold text-content group-hover:text-accent">
                  {partner.name}
                </span>
                <span className="text-[11px] text-faint">
                  {partner.presence === "online"
                    ? t.classRoom.online
                    : t.classRoom.offline}
                </span>
                <IconUser className="h-3.5 w-3.5 text-faint transition group-hover:text-accent" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-surface py-1.5 pl-1.5 pr-3 ring-1 ring-line">
              <button
                type="button"
                disabled={profileBusy}
                onClick={openTeacherProfile}
                title={fmt(t.classRoom.openTeacherProfile, { name: partner.name })}
                aria-label={fmt(t.classRoom.openTeacherProfile, { name: partner.name })}
                className="relative rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <Avatar
                  name={partner.name}
                  src={partner.avatarUrl}
                  className="h-9 w-9 text-sm ring-1 ring-line"
                />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceIndicator presence={partner.presence} />
                </span>
              </button>
              <span className="text-sm font-semibold text-content">{partner.name}</span>
              <span className="text-[11px] text-faint">
                {profileBusy
                  ? t.common.loading
                  : partner.presence === "online"
                    ? t.classRoom.online
                    : t.classRoom.offline}
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-faint">
            {teacher ? t.classRoom.notStarted : t.classRoom.waitingTeacher}
          </span>
        )}

        {profileError && (
          <span className="text-xs font-semibold text-rose-500">{profileError}</span>
        )}

        {teacher && partner && (
          <button
            type="button"
            disabled={busy || partner.presence !== "online"}
            onClick={() => startBusy(async () => {
              const result = await summonStudentToClassAction();
              setSummonNotice(result.error ?? t.classRoom.bringToClassSent);
            })}
            title={
              partner.presence === "online"
                ? t.classRoom.bringToClass
                : t.classRoom.bringToClassOffline
            }
            className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-[12px] font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <IconCap className="h-4 w-4" />
            {t.classRoom.bringToClass}
          </button>
        )}

        {summonNotice && (
          <span className="text-xs font-semibold text-accent">{summonNotice}</span>
        )}

        {teacher && partner && (
          <button
            type="button"
            disabled={busy}
            onClick={() => startBusy(async () => {
              await leaveClassAction();
              setPartner(null);
              setActiveLessonId(null);
              setTimerState(null);
              setShowTimer(false);
              setShowReactions(false);
              setNonce((n) => n + 1);
            })}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-rose-400 hover:text-rose-500"
          >
            <IconX className="h-4 w-4" /> {t.classRoom.leave}
          </button>
        )}
      </div>

      {/* Закреплённые панели занимают свои колонки и идут вслед за экраном.
          Откреплённые становятся плавающими, поэтому урок сразу расширяется. */}
      <div
        className={cn(
          "grid gap-4",
          dockedDictionary && dockedRight
            ? "lg:grid-cols-[360px_minmax(0,1fr)_360px]"
            : dockedDictionary
              ? "lg:grid-cols-[360px_minmax(0,1fr)]"
              : dockedRight
                ? "lg:grid-cols-[minmax(0,1fr)_360px]"
                : "grid-cols-1",
        )}
      >
        {open.dictionary && (
          <DockablePanel
            title={t.classRoom.dictionary}
            placement={dictionaryPlacement}
            dockedClassName="order-2 h-[620px] max-h-[calc(100dvh-9rem)] lg:sticky lg:top-20 lg:order-none"
            detachLabel={t.classRoom.detachPanel}
            dockLabel={t.classRoom.dockPanel}
            resizeLabel={t.classRoom.resizePanel}
            onDetach={() => detachPanel("dictionary")}
            onDock={() => dockPanel("dictionary")}
            onMove={(x, y) => movePanel("dictionary", x, y)}
            onResize={(width, height) => resizePanel("dictionary", width, height)}
          >
            <ClassVocabulary
              key={conversation ?? "no-student"}
              ready={!!conversation}
              compact
              onAdded={(word: ClassVocabularyWord) => {
                const alreadyShown = seenVocabularyEvents.current.has(word.id);
                seenVocabularyEvents.current.add(word.id);
                if (!alreadyShown) showVocabularyNotice(word);
              }}
            />
          </DockablePanel>
        )}

        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-none">
          {!teacher && gameReview && <ClassGameReviewBanner review={gameReview} />}
          {teacher && !partner ? (
            picker
          ) : teacher ? (
            lessonSection
          ) : (
            /* У ученика секция урока не разложена на части: ему нужна
               карта, а не то, из чего урок собран. */
            focusedRevisionId ? (
              <RevisionClassRunner revisionId={focusedRevisionId} />
            ) : focusedWordDeck ? (
              <WordDeckBoard
                key={focusedWordDeck.id}
                activity={focusedWordDeck}
                live
                observer
              />
            ) : (
              <StudentGuess
                fallback={(
                  <ClassLesson
                    teacher={false}
                    assignmentId={activeLessonId}
                    videoSync={videoSync}
                    sectionFocus={lessonSectionFocus}
                    onTextSelect={translateSelectedText}
                  />
                )}
              />
            )
          )}
        </div>

        <div
          className={cn(
            "order-3 flex min-w-0 flex-col gap-4 lg:order-none",
            dockedRight
              ? "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto"
              : "contents",
          )}
        >
          {open.chat && (
            <DockablePanel
              title={chatTitle}
              placement={chatPlacement}
              dockedClassName="h-[420px] shrink-0"
              detachLabel={t.classRoom.detachPanel}
              dockLabel={t.classRoom.dockPanel}
              resizeLabel={t.classRoom.resizePanel}
              onDetach={() => detachPanel("chat")}
              onDock={() => dockPanel("chat")}
              onMove={(x, y) => movePanel("chat", x, y)}
              onResize={(width, height) => resizePanel("chat", width, height)}
            >
              <ClassChat
                key={conversation ?? "none"}
                studentId={conversation}
                title={chatTitle}
                canArchive={teacher}
                compact
              />
            </DockablePanel>
          )}

          {teacher && partner && open.script && (
            <DockablePanel
              title={t.classRoom.scriptTitle}
              placement={scriptPlacement}
              dockedClassName="h-[620px] shrink-0"
              detachLabel={t.classRoom.detachPanel}
              dockLabel={t.classRoom.dockPanel}
              resizeLabel={t.classRoom.resizePanel}
              onDetach={() => detachPanel("script")}
              onDock={() => dockPanel("script")}
              onMove={(x, y) => movePanel("script", x, y)}
              onResize={(width, height) => resizePanel("script", width, height)}
            >
              <ClassScript studentId={partner.id} onClose={() => toggle("script")} embedded />
            </DockablePanel>
          )}

          {open.verbs && (
            <DockablePanel
              title={t.classRoom.verbsTitle}
              placement={verbsPlacement}
              dockedClassName="h-[360px] shrink-0"
              detachLabel={t.classRoom.detachPanel}
              dockLabel={t.classRoom.dockPanel}
              resizeLabel={t.classRoom.resizePanel}
              onDetach={() => detachPanel("verbs")}
              onDock={() => dockPanel("verbs")}
              onMove={(x, y) => movePanel("verbs", x, y)}
              onResize={(width, height) => resizePanel("verbs", width, height)}
            >
              <QuickVerbs />
            </DockablePanel>
          )}

          {teacher && partner && open.notes && (
            <DockablePanel
              title={notesTitle}
              placement={notesPlacement}
              dockedClassName="h-[520px] shrink-0"
              detachLabel={t.classRoom.detachPanel}
              dockLabel={t.classRoom.dockPanel}
              resizeLabel={t.classRoom.resizePanel}
              allowWidthToggle
              widthToggleLabel={t.classRoom.notesWide}
              onDetach={() => detachPanel("notes")}
              onDock={() => dockPanel("notes")}
              onMove={(x, y) => movePanel("notes", x, y)}
              onResize={(width, height) => resizePanel("notes", width, height)}
            >
              <ClassNotes studentName={partner.name} compact embedded />
            </DockablePanel>
          )}
        </div>
      </div>

      {/*
       * Доска занимает весь экран: на четверти экрана рисовать нечем, а
       * урок в этот момент всё равно идёт на ней.
       */}
      {open.board && (
        <ClassBoard
          teacher={teacher}
          studentName={partner?.name ?? null}
          studentHere={partnerOnBoard}
          focus={teacher ? null : boardFocus}
          onStudentShown={() => setPartnerOnBoard(true)}
          onClose={() => toggle("board")}
        />
      )}

      {!teacher && twisterSession && (
        <TwisterViewer
          items={[twisterSession.twister]}
          startId={twisterSession.twisterId}
          initialSession={twisterSession}
          onClose={() => setTwisterSession(null)}
        />
      )}

      {teacher && partner && avatarPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={fmt(t.classRoom.viewAvatar, { name: partner.name })}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setAvatarPreview(false)}
            aria-label={t.common.close}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
          />
          <div className="relative flex max-h-[90dvh] w-full max-w-xl flex-col items-center rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-line sm:p-8">
            <button
              type="button"
              onClick={() => setAvatarPreview(false)}
              aria-label={t.common.close}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content"
            >
              <IconX className="h-5 w-5" />
            </button>
            <Avatar
              name={partner.name}
              src={partner.avatarUrl}
              className="h-64 w-64 max-w-full text-7xl shadow-xl ring-4 ring-accent-soft sm:h-80 sm:w-80"
            />
            <p className="mt-5 text-xl font-black text-content">{partner.name}</p>
          </div>
        </div>
      )}

      {!teacher && teacherProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.classRoom.teacherProfile}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setTeacherProfile(null)}
            aria-label={t.common.close}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <section className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line sm:p-7">
            <button
              type="button"
              onClick={() => setTeacherProfile(null)}
              aria-label={t.common.close}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-content"
            >
              <IconX className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={teacherProfile.name}
                src={teacherProfile.avatarUrl}
                className="h-28 w-28 text-4xl shadow-lg ring-4 ring-accent-soft"
              />
              <p className="mt-4 text-[11px] font-black uppercase tracking-[.18em] text-accent">
                {t.classRoom.teacherProfile}
              </p>
              <h2 className="mt-1 text-2xl font-black text-content">{teacherProfile.name}</h2>
            </div>
            {profileRows.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {profileRows.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-2 px-3.5 py-3 ring-1 ring-line">
                    <p className="text-[10px] font-black uppercase tracking-wide text-faint">{label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-content">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <SelectionTranslationPopover
        key={textSelection?.nonce ?? "closed-selection"}
        request={textSelection}
        onClose={closeSelectionTranslation}
        onAdded={(word) => {
          seenVocabularyEvents.current.add(word.id);
          showVocabularyNotice(word);
        }}
      />

      {!teacher && <StudentClassTimer state={timerState} />}
      {!teacher && studentReaction && (
        <StudentClassReaction
          key={studentReaction.id}
          reaction={studentReaction}
          onDone={closeStudentReaction}
        />
      )}
      {!teacher && (
        <StudentFocusedNote note={focusedNote} onClose={() => setFocusedNote(null)} />
      )}

      {teacher && partner && showTimer && (
        <ClassTimerManager
          state={timerState}
          studentName={partner.name}
          onStateChange={setTimerState}
          onClose={() => setShowTimer(false)}
          notes={<ClassNotes studentName={partner.name} compact />}
        />
      )}

      {teacher && partner && showReactions && (
        <TeacherReactionPanel onClose={() => setShowReactions(false)} />
      )}

      {vocabularyNotice && (
        <div className="fixed right-4 top-4 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-emerald-500 p-4 text-white shadow-2xl ring-4 ring-emerald-300/40">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">✓</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-white/75">
                {t.classVocabulary.addedNotice}
              </p>
              <p className="mt-1 break-words text-base font-black">
                {vocabularyNotice.english} — {vocabularyNotice.translation}
              </p>
            </div>
            <button type="button" onClick={() => setVocabularyNotice(null)} className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Close">
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Нижняя панель — её видят оба, таймер только у учителя. */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md lg:bottom-0">
        {/* Всё одной группой по центру: таймер такой же элемент панели. */}
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-center gap-2">
          {tabBtn("chat", <IconMessage className="h-4 w-4" />, t.classRoom.chat, unread)}
          {tabBtn("dictionary", <IconMaterials className="h-4 w-4" />, t.classRoom.dictionary)}
          {tabBtn("verbs", <IconList className="h-4 w-4" />, t.classRoom.verbs)}
          {teacher && tabBtn("script", <IconFile className="h-4 w-4" />, t.classRoom.script)}
          {tabBtn("board", <IconGrid className="h-4 w-4" />, t.classRoom.board)}
          {teacher && tabBtn("notes", <NotebookPen className="h-4 w-4" />, t.classRoom.notes)}

          {teacher && (
            <button
              type="button"
              disabled={!partner}
              onClick={() => setShowReactions((value) => !value)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
                showReactions
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-content",
              )}
            >
              <ReactionToolbarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.classRoom.reactions}</span>
            </button>
          )}

          {teacher && (
            <button
              type="button"
              disabled={!partner}
              onClick={() => setShowTimer(true)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
                showTimer || timerState
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-surface-2 hover:text-content",
              )}
            >
              <IconClock className="h-4 w-4" />
              <span className="hidden sm:inline">{t.classRoom.timer}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
