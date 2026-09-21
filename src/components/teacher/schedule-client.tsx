"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  cancelLessonByTeacherAction,
  deleteLessonAction,
  rescheduleLessonAction,
  assignLessonAction,
  type AssignState,
} from "@/lib/actions/teacher";
import {
  IconPencil,
  IconTrash,
  IconX,
  IconLayers,
  IconCalendar,
  IconPlus,
  IconUser,
  IconCheck,
} from "@/components/icons";

export type LessonItem = {
  id: string;
  startTime: Date;
  duration: number;
  topic: string | null;
  status: string;
  studentId: string;
  studentName: string;
  studentLevel: string | null;
  studentBalance: number;
  teacherComment: string | null;
  cancelReason: string | null;
};

export type StudentItem = {
  id: string;
  name: string;
  level: string | null;
  balance: number;
};

const hm = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const wdShort = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const dFull = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dShort = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Значение для <input type="datetime-local"> без сдвига по UTC. */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const CANCELLED_STATUSES = [
  "CANCELLED_BY_STUDENT",
  "CANCELLED_BY_TEACHER",
  "BURNED",
];

/**
 * Цвет урока в графике:
 *   отменённый (кем угодно) — красный,
 *   уже прошедший — зелёный,
 *   предстоящий — жёлтый.
 */
function lessonTone(lesson: { status: string; startTime: Date }, now: Date) {
  if (CANCELLED_STATUSES.includes(lesson.status)) return "var(--lesson-rose)";
  if (lesson.startTime.getTime() < now.getTime()) return "var(--lesson-green)";
  return "var(--lesson-amber)";
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-faint">{label}</span>
        <span className="block truncate text-sm font-semibold text-content">{value}</span>
        {hint && <span className="block truncate text-[11px] text-muted">{hint}</span>}
      </span>
    </div>
  );
}

export function ScheduleClient({
  days,
  hours,
  rowH,
  lessons,
  students,
  now,
  selected,
  isDay,
  view,
}: {
  days: Date[];
  hours: number[];
  rowH: number;
  lessons: LessonItem[];
  students: StudentItem[];
  now: Date;
  selected: Date;
  isDay: boolean;
  view: string;
}) {
  const [editing, setEditing] = useState<LessonItem | null>(null);
  const [assignSlot, setAssignSlot] = useState<Date | null>(null);
  const [comment, setComment] = useState("");
  const [newStart, setNewStart] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { t } = useT();

  const [assignState, assignFormAction, assignPending] = useActionState<
    AssignState,
    FormData
  >(assignLessonAction, {});

  // После любого серверного действия данные обновляются — закрываем окно редактирования.
  useEffect(() => {
    setEditing(null);
  }, [lessons]);

  // Успешное назначение: закрываем окно и показываем сообщение, которое не исчезнет при ревалидации.
  useEffect(() => {
    if (assignState.ok && assignState.message) {
      setToast(assignState.message);
      setAssignSlot(null);
    }
  }, [assignState]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  function openEdit(l: LessonItem) {
    setEditing(l);
    setComment("");
    setNewStart(toLocalInput(l.startTime));
  }

  const hFrom = hours[0] ?? 8;
  const gridH = hours.length * rowH;

  const selectedLessons = lessons.filter((l) => sameDay(l.startTime, selected));
  const href = (d: Date) => `/teacher/schedule?date=${toISODate(d)}&view=${view}`;

  return (
    <>
      {/* ---------- Недельная сетка ---------- */}
      <section
        className={`${isDay ? "hidden" : "hidden md:block"} overflow-hidden rounded-2xl bg-surface ring-1 ring-line shadow-sm`}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div
              className="grid border-b border-line"
              style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}
            >
              <div className="px-2 py-3 text-[11px] font-medium text-faint">Время</div>
              {days.map((d) => {
                const today = sameDay(d, now);
                return (
                  <Link
                    key={d.toISOString()}
                    href={href(d)}
                    className="border-l border-line px-2 py-3 text-center transition hover:bg-surface-2"
                  >
                    <p className={`text-[11px] uppercase ${today ? "text-accent" : "text-faint"}`}>
                      {wdShort.format(d)}
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${today ? "text-accent" : "text-content"}`}
                    >
                      {d.getDate()}
                    </p>
                  </Link>
                );
              })}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}
            >
              <div className="relative" style={{ height: gridH }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 pr-2 text-right text-[11px] text-faint"
                    style={{ top: i * rowH - 6 }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const dayLessons = lessons.filter((l) => sameDay(l.startTime, day));
                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-l border-line"
                    style={{
                      height: gridH,
                      backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${rowH}px)`,
                    }}
                  >
                    {/* Пустые слоты — клик добавляет урок */}
                    {hours.map((h, i) => {
                      const slot = new Date(day);
                      slot.setHours(h, 0, 0, 0);
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setAssignSlot(slot)}
                          title={`${t.schedule.assignTitle} · ${String(h).padStart(2, "0")}:00`}
                          className="group absolute left-0 right-0 transition hover:bg-accent-soft"
                          style={{ top: i * rowH, height: rowH }}
                        >
                          <span className="pointer-events-none flex h-full items-center justify-center text-accent opacity-0 transition group-hover:opacity-100">
                            <IconPlus className="h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}

                    {/* Уроки */}
                    {dayLessons.map((l) => {
                      const top =
                        (l.startTime.getHours() + l.startTime.getMinutes() / 60 - hFrom) * rowH;
                      const height = Math.max(28, (l.duration / 60) * rowH - 4);
                      const end = new Date(l.startTime.getTime() + l.duration * 60000);
                      const c = lessonTone(l, now);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => openEdit(l)}
                          className="absolute left-1 right-1 flex items-center overflow-hidden rounded-lg px-2.5 text-left shadow-sm transition hover:brightness-110"
                          style={{ top, height, background: c }}
                          title={`${l.studentName} · ${hm.format(l.startTime)}–${hm.format(end)} · ${t.lessonStatus[l.status as keyof typeof t.lessonStatus]}`}
                        >
                          <span className="truncate text-xs font-bold text-white">
                            {l.studentName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Дневной список (мобильный / вид «День») ---------- */}
      <section className={isDay ? "block" : "md:hidden"}>
        <div className="mb-4 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const active = sameDay(d, selected);
            const today = sameDay(d, now);
            return (
              <Link
                key={d.toISOString()}
                href={href(d)}
                className={`flex flex-col items-center rounded-xl px-1 py-2 ring-1 transition ${
                  active
                    ? "bg-accent text-white ring-transparent"
                    : "bg-surface text-muted ring-line hover:bg-surface-2"
                }`}
              >
                <span className="text-[11px] uppercase opacity-80">{wdShort.format(d)}</span>
                <span
                  className={`mt-0.5 text-base font-bold ${active ? "text-white" : today ? "text-accent" : "text-content"}`}
                >
                  {d.getDate()}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold capitalize text-content">
                {dFull.format(selected)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const s = new Date(selected);
                s.setHours(Math.max(hFrom, Math.min(20, now.getHours() + 1)), 0, 0, 0);
                setAssignSlot(s);
              }}
              className="flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent"
            >
              <IconPlus className="h-3.5 w-3.5" /> {t.schedule.addLesson}
            </button>
          </div>

          {selectedLessons.length === 0 && (
            <p className="py-8 text-center text-sm text-faint">
              {t.schedule.noLessonsThisDay}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            {selectedLessons.map((l) => {
              const c = lessonTone(l, now);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => openEdit(l)}
                  className="flex items-stretch gap-3 text-left"
                >
                  <span className="w-12 shrink-0 pt-3 text-xs font-semibold text-muted">
                    {hm.format(l.startTime)}
                  </span>
                  <span
                    className="flex min-w-0 flex-1 items-center rounded-xl px-3.5 py-3 shadow-sm"
                    style={{ background: c }}
                  >
                    <span className="truncate text-sm font-bold text-white">
                      {l.studentName}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          const s = new Date(selected);
          s.setHours(Math.max(hFrom, Math.min(20, now.getHours() + 1)), 0, 0, 0);
          setAssignSlot(s);
        }}
        aria-label={t.schedule.assignTitle}
        className="grad-accent fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:opacity-90 lg:hidden"
      >
        <IconPlus className="h-6 w-6" />
      </button>

      {/* ---------- Окно редактирования урока ---------- */}
      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <EditLessonBody
            lesson={editing}
            comment={comment}
            setComment={setComment}
            newStart={newStart}
            setNewStart={setNewStart}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* ---------- Окно назначения урока ---------- */}
      <Modal open={!!assignSlot} onClose={() => setAssignSlot(null)}>
        {assignSlot && (
          <AssignLessonBody
            slot={assignSlot}
            students={students}
            onClose={() => setAssignSlot(null)}
            state={assignState}
            formAction={assignFormAction}
            pending={assignPending}
          />
        )}
      </Modal>

      {/* Сообщение о результате */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 lg:bottom-6">
          <div className="flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 shadow-xl ring-1 ring-line">
            <span className="tint-green flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <IconCheck className="h-4 w-4" />
            </span>
            <p className="flex-1 text-sm text-content">{toast}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 text-faint transition hover:text-content"
              aria-label={t.common.close}
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EditLessonBody({
  lesson,
  comment,
  setComment,
  newStart,
  setNewStart,
  onClose,
}: {
  lesson: LessonItem;
  comment: string;
  setComment: (v: string) => void;
  newStart: string;
  setNewStart: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const end = new Date(lesson.startTime.getTime() + lesson.duration * 60000);
  const isScheduled = lesson.status === "SCHEDULED";
  const isPast = lesson.startTime.getTime() < Date.now();

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconPencil className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-content">{t.schedule.editTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
          aria-label={t.common.close}
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <InfoRow
          icon={<IconUser className="h-5 w-5" />}
          label={t.common.student}
          value={lesson.studentName}
          hint={lesson.studentLevel ?? undefined}
        />
        <InfoRow
          icon={<IconLayers className="h-5 w-5" />}
          label={t.schedule.lessonsBalance}
          value={fmt(t.schedule.balanceLeft, { n: lesson.studentBalance })}
        />
        <InfoRow
          icon={<IconCalendar className="h-5 w-5" />}
          label={t.schedule.lessonTime}
          value={`${dShort.format(lesson.startTime)} · ${hm.format(lesson.startTime)}–${hm.format(end)}`}
          hint={t.lessonStatus[lesson.status as keyof typeof t.lessonStatus]}
        />
      </div>

      {lesson.cancelReason && (
        <div className="tint-amber mt-3 rounded-xl px-3.5 py-2.5 text-xs">
          {fmt(t.schedule.cancelReason, { reason: lesson.cancelReason })}
        </div>
      )}

      {/* Комментарий */}
      <div className="mt-4">
        <label className="text-sm font-medium text-content">{t.common.comment}</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          rows={3}
          placeholder={t.schedule.commentPlaceholder}
          className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
        <p className="mt-1 text-right text-[11px] text-faint">{comment.length}/500</p>
      </div>

      {isScheduled ? (
        <>
          {/* Перенос */}
          <div className="mt-2">
            <label className="text-sm font-medium text-content">
              {t.schedule.rescheduleTo}
            </label>
            <input
              type="datetime-local"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition focus:border-accent"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <form action={cancelLessonByTeacherAction} className="sm:flex-1">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="comment" value={comment} />
              <button
                type="submit"
                className="tint-rose flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition hover:brightness-95"
              >
                <IconX className="h-4 w-4" /> {t.schedule.cancelLesson}
              </button>
            </form>
            <form action={rescheduleLessonAction} className="sm:flex-1">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <input type="hidden" name="comment" value={comment} />
              <input type="hidden" name="newStartTime" value={newStart} />
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90"
              >
                <IconCalendar className="h-4 w-4" /> {t.schedule.reschedule}
              </button>
            </form>
          </div>
          {isPast && (
            <p className="mt-2 text-center text-[11px] text-faint">{t.schedule.pastHint}</p>
          )}
        </>
      ) : (
        <div className="mt-5">
          <form action={deleteLessonAction}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="comment" value={comment} />
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              <IconTrash className="h-4 w-4" /> {t.schedule.deleteLesson}
            </button>
          </form>
          {lesson.status === "COMPLETED" && (
            <p className="mt-2 text-center text-[11px] text-faint">
              {t.schedule.deleteHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AssignLessonBody({
  slot,
  students,
  onClose,
  state,
  formAction,
  pending,
}: {
  slot: Date;
  students: StudentItem[];
  onClose: () => void;
  state: AssignState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const { t } = useT();
  const end = new Date(slot.getTime() + 60 * 60000);

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconPlus className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-bold text-content">{t.schedule.assignTitle}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-content"
          aria-label={t.common.close}
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="startTime" value={toLocalInput(slot)} />

          <InfoRow
            icon={<IconCalendar className="h-5 w-5" />}
            label={t.schedule.selectedSlot}
            value={`${dShort.format(slot)} · ${hm.format(slot)}–${hm.format(end)}`}
          />

          <div>
            <label className="text-sm font-medium text-content">{t.common.student}</label>
            <select
              name="studentId"
              required
              defaultValue=""
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition focus:border-accent"
            >
              <option value="" disabled>
                {t.schedule.chooseStudent}
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmt(t.schedule.studentLeft, { name: s.name, n: s.balance })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-content">{t.schedule.topic}</label>
            <input
              name="topic"
              placeholder={t.schedule.topicPlaceholder}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-content">{t.common.comment}</label>
            <input
              name="comment"
              placeholder={t.schedule.commentOptional}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
            <input
              type="checkbox"
              name="recurring"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-content">
                {t.schedule.recurring}
              </span>
              <span className="block text-[11px] text-muted">
                {t.schedule.recurringHint}
              </span>
            </span>
          </label>

          {state.error && <p className="text-sm text-rose-500">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <IconCalendar className="h-4 w-4" />
            {pending ? t.schedule.assigning : t.schedule.assign}
          </button>
      </form>
    </div>
  );
}
