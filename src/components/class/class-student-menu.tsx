"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { IconCap, IconChevronDown, IconFile, IconMaterials, IconUser } from "@/components/icons";
import { useT } from "@/components/i18n-provider";
import { PresenceIndicator } from "@/components/student-presence";
import type { ClassPresence } from "@/lib/presence";
import { fmt } from "@/lib/i18n";

/** The menu is portalled so the responsive class toolbar cannot clip it. */
export function ClassStudentMenu({ student, summonBusy, onBringToClass }: {
  student: { id: string; name: string; avatarUrl: string | null; presence: ClassPresence };
  summonBusy: boolean;
  onBringToClass: () => void;
}) {
  const { t } = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 64, width: 256, maxHeight: 320 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);
  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const width = Math.min(272, Math.max(0, viewportWidth - 24));
    const below = height - rect.bottom - 20;
    const above = rect.top - 20;
    const up = below < 280 && above > below;
    const maxHeight = Math.max(0, Math.min(360, up ? above : below));
    const actualHeight = Math.min(menu.current?.scrollHeight ?? 280, maxHeight);
    setPosition({
      left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
      top: up ? Math.max(12, rect.top - actualHeight - 8) : rect.bottom + 8,
      width, maxHeight,
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      updatePosition();
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close, updatePosition]);
  const row = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-content outline-none transition hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft focus-visible:text-accent";
  return <>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-label={fmt(t.classRoom.profileOf, { name: student.name })}
      onClick={() => { updatePosition(); setOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); updatePosition(); setOpen(true);
        }
      }}
      className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-surface py-1.5 pl-1.5 pr-3 text-left ring-1 ring-line transition hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="relative shrink-0">
        <Avatar name={student.name} src={student.avatarUrl} className="h-9 w-9 text-sm ring-1 ring-line" />
        <span className="absolute -bottom-0.5 -right-0.5"><PresenceIndicator presence={student.presence} showClassStatus /></span>
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-content">{student.name}</span>
      <span className="shrink-0 text-[11px] text-faint">{student.presence === "in_class" ? t.classRoom.inClass : student.presence === "online" ? t.classRoom.online : t.classRoom.offline}</span>
      <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={fmt(t.classRoom.profileOf, { name: student.name })}
      className="fixed z-[100] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl shadow-black/15" style={position}
      onBlurCapture={event => {
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next) && !trigger.current?.contains(next)) close();
      }}
      onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];
        const active = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : (active + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      <Link role="menuitem" href={`/teacher/students/${encodeURIComponent(student.id)}`} className={row} onClick={() => close()}>
        <IconUser className="h-4 w-4 shrink-0" aria-hidden="true" />{t.nav.profile}
      </Link>
      <Link role="menuitem" href={`/teacher/homeworks?student=${encodeURIComponent(student.id)}`}
        title={fmt(t.classRoom.studentHomeworkTitle, { name: student.name })}
        aria-label={fmt(t.classRoom.studentHomeworkTitle, { name: student.name })} className={row} onClick={() => close()}>
        <IconFile className="h-4 w-4 shrink-0" aria-hidden="true" />{t.classRoom.studentHomework}
      </Link>
      <Link role="menuitem" href={`/teacher/students/${encodeURIComponent(student.id)}/materials`} className={row}
        aria-label={`${t.nav.materials} — ${student.name}`} onClick={() => close()}>
        <IconMaterials className="h-4 w-4 shrink-0" aria-hidden="true" />{t.nav.materials}
      </Link>
      <button type="button" role="menuitem" disabled={summonBusy} aria-busy={summonBusy}
        onClick={() => { close(true); onBringToClass(); }} className={`${row} text-accent disabled:cursor-wait disabled:opacity-45`}>
        <IconCap className="h-4 w-4 shrink-0" aria-hidden="true" />{summonBusy ? t.classRoom.bringToClassSending : t.classRoom.bringToClass}
      </button>
    </div>, document.body)}
  </>;
}

export function ClassLeaveButton({ busy, onLeave }: { busy: boolean; onLeave: () => void }) {
  const { t } = useT();
  return <button type="button" disabled={busy} onClick={onLeave} title={t.classRoom.leave} aria-label={t.classRoom.leave}
    className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-45">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 21h11M4 21V3h10v18M18 21v-5l-3-3 1-5" />
      <circle cx="17" cy="4" r="1.5" />
      <path d="m15.5 8 3.5 3h3M15 13l-4 3v4M16 8l-4 3" />
    </svg>
  </button>;
}
