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
import { cn } from "@/lib/utils";

const BEAT_MS = 30_000;

/** Короткая точка статуса: зелёная — на платформе, красная — нет. */
function Dot({ presence }: { presence: Presence }) {
  return (
    <span
      title={presence === "online" ? "На платформе" : "Не в сети"}
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface",
        presence === "online" ? "bg-emerald-500" : "bg-rose-500",
      )}
    />
  );
}

function Timer() {
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
        {running ? "пауза" : "пуск"}
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
        сброс
      </button>
    </div>
  );
}

type PanelKey = "chat" | "verbs" | "dictionary" | "board" | "activities" | "script";

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
  const [open, setOpen] = useState<Record<PanelKey, boolean>>({
    chat: true,
    verbs: true,
    dictionary: false,
    board: false,
    activities: false,
    script: false,
  });
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
      <p className="mt-1 text-[12px] text-faint">Появится позже — место уже занято.</p>
    </div>
  );

  /** Выбор ученика: пока класс не начат, кружочки на весь экран. */
  const picker = (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="text-lg font-bold text-content">С кем проводим класс</h2>
      <p className="mt-1 text-sm text-muted">
        Нажми на ученика — класс откроется и он увидит, что ты на месте.
      </p>

      {people === null && <p className="mt-6 text-sm text-faint">Загружаю…</p>}

      <div className="mt-6 flex flex-wrap gap-5">
        {(people ?? []).map((p) => (
          /* Сам кружок начинает класс, а уголок слева ведёт в карточку:
             ссылку нельзя вложить в кнопку, поэтому они рядом. */
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
                  <Dot presence={p.presence} />
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
            {p.level && <span className="text-[11px] text-faint">{p.level}</span>}

            <Link
              href={`/teacher/students/${p.id}`}
              title={`Профиль — ${p.name}`}
              aria-label={`Профиль — ${p.name}`}
              className="absolute -left-1 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-faint opacity-0 ring-1 ring-line transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
            >
              <IconUser className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 pb-20 lg:pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
          <Dot presence="online" />
          <span className="text-sm font-semibold text-content">{selfName}</span>
          <span className="text-[11px] text-faint">это ты</span>
        </div>

        {partner ? (
          /* У учителя плашка ученика — вход в его карточку: во время урока
             профиль нужен чаще всего, а искать его в «Учениках» долго. */
          teacher ? (
            <Link
              href={`/teacher/students/${partner.id}`}
              title={`Профиль — ${partner.name}`}
              className="group flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line transition hover:ring-accent"
            >
              <Dot presence={partner.presence} />
              <span className="text-sm font-semibold text-content group-hover:text-accent">
                {partner.name}
              </span>
              <span className="text-[11px] text-faint">
                {partner.presence === "online" ? "на платформе" : "не в сети"}
              </span>
              <IconUser className="h-3.5 w-3.5 text-faint transition group-hover:text-accent" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ring-line">
              <Dot presence={partner.presence} />
              <span className="text-sm font-semibold text-content">{partner.name}</span>
              <span className="text-[11px] text-faint">
                {partner.presence === "online" ? "на платформе" : "не в сети"}
              </span>
            </div>
          )
        ) : (
          <span className="text-[12px] text-faint">
            {teacher ? "Класс не начат" : "Учитель ещё не начал класс"}
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
            <IconX className="h-4 w-4" /> Выйти из класса
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {open.script && teacher && partner ? (
            <ClassScript studentId={partner.id} onClose={() => toggle("script")} />
          ) : teacher && !partner ? (
            picker
          ) : (
            stub("Урок")
          )}
          {open.dictionary && stub("Словник")}
          {open.board && stub("Доска")}
          {open.activities && stub("Активности")}
        </div>

        <div className="flex flex-col gap-4">
          {open.chat && (
            <section className="flex h-[420px] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <ClassChat
                key={conversation ?? "none"}
                studentId={conversation}
                title={partner ? `Чат — ${partner.name}` : "Чат"}
                canArchive={teacher}
                onUnread={onUnread}
              />
            </section>
          )}

          {open.verbs && (
            <section className="flex h-[360px] flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-content">
                Неправильные глаголы
              </div>
              <QuickVerbs />
            </section>
          )}
        </div>
      </div>

      {/* Нижняя панель — её видят оба, таймер только у учителя. */}
      <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-2">
          {tabBtn("chat", <IconMessage className="h-4 w-4" />, "Чат", unread)}
          {tabBtn("dictionary", <IconMaterials className="h-4 w-4" />, "Словник")}
          {tabBtn("verbs", <IconList className="h-4 w-4" />, "Irregular verbs")}
          {teacher && tabBtn("script", <IconFile className="h-4 w-4" />, "Скрипт")}
          {tabBtn("board", <IconGrid className="h-4 w-4" />, "Доска")}
          {tabBtn("activities", <IconGrid className="h-4 w-4" />, "Активности")}

          {teacher && (
            <span className="ml-auto flex items-center gap-2">
              {showTimer && <Timer />}
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
                <span className="hidden sm:inline">Таймер</span>
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
