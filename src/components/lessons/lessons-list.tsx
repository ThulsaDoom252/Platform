"use client";

/**
 * Список заготовок уроков.
 *
 * На карточке видно, чем урок наполнен, — словник, видео, расшифровка,
 * вопросы, задания. Пустая секция названа пустой: собрать урок за один
 * присест всё равно не выходит, и по карточке должно быть понятно, куда
 * возвращаться.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  createLessonAction,
  deleteLessonAction,
  saveLessonAction,
  type LessonCard,
} from "@/lib/actions/lessons";
import {
  IconCheck,
  IconChevronRight,
  IconLayers,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent";

export function LessonsList({ items }: { items: LessonCard[] }) {
  const { t } = useT();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"ACTIVITY" | "REGULAR" | "SHORTS">("ACTIVITY");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const regular = items.filter((item) => item.kind === "REGULAR");
  const activities = items.filter((item) => item.kind === "ACTIVITY");
  const shorts = items.filter((item) => item.kind === "SHORTS");

  function create() {
    setError(null);
    startBusy(async () => {
      const result = await createLessonAction(title, kind);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTitle("");
      if (result.id) router.push(`/teacher/lessons/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm sm:p-5">
        <p className="text-sm font-bold text-content">{t.lessonUnits.newLesson}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && title.trim() && create()}
            placeholder={t.lessonUnits.namePlaceholder}
            className={`${inputCls} min-w-0 flex-1`}
          />

          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            {(
              [
                ["ACTIVITY", t.lessonUnits.kindActivity],
                ["REGULAR", t.lessonUnits.kindRegular],
                ["SHORTS", t.lessonUnits.kindShorts],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  "h-9 rounded-lg px-3 text-[13px] font-semibold transition",
                  kind === value
                    ? "bg-accent text-white"
                    : "text-muted hover:text-content",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={create}
            disabled={busy || !title.trim()}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <IconPlus className="h-4 w-4" />
            {t.lessonUnits.create}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      </section>

      <LessonGroup title={t.lessonUnits.regularLessons} empty={t.lessonUnits.noRegularLessons} items={regular} />
      <LessonGroup title={t.lessonUnits.activityLessons} empty={t.lessonUnits.noActivityLessons} items={activities} />
      <LessonGroup title={t.lessonUnits.shortsLessons} empty={t.lessonUnits.noShortsLessons} items={shorts} />
    </div>
  );
}

function LessonGroup({ title, empty, items }: { title: string; empty: string; items: LessonCard[] }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-base font-black text-content">{title}</h2>
      {items.length > 0
        ? items.map((item) => <Row key={item.id} item={item} />)
        : <p className="rounded-2xl bg-surface p-5 text-sm text-faint ring-1 ring-line">{empty}</p>}
    </section>
  );
}

function Row({ item }: { item: LessonCard }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [renameError, setRenameError] = useState<string | null>(null);

  function rename() {
    const next = draft.trim().slice(0, 160);
    if (!next) return;
    setRenameError(null);
    startBusy(async () => {
      const result = await saveLessonAction(item.id, { title: next });
      if (result.error) {
        setRenameError(result.error);
        return;
      }
      setDraft(next);
      setEditing(false);
      router.refresh();
    });
  }

  function cancelRename() {
    setDraft(item.title);
    setRenameError(null);
    setEditing(false);
  }

  /* Чем урок наполнен — одной строкой; пустое просто не упоминается. */
  const filled = [
    item.sections > 0 ? fmt(t.lessonUnits.sectionsCount, { n: item.sections }) : null,
    item.words > 0 ? fmt(t.lessonUnits.words, { n: item.words }) : null,
    item.hasLexis ? t.lessonUnits.secLexis : null,
    item.hasVideo ? t.lessonUnits.secVideo : null,
    item.lines > 0 ? fmt(t.lessonUnits.linesCount, { n: item.lines }) : null,
    item.questions > 0
      ? fmt(t.lessonUnits.questionsCount, { n: item.questions })
      : null,
    item.tasks > 0 ? fmt(t.lessonUnits.tasksCount, { n: item.tasks }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-start gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl tint-accent">
        <IconLayers className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <div className="flex min-w-0 max-w-xl flex-1 items-center gap-1.5">
              <input
                autoFocus
                value={draft}
                maxLength={160}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") rename();
                  if (event.key === "Escape") cancelRename();
                }}
                className="h-9 min-w-0 flex-1 rounded-xl border border-accent bg-surface-2 px-3 text-sm font-semibold text-content outline-none"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                title={t.lessonUnits.save}
                onClick={rename}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-50"
              >
                <IconCheck className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                title={t.common.cancel}
                onClick={cancelRename}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:border-accent hover:text-content disabled:opacity-50"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href={`/teacher/lessons/${item.id}`}
                className="font-semibold text-content transition hover:text-accent"
              >
                {item.title}
              </Link>
              <button
                type="button"
                title={t.lessonUnits.renameLesson}
                onClick={() => setEditing(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-accent"
              >
                <IconPencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-faint">
            {item.kind === "ACTIVITY"
              ? t.lessonUnits.kindActivity
              : item.kind === "SHORTS"
                ? t.lessonUnits.kindShorts
                : t.lessonUnits.kindRegular}
          </span>
        </div>

        {renameError && (
          <p className="mt-1 text-[12px] font-semibold text-rose-500">{renameError}</p>
        )}

        <p className="mt-0.5 text-[12px] text-muted">
          {item.vocabName ? `${item.vocabName} · ` : ""}
          {filled.length > 0 ? filled.join(" · ") : t.lessonUnits.empty}
        </p>

        <p className="mt-0.5 text-[11px] text-faint">
          {item.assigned > 0
            ? fmt(t.lessonUnits.assignedTo, { n: item.assigned })
            : t.lessonUnits.notGiven}
        </p>
      </div>

      <Link
        href={`/teacher/lessons/${item.id}`}
        className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-line px-3 text-[13px] font-semibold text-content transition hover:border-accent hover:text-accent"
      >
        {t.lessonUnits.open}
        <IconChevronRight className="h-4 w-4" />
      </Link>

      <button
        type="button"
        disabled={busy}
        title={t.lessonUnits.remove}
        onClick={() => {
          if (!confirm(t.lessonUnits.removeConfirm)) return;
          startBusy(async () => {
            await deleteLessonAction(item.id);
            router.refresh();
          });
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
      >
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );
}
