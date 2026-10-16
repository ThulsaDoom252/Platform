"use client";

/**
 * Класс: общая оболочка для учителя и ученика.
 *
 * Снизу панель, которую видят оба; таймер в ней есть только у учителя.
 * Справа сворачиваемые панели — чат и табличка глаголов. Они включены
 * по умолчанию и у учителя работают даже вне класса: переписку можно
 * вести и между уроками.
 *
 * Изменения класса приходят по WebSocket. Серверные чтения выполняются
 * только после события или как редкая страховка при недоступном realtime.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { useAppView } from "@/components/app-view-provider";
import { classParticipantsPlacement } from "@/lib/app-view";
import { ClassMaterialToolbar } from "./class-material-toolbar";
import { ClassLeaveButton, ClassStudentMenu } from "./class-student-menu";
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
import { useUiChoice, useUiPreference } from "@/components/ui-preferences-provider";
import {
  classTeacherProfileAction,
  heartbeatAction,
  unreadMessagesAction,
  listClassPeopleAction,
  enterClassAction,
  leaveClassAction,
  type ClassPerson,
  type ClassPartnerProfile,
} from "@/lib/actions/class";
import { type ClassPresence } from "@/lib/presence";
import { sendClassSummons } from "@/lib/class-summons-request";
import { PresenceIndicator, usePresenceMap } from "@/components/student-presence";
const ClassChat = dynamic(() => import("./class-chat").then((m) => m.ClassChat));
const QuickVerbs = dynamic(() => import("./quick-verbs").then((m) => m.QuickVerbs));
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
} from "@/components/icons";
const ClassScript = dynamic(() => import("./class-script").then((m) => m.ClassScript));
const ClassBoard = dynamic(() => import("./class-board").then((m) => m.ClassBoard));
const ClassTwister = dynamic(() => import("./class-twister").then((m) => m.ClassTwister));
const TwisterViewer = dynamic(() => import("@/components/twisters/twister-viewer").then((m) => m.TwisterViewer));
import {
  twisterSessionAction,
  type ClassTwisterSession,
} from "@/lib/actions/tongue-twisters";
const ClassActivities = dynamic(() => import("./class-activities").then((m) => m.ClassActivities));
const ClassLesson = dynamic(() => import("./class-lesson").then((m) => m.ClassLesson));
const ClassVocabulary = dynamic(() => import("./class-vocabulary").then((m) => m.ClassVocabulary));
import type { ClassVocabularyWord } from "@/lib/actions/class-vocabulary";
import { createClassVocabularyNoticeTracker } from "@/lib/class-vocabulary-notices";
import {
  SelectionTranslationPopover,
  type ClassTextSelection,
} from "./selection-translation-popover";
const StudentGuess = dynamic(() => import("@/components/game/student-guess").then((m) => m.StudentGuess));
const WordDeckBoard = dynamic(() => import("@/components/game/word-deck-board").then((m) => m.WordDeckBoard));
import {
  focusedClassWordDeckAction,
  type ClassWordDeckActivity,
} from "@/lib/actions/word-deck";
const RevisionClassRunner = dynamic(() => import("@/components/revision/revision-class-runner").then((m) => m.RevisionClassRunner));
import { cn } from "@/lib/utils";
import type { ClassVideoState } from "@/lib/class-video";
import type { ClassTimerState } from "@/lib/class-timer";
import { ClassTimerManager, StudentClassTimer } from "./class-timer";
import type { FocusedClassNote } from "./class-notes";
const ClassNotes = dynamic(() => import("./class-notes").then((m) => m.ClassNotes));
const StudentFocusedNote = dynamic(() => import("./class-notes").then((m) => m.StudentFocusedNote));
import { ClassGameReviewBanner } from "./class-game-review";
import type { ClassGameReview } from "@/lib/class-game-meta";
import type { ClassReaction } from "@/lib/class-reaction";
import {
  ReactionToolbarIcon,
  StudentClassReaction,
  TeacherReactionPanel,
} from "./class-reactions";
import { useRealtimeSubscription } from "@/lib/use-realtime";
import { readClassLive } from "@/lib/class-live-request";

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
  const { view } = useAppView();
  const livePresences = usePresenceMap();

  const [people, setPeople] = useState<ClassPerson[] | null>(null);
  const [partnerSnapshot, setPartner] = useState<{
    id: string;
    name: string;
    avatarUrl: string | null;
    presence: ClassPresence;
  } | null>(null);
  const partner = partnerSnapshot ? {
    ...partnerSnapshot,
    presence: livePresences[partnerSnapshot.id] ?? partnerSnapshot.presence,
  } : null;
  const { t, locale } = useT();
  const presenceLabel = (presence: ClassPresence) => presence === "in_class"
    ? t.classRoom.inClass : presence === "online" ? t.classRoom.online : t.classRoom.offline;
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
  const [sort, setSort] = useUiChoice<ClassSortKey>("class:sort", CLASS_SORTS, "lessons", "class-sort");
  const [sortDesc, setSortDesc] = useUiPreference<boolean>("class:sort-desc", false, (value) => typeof value === "boolean", "class-sort-desc");
  const [showTimer, setShowTimer] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [timerState, setTimerState] = useState<ClassTimerState | null>(null);
  const [studentReactions, setStudentReactions] = useState<ClassReaction[]>([]);
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
  const [textSelection, setTextSelection] = useState<(ClassTextSelection & { session: object }) | null>(null);
  const [vocabularyNotice, setVocabularyNotice] = useState<{
    id: string;
    english: string;
    translation: string;
    session: object;
  } | null>(null);
  const [busy, startBusy] = useTransition();
  const [profileBusy, startProfile] = useTransition();
  const [teacherProfile, setTeacherProfile] = useState<ClassPartnerProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [summonNotice, setSummonNotice] = useState<string | null>(null);
  const [summonBusy, startSummon] = useTransition();
  const [summonPending, setSummonPending] = useState<{ studentId: string; expiresAt: string } | null>(null);
  const chime = useRef<(() => void) | null>(null);
  const unreadRef = useRef(0);
  const boardOpen = useRef(false);
  const appliedView = useRef<string | null>(null);
  const appliedNote = useRef<string | null>(null);
  const appliedGameReviewNotice = useRef<string | null>(null);
  const seenReactionIds = useRef(new Set<string>());
  const reactionHistoryReady = useRef(false);
  const activeVocabularyTracker = useRef<ReturnType<typeof createClassVocabularyNoticeTracker> | null>(null);
  const vocabularyNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<() => void>(() => {});
  const unreadRefreshRef = useRef<() => void>(() => {});
  const classSyncRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!summonPending) return;
    const entered = partner?.id === summonPending.studentId && partner.presence === "in_class";
    const switched = partner?.id !== summonPending.studentId;
    const frame = entered || switched ? requestAnimationFrame(() => {
      setSummonPending(null);
      setSummonNotice(entered ? t.classRoom.bringToClassSent : null);
    }) : null;
    const timer = !entered && !switched ? window.setTimeout(() => {
      setSummonPending(null);
      setSummonNotice(t.classRoom.bringToClassRetry);
    }, Math.max(0, Date.parse(summonPending.expiresAt) - Date.now())) : null;
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [summonPending, partner?.id, partner?.presence, t]);

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
    heartbeatRef.current = beat;

    beat();

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
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [teacher, nonce]);

  useRealtimeSubscription({
    channel: `user:${selfId}`,
    events: "class-people",
    onMessage: () => heartbeatRef.current(),
    onFallback: () => heartbeatRef.current(),
    fallbackMs: 60_000,
  });

  // У учителя разговор принадлежит ученику, у ученика — ему самому.
  const conversation = teacher ? (partner?.id ?? null) : selfId;
  const vocabularyTracker = useMemo(() => conversation
    ? createClassVocabularyNoticeTracker(conversation) : null, [conversation]);
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
    unreadRefreshRef.current = loadUnread;

    loadUnread();
    return () => {
      alive = false;
    };
  }, [conversation, open.chat]);

  useRealtimeSubscription({
    channel: conversation ? `class:${conversation}` : null,
    events: "chat",
    onMessage: () => unreadRefreshRef.current(),
    onFallback: () => unreadRefreshRef.current(),
    fallbackMs: 30_000,
    enabled: !open.chat,
  });

  useEffect(() => {
    activeVocabularyTracker.current = vocabularyTracker;
    if (vocabularyNoticeTimer.current) clearTimeout(vocabularyNoticeTimer.current);
    const frame = requestAnimationFrame(() => {
      setVocabularyNotice((current) => current?.session === vocabularyTracker ? current : null);
      setTextSelection((current) => current?.session === vocabularyTracker ? current : null);
    });
    return () => {
      if (activeVocabularyTracker.current === vocabularyTracker) activeVocabularyTracker.current = null;
      if (vocabularyNoticeTimer.current) clearTimeout(vocabularyNoticeTimer.current);
      cancelAnimationFrame(frame);
    };
  }, [vocabularyTracker]);

  const showVocabularyNotice = useCallback((word: {
    id: string;
    english: string;
    translation: string;
  }) => {
    if (!vocabularyTracker || activeVocabularyTracker.current !== vocabularyTracker) return;
    const notice = { ...word, session: vocabularyTracker };
    setVocabularyNotice(notice);
    chime.current?.();
    if (vocabularyNoticeTimer.current) clearTimeout(vocabularyNoticeTimer.current);
    vocabularyNoticeTimer.current = setTimeout(() => setVocabularyNotice((current) => current === notice ? null : current), 6_000);
  }, [vocabularyTracker]);

  const vocabularyAdded = useCallback((word: Pick<ClassVocabularyWord, "id" | "english" | "translation">) => {
    if (!vocabularyTracker || activeVocabularyTracker.current !== vocabularyTracker || !vocabularyTracker.added(word)) return;
    showVocabularyNotice(word);
  }, [vocabularyTracker, showVocabularyNotice]);

  const translateSelectedText = useCallback((selection: ClassTextSelection) => {
    if (!vocabularyTracker || activeVocabularyTracker.current !== vocabularyTracker) return;
    setTextSelection({ ...selection, session: vocabularyTracker });
  }, [vocabularyTracker]);

  const closeSelectionTranslation = useCallback(() => {
    setTextSelection(null);
  }, []);

  const closeStudentReaction = useCallback((id: string) => {
    setStudentReactions((current) => current.filter((reaction) => reaction.id !== id));
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
    // A picker/unknown partner has no word history to initialize. Scope both
    // the shared HTTP cache and the response to the actual student.
    if (!conversation || !vocabularyTracker) {
      classSyncRef.current = async () => {};
      return;
    }
    let alive = true;

    const tick = () => {
      return readClassLive("focus", conversation, boardOpen.current)
        .then((sync) => {
          if (!alive || sync.studentId !== conversation) return;
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
            if (!reactionHistoryReady.current) {
              try {
                const key = `class-reaction-seen:${selfId}`;
                const stored = JSON.parse(window.sessionStorage.getItem(key) ?? "[]");
                if (Array.isArray(stored)) {
                  stored
                    .filter((id): id is string => typeof id === "string")
                    .forEach((id) => seenReactionIds.current.add(id));
                }
              } catch {}
              reactionHistoryReady.current = true;
            }
            const freshReactions = sync.reactions.filter(
              (reaction) => !seenReactionIds.current.has(reaction.id),
            );
            if (freshReactions.length > 0) {
              freshReactions.forEach((reaction) => seenReactionIds.current.add(reaction.id));
              setStudentReactions((current) => [...current, ...freshReactions].slice(-100));
              try {
                const key = `class-reaction-seen:${selfId}`;
                window.sessionStorage.setItem(
                  key,
                  JSON.stringify([...seenReactionIds.current].slice(-200)),
                );
              } catch {}
            }
          }
          if (!teacher && sync.noteFocus && appliedNote.current !== sync.noteFocus.at) {
            appliedNote.current = sync.noteFocus.at;
            setFocusedNote(sync.noteFocus);
          }

          const freshWord = vocabularyTracker.receive(sync.studentId, sync.vocabularyEvents);
          if (freshWord) showVocabularyNotice(freshWord);

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
    classSyncRef.current = tick;

    tick();
    return () => {
      alive = false;
    };
  }, [conversation, open.board, selfId, showVocabularyNotice, teacher, vocabularyTracker]);

  useRealtimeSubscription({
    channel: conversation ? `class:${conversation}` : null,
    events: ["class-sync", "vocabulary"],
    onMessage: () => classSyncRef.current(),
    onFallback: () => classSyncRef.current(),
    // Class navigation, focus and teacher reactions must remain live even
    // when the realtime provider is temporarily unavailable.
    fallbackMs: 500,
  });

  useRealtimeSubscription({
    channel: conversation ? `class:${conversation}` : null,
    events: "learning-language",
    onMessage: async () => {
      if (!teacher) setFocusedWordDeck(await focusedClassWordDeckAction());
      await classSyncRef.current();
    },
  });

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

  const groups = orderClassPeople(
    (people ?? []).map((person) => ({
      ...person,
      presence: livePresences[person.id] ?? person.presence,
    })),
    sort,
    sortDesc,
  );

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
  const materialsLoaded = Boolean(activeLessonId || focusedWordDeck || focusedRevisionId || twisterSession);
  const participantsPlacement = classParticipantsPlacement(view, teacher, materialsLoaded);
  const participants = (
      <div className="class-participants flex min-w-0 flex-wrap items-center gap-3" data-class-participants>
        <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
          <PresenceIndicator presence="online" />
          <span className="min-w-0 truncate text-sm font-semibold text-content">{selfName}</span>
          <span className="shrink-0 text-[11px] text-faint">{t.classRoom.youAre}</span>
        </div>

        {partner ? (
          teacher ? (
            <div className="class-participant-student flex min-w-0 max-w-full items-center gap-2">
              <ClassStudentMenu key={partner.id} student={partner} summonBusy={summonBusy}
                onBringToClass={() => startSummon(async () => {
                  const studentId = partner.id;
                  setSummonNotice(null);
                  try {
                    const result = await sendClassSummons(studentId);
                    if (result.error || !result.expiresAt) {
                      setSummonNotice(result.error ?? t.classRoom.bringToClassRetry);
                      return;
                    }
                    setSummonPending({ studentId, expiresAt: result.expiresAt });
                    setSummonNotice(t.classRoom.bringToClassPending);
                  } catch { setSummonNotice(t.classRoom.bringToClassRetry); }
                })}
              />
              <ClassLeaveButton busy={busy} onLeave={() => startBusy(async () => {
                await leaveClassAction();
                setPartner(null);
                setActiveLessonId(null);
                setTimerState(null);
                setShowTimer(false);
                setShowReactions(false);
                setNonce((n) => n + 1);
              })} />
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
                  <PresenceIndicator presence={partner.presence} showClassStatus />
                </span>
              </button>
              <span className="text-sm font-semibold text-content">{partner.name}</span>
              <span className="text-[11px] text-faint">
                {profileBusy
                  ? t.common.loading
                  : presenceLabel(partner.presence)}
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-faint">
            {teacher ? t.classRoom.notStarted : t.classRoom.waitingTeacher}
          </span>
        )}

        {profileError && (
          <span className="w-full text-xs font-semibold text-rose-500">{profileError}</span>
        )}

        {summonNotice && (
          <span role="status" aria-live="polite" className="w-full text-xs font-semibold text-accent">{summonNotice}</span>
        )}
      </div>
  );

  const LESSON_TABS: { key: LessonTab; label: string }[] = [
    { key: "lesson", label: t.classRoom.lesson },
    { key: "twister", label: t.classRoom.tongueTwister },
    { key: "activities", label: t.classRoom.activities },
  ];

  const lessonTabButton = (tab: (typeof LESSON_TABS)[number]) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setLessonTab(tab.key)}
      aria-pressed={lessonTab === tab.key}
      className={cn(
        "h-9 shrink-0 whitespace-nowrap rounded-xl font-semibold transition",
        view === "UPDATED" ? "px-2 text-xs sm:px-3.5 sm:text-sm" : "px-3.5 text-sm",
        lessonTab === tab.key
          ? "bg-accent text-white"
          : "text-muted hover:bg-surface-2 hover:text-content",
      )}
    >
      {tab.label}
    </button>
  );

  const lessonSection = (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <ClassMaterialToolbar lesson={lessonTabButton(LESSON_TABS[0])} groupSections={view === "UPDATED"} actions={LESSON_TABS.slice(1).map(lessonTabButton)} participants={participantsPlacement === "TEACHER_INLINE" ? participants : undefined} />

      <div className="flex flex-1 flex-col justify-center">
        {lessonTab === "lesson" && partner ? (
          <ClassLesson
            teacher
            studentId={partner.id}
            assignmentId={activeLessonId}
            videoSync={videoSync}
            onAssigned={setActiveLessonId}
            onTextSelect={translateSelectedText}
          />
        ) : lessonTab === "twister" && partner ? (
          <ClassTwister studentId={partner.id} studentName={partner.name} />
        ) : lessonTab === "activities" && partner ? (
          <ClassActivities key={partner.id} studentId={partner.id} />
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
            <PresenceIndicator presence={p.presence} showClassStatus />
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
  const reactionsPlacement = placementOf("reactions");
  const dockedDictionary = open.dictionary && !dictionaryPlacement.floating;
  const dockedRight =
    (open.chat && !chatPlacement.floating) ||
    (open.verbs && !verbsPlacement.floating) ||
    Boolean(teacher && partner && open.script && !scriptPlacement.floating) ||
    Boolean(teacher && partner && open.notes && !notesPlacement.floating) ||
    Boolean(teacher && partner && showReactions && !reactionsPlacement.floating);
  const chatTitle = partner
    ? fmt(t.classRoom.chatWith, { name: partner.name })
    : t.classRoom.chat;
  const notesTitle = partner
    ? fmt(t.classRoom.notesWith, { name: partner.name })
    : t.classRoom.notes;
  const floatingReactions = studentReactions.filter((reaction) => reaction.mode === "float");
  const emergeReaction = studentReactions.find((reaction) => reaction.mode === "emerge") ?? null;
  const panelOrderReset = view === "UPDATED"
    ? dockedDictionary && dockedRight ? "2xl:order-none" : "xl:order-none"
    : "lg:order-none";

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 pb-20 lg:pb-24" data-class-room>
      {!teacher && gameReviewNotice && (
        <ClassGameReviewBanner review={gameReviewNotice} floating onClose={() => setGameReviewNotice(null)} />
      )}
      {participantsPlacement === "ABOVE" && <div data-participants-placement="above">{participants}</div>}

      {/* Закреплённые панели занимают свои колонки и идут вслед за экраном.
          Откреплённые становятся плавающими, поэтому урок сразу расширяется. */}
      <div
        className={cn(
          "grid gap-4",
          view === "UPDATED" ? (
            dockedDictionary && dockedRight
              ? "2xl:grid-cols-[320px_minmax(0,1fr)_320px]"
              : dockedDictionary
                ? "xl:grid-cols-[320px_minmax(0,1fr)]"
                : dockedRight
                  ? "xl:grid-cols-[minmax(0,1fr)_320px]"
                  : "grid-cols-1"
          ) : dockedDictionary && dockedRight
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
            dockedClassName={cn("order-2 h-[620px] max-h-[calc(100dvh-9rem)] lg:sticky lg:top-20", panelOrderReset)}
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
              studentId={conversation}
              ready={!!conversation}
              compact
              onAdded={vocabularyAdded}
            />
          </DockablePanel>
        )}

        <div className={cn("order-1 flex min-w-0 flex-col gap-4", panelOrderReset)}>
          {participantsPlacement === "STUDENT_INLINE" && <ClassMaterialToolbar student participants={participants} />}
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
                realtimeChannel={conversation ? `class:${conversation}` : null}
              />
            ) : (
              <StudentGuess
                studentId={selfId}
                fallback={(
                  <ClassLesson
                    teacher={false}
                    studentId={selfId}
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
            "order-3 flex min-w-0 flex-col gap-4", panelOrderReset,
            dockedRight
              ? "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto"
              : "contents",
          )}
        >
          {teacher && partner && showReactions && (
            <DockablePanel
              title={t.classRoom.reactionsTitle}
              placement={reactionsPlacement}
              dockedClassName="h-[420px] shrink-0"
              detachLabel={t.classRoom.detachPanel}
              dockLabel={t.classRoom.dockPanel}
              resizeLabel={t.classRoom.resizePanel}
              onDetach={() => detachPanel("reactions")}
              onDock={() => dockPanel("reactions")}
              onMove={(x, y) => movePanel("reactions", x, y)}
              onResize={(width, height) => resizePanel("reactions", width, height)}
              onClose={() => setShowReactions(false)}
              closeLabel={t.common.close}
            >
              <TeacherReactionPanel />
            </DockablePanel>
          )}

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
              <QuickVerbs studentId={teacher ? partner?.id : selfId} />
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
          studentId={conversation}
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
          realtimeChannel={`class:${selfId}`}
          onClose={() => setTwisterSession(null)}
        />
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
        key={`${conversation ?? "no-student"}:${textSelection?.nonce ?? "closed-selection"}`}
        request={textSelection?.session === vocabularyTracker ? textSelection : null}
        onClose={closeSelectionTranslation}
        onAdded={vocabularyAdded}
      />

      {!teacher && <StudentClassTimer state={timerState} />}
      {!teacher && floatingReactions.map((reaction) => (
          <StudentClassReaction
            key={reaction.id}
            reaction={reaction}
            onDone={closeStudentReaction}
          />
        ))}
      {!teacher && emergeReaction && (
          <StudentClassReaction
            key={emergeReaction.id}
            reaction={emergeReaction}
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

      {vocabularyNotice && vocabularyNotice.session === vocabularyTracker && (
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
      <div className="class-utility-bar fixed inset-x-0 bottom-[56px] z-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md lg:bottom-0">
        {/* Всё одной группой по центру: таймер такой же элемент панели. */}
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-center gap-2">
          {tabBtn("chat", <IconMessage className="h-4 w-4" />, t.classRoom.chat, unread)}
          {tabBtn("dictionary", <IconMaterials className="h-4 w-4" />, t.classRoom.dictionary)}
          {tabBtn("verbs", <IconList className="h-4 w-4" />, t.classRoom.verbs)}
          {teacher && tabBtn("script", <IconFile className="h-4 w-4" />, t.classRoom.script)}
          {tabBtn("board", <IconGrid className="h-4 w-4" />, t.classRoom.board)}
          {teacher && tabBtn("notes", <NotebookPen className="h-4 w-4" />, t.classRoom.notes)}
          {teacher && <div data-class-highlight-launcher className="contents" />}

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
