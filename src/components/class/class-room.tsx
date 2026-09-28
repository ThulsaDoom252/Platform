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
import { useT } from "@/components/i18n-provider";
import { fmt, type Dict } from "@/lib/i18n";
import {
  CLASS_SORTS,
  orderClassPeople,
  type ClassSortKey,
} from "@/lib/class-order";
import { useLocalJson } from "@/lib/use-local-json";
import {
  heartbeatAction,
  listClassPeopleAction,
  enterClassAction,
  leaveClassAction,
  type ClassPerson,
  type Presence,
} from "@/lib/actions/class";
import { ClassChat } from "./class-chat";
import { QuickVerbs } from "./quick-verbs";
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
import { ClassScript } from "./class-script";
import { ClassTwister } from "./class-twister";
import { ClassActivities } from "./class-activities";
import { StudentGuess } from "@/components/game/student-guess";
import { cn } from "@/lib/utils";

const BEAT_MS = 30_000;

/** Короткая точка статуса: зелёная — на платформе, красная — нет. */
function Dot({ presence, t }: { presence: Presence; t: Dict }) {
  return (
    <span
      title={presence === "online" ? t.classRoom.onlineTitle : t.classRoom.offlineTitle}
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface",
        presence === "online" ? "bg-emerald-500" : "bg-rose-500",
      )}
    />
  );
}

function Timer({ t }: { t: Dict }) {
  // Считаем от метки времени: накопление по тику уезжает на длинном уроке.
  // Само время читается в интервале, а не в рендере — иначе разметка
  // разойдётся при гидратации.
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const before = useRef(0);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = setInterval(() => setMs(before.current + (Date.now() - start)), 250);
    return () => {
      clearInterval(t);
      before.current += Date.now() - start;
    };
  }, [running]);

  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5">
      <IconClock className="h-4 w-4 text-accent" />
      <span className="font-mono text-sm font-bold text-content">
        {mm}:{ss}
      </span>
      <button
        type="button"
        onClick={() => setRunning((v) => !v)}
        className="text-[11px] font-semibold text-muted transition hover:text-content"
      >
        {running ? t.classRoom.timerPause : t.classRoom.timerStart}
      </button>
      <button
        type="button"
        onClick={() => {
          setRunning(false);
          before.current = 0;
          setMs(0);
        }}
        className="text-[11px] font-semibold text-faint transition hover:text-content"
      >
        {t.classRoom.timerReset}
      </button>
    </div>
  );
}

type PanelKey = "chat" | "verbs" | "dictionary" | "board" | "script";

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
    presence: Presence;
  } | null>(null);
  const { t, locale } = useT();
  const [open, setOpen] = useState<Record<PanelKey, boolean>>({
    chat: true,
    verbs: true,
    dictionary: false,
    board: false,
    script: false,
  });
  const [lessonTab, setLessonTab] = useState<LessonTab>("lesson");
  // Порядок в списке — привычка учителя, поэтому живёт в браузере.
  const [sort, setSort] = useLocalJson<ClassSortKey>("class-sort", "lessons");
  const [sortDesc, setSortDesc] = useLocalJson("class-sort-desc", false);
  const [showTimer, setShowTimer] = useState(false);
  const [unread, setUnread] = useState(0);
  const [busy, startBusy] = useTransition();
  const chime = useRef<(() => void) | null>(null);

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
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [teacher, nonce]);

  // У учителя разговор принадлежит ученику, у ученика — ему самому.
  const conversation = teacher ? (partner?.id ?? null) : selfId;

  // Свёрнутость нужна обработчику чата, а не разметке, поэтому живёт
  // в ref: перерисовывать панель из-за неё незачем.
  const chatOpen = useRef(true);
  useEffect(() => {
    chatOpen.current = open.chat;
  }, [open.chat]);

  const onUnread = useCallback((n: number) => {
    if (n <= 0 || chatOpen.current) return;
    setUnread((v) => v + n);
    chime.current?.();
  }, []);

  const toggle = (key: PanelKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    if (key === "chat") setUnread(0);
  };

  /*
   * Сегодня и завтра называем словами, остальные дни — днём недели: на
   * «Wednesday» в середине списка взгляд цепляется хуже, чем на «Завтра».
   */
  const hhmm = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayShort = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "2-digit",
    month: "2-digit",
  });
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    weekday: "long",
  });

  const dayLabel = (day: Date) => {
    const today = new Date();
    const diff = Math.round(
      (day.setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000,
    );
    if (diff === 0) return t.classRoom.today;
    if (diff === 1) return t.classRoom.tomorrow;
    return weekday.format(day);
  };

  const groups = orderClassPeople(people ?? [], sort, sortDesc);

  const tabBtn = (key: PanelKey, icon: React.ReactNode, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => toggle(key)}
      className={cn(
        "relative flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
        open[key] ? "bg-accent text-white" : "text-muted hover:bg-surface-2 hover:text-content",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );

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
        {lessonTab === "twister" && partner ? (
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

  /** Кружок ученика. Сам кружок начинает класс, уголок ведёт в карточку. */
  const circle = (p: ClassPerson) => (
    /* Ссылку нельзя вложить в кнопку, поэтому они рядом. */
    <div key={p.id} className="group relative flex w-24 flex-col items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => startBusy(async () => {
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
            <Dot presence={p.presence} t={t} />
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
        {/* Время урока важнее уровня: по нему список и построен. */}
        {p.nextLessonAt && sort === "lessons" && (
          <span className="font-mono font-bold text-muted">
            {hhmm.format(new Date(p.nextLessonAt))}
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
          <div className="flex flex-wrap gap-5">{group.people.map(circle)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 pb-20 lg:pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
          <Dot presence="online" t={t} />
          <span className="text-sm font-semibold text-content">{selfName}</span>
          <span className="text-[11px] text-faint">{t.classRoom.youAre}</span>
        </div>

        {partner ? (
          /* У учителя плашка ученика — вход в его карточку: во время урока
             профиль нужен чаще всего, а искать его в «Учениках» долго. */
          teacher ? (
            <Link
              href={`/teacher/students/${partner.id}`}
              title={fmt(t.classRoom.profileOf, { name: partner.name })}
              className="group flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line transition hover:ring-accent"
            >
              <Dot presence={partner.presence} t={t} />
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
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
              <Dot presence={partner.presence} t={t} />
              <span className="text-sm font-semibold text-content">{partner.name}</span>
              <span className="text-[11px] text-faint">
                {partner.presence === "online"
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

        {teacher && partner && (
          <button
            type="button"
            disabled={busy}
            onClick={() => startBusy(async () => {
              await leaveClassAction();
              setPartner(null);
              setNonce((n) => n + 1);
            })}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-rose-400 hover:text-rose-500"
          >
            <IconX className="h-4 w-4" /> {t.classRoom.leave}
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {open.script && teacher && partner ? (
            <ClassScript studentId={partner.id} onClose={() => toggle("script")} />
          ) : teacher && !partner ? (
            picker
          ) : teacher ? (
            lessonSection
          ) : (
            /* У ученика секция урока не разложена на части: ему нужна
               карта, а не то, из чего урок собран. */
            <StudentGuess />
          )}
          {open.dictionary && stub(t.classRoom.dictionary)}
          {open.board && stub(t.classRoom.board)}
        </div>

        <div className="flex flex-col gap-4">
          {open.chat && (
            <section className="flex h-[420px] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <ClassChat
                key={conversation ?? "none"}
                studentId={conversation}
                title={
                  partner
                    ? fmt(t.classRoom.chatWith, { name: partner.name })
                    : t.classRoom.chat
                }
                canArchive={teacher}
                onUnread={onUnread}
              />
            </section>
          )}

          {open.verbs && (
            <section className="flex h-[360px] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-content">
                {t.classRoom.verbsTitle}
              </div>
              <QuickVerbs />
            </section>
          )}
        </div>
      </div>

      {/* Нижняя панель — её видят оба, таймер только у учителя. */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-2">
          {tabBtn("chat", <IconMessage className="h-4 w-4" />, t.classRoom.chat, unread)}
          {tabBtn("dictionary", <IconMaterials className="h-4 w-4" />, t.classRoom.dictionary)}
          {tabBtn("verbs", <IconList className="h-4 w-4" />, t.classRoom.verbs)}
          {teacher && tabBtn("script", <IconFile className="h-4 w-4" />, t.classRoom.script)}
          {tabBtn("board", <IconGrid className="h-4 w-4" />, t.classRoom.board)}

          {teacher && (
            <span className="ml-auto flex items-center gap-2">
              {showTimer && <Timer t={t} />}
              <button
                type="button"
                onClick={() => setShowTimer((v) => !v)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
                  showTimer
                    ? "bg-accent text-white"
                    : "text-muted hover:bg-surface-2 hover:text-content",
                )}
              >
                <IconClock className="h-4 w-4" />
                <span className="hidden sm:inline">{t.classRoom.timer}</span>
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
