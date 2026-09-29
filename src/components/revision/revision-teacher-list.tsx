"use client";

/**
 * Выданные повторения слов — у учителя.
 *
 * Здесь видно не «сдал или нет», а разбор: где сыпется, сколько на это
 * ушло, что далось легко. По одному проценту урок не построишь.
 *
 * Сданное задание закрыто — иначе ученик прогоняет его до нужной
 * цифры. Открыть заново может только учитель, и тогда попытки копятся
 * рядом: по ним и видно, меняется ли что-нибудь.
 */
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import {
  attemptsAction,
  deleteRevisionAction,
  listRevisionsAction,
  reopenRevisionAction,
  type AttemptSummary,
  type RevisionCard,
} from "@/lib/actions/revision";
import type { RevisionMode } from "@/lib/revision-modes";
import { IconChevronDown, IconTrash } from "@/components/icons";
import { cn } from "@/lib/utils";

export function RevisionTeacherList({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [items, setItems] = useState<RevisionCard[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    let alive = true;
    listRevisionsAction(studentId)
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const reload = async () => setItems(await listRevisionsAction(studentId));

  if (items === null) {
    return <p className="text-sm text-faint">{t.common.loading}</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-faint">{t.revision.noneYet}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl bg-surface-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-content">
              {item.title}
            </span>

            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                item.attempts > 0 ? "tint-green" : "tint-amber",
              )}
            >
              {item.attempts > 0
                ? fmt(t.revision.attemptsDone, { n: item.attempts })
                : t.revision.notDone}
            </span>

            {item.attempts > 0 && (
              <button
                type="button"
                onClick={() => setOpen(open === item.id ? null : item.id)}
                className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[11px] font-semibold text-accent transition hover:bg-surface"
              >
                {t.revision.results}
                <IconChevronDown
                  className={cn("h-3.5 w-3.5 transition", open === item.id && "rotate-180")}
                />
              </button>
            )}

            {!item.open && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  startBusy(async () => {
                    await reopenRevisionAction(item.id, true);
                    await reload();
                  })
                }
                className="h-7 shrink-0 rounded-lg border border-line px-2 text-[11px] font-semibold text-content transition hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {t.revision.reopen}
              </button>
            )}

            <button
              type="button"
              disabled={busy}
              title={t.revision.remove}
              onClick={() => {
                if (!confirm(t.revision.removeConfirm)) return;
                startBusy(async () => {
                  await deleteRevisionAction(item.id);
                  await reload();
                });
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-surface hover:text-rose-500 disabled:opacity-50"
            >
              <IconTrash className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="mt-0.5 text-[11px] text-faint">
            {fmt(t.revision.selected, { n: item.words })}
            {item.nodeName && ` · ${t.revision.fromVocab}: ${item.nodeName}`}
          </p>

          {open === item.id && <Attempts revisionId={item.id} />}
        </div>
      ))}
    </div>
  );
}

/** Разбор попыток: подряд, чтобы видеть, меняется ли что-нибудь. */
function Attempts({ revisionId }: { revisionId: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<AttemptSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    attemptsAction(revisionId)
      .then((list) => alive && setRows(list))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [revisionId]);

  const MODE_LABEL: Record<RevisionMode, string> = {
    flashcards: t.revision.modeFlashcards,
    choose: t.revision.modeChoose,
    pairs: t.revision.modePairs,
    unscramble: t.revision.modeUnscramble,
    picture: t.revision.modePicture,
    definition: t.revision.modeDefinition,
    definitionPairs: t.revision.modeDefinitionPairs,
  };

  if (rows === null) return <p className="mt-2 text-[12px] text-faint">{t.common.loading}</p>;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
      {rows.map((row, i) => {
        const r = row.result;

        return (
          <div key={row.id} className="rounded-lg bg-surface p-2.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[12px] font-bold text-content">
                {fmt(t.revision.attemptNo, { n: i + 1 })}
              </span>
              {row.finishedAt ? (
                <>
                  <span className="text-[12px] font-bold text-accent">{r.accuracy}%</span>
                  <span className="text-[11px] text-faint">
                    {r.right}/{r.total} · {clock(r.totalMs)}
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-semibold text-amber-500">
                  {t.revision.inProgress}
                </span>
              )}
            </div>

            {/* По секциям: где именно сыпется. */}
            <div className="mt-1.5 flex flex-col gap-1">
              {r.sections.map((s) => (
                <div key={s.mode} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                    {MODE_LABEL[s.mode]}
                  </span>
                  <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        s.accuracy >= 80
                          ? "bg-emerald-500"
                          : s.accuracy >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500",
                      )}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-content">
                    {s.right}/{s.total}
                  </span>
                  <span className="w-12 shrink-0 text-right text-[11px] text-faint">
                    {clock(s.ms)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-faint">
              {r.fastestWord && (
                <span>
                  {t.revision.fastest}:{" "}
                  <b className="text-content">{r.fastestWord}</b> ({secs(r.fastestMs)})
                </span>
              )}
              {r.slowestWord && (
                <span>
                  {t.revision.slowest}:{" "}
                  <b className="text-content">{r.slowestWord}</b> ({secs(r.slowestMs)})
                </span>
              )}
              {r.best && (
                <span>
                  {t.revision.bestSection}:{" "}
                  <b className="text-content">{MODE_LABEL[r.best]}</b>
                </span>
              )}
              {r.worst && (
                <span>
                  {t.revision.worstSection}:{" "}
                  <b className="text-content">{MODE_LABEL[r.worst]}</b>
                </span>
              )}
              {r.timeouts > 0 && (
                <span className="text-rose-500">
                  {t.revision.timeUp}: {r.timeouts}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function clock(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function secs(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`;
}
