"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import {
  duplicatePinnedTwistersAction,
  listTwistersAction,
  pinnedTwistersAction,
  setPinnedTwistersAction,
  twisterStudentsAction,
  unpinTwisterAction,
  type Twister,
  type TwisterStudent,
} from "@/lib/actions/tongue-twisters";
import { TwisterViewer } from "@/components/twisters/twister-viewer";
import { IconCheck, IconPlus, IconUser, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ClassTwister({
  studentId,
}: {
  studentId: string;
  studentName: string;
}) {
  const { t } = useT();
  const [pinned, setPinned] = useState<Twister[]>([]);
  const [pool, setPool] = useState<Twister[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusAt, setFocusAt] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [students, setStudents] = useState<TwisterStudent[]>([]);
  const [copyTarget, setCopyTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const reload = useCallback(async () => {
    const current = await pinnedTwistersAction(studentId);
    setPinned(current);
    setLoaded(true);
  }, [studentId]);

  useEffect(() => {
    let alive = true;
    Promise.all([pinnedTwistersAction(studentId), listTwistersAction()])
      .then(([current, all]) => {
        if (!alive) return;
        setPinned(current);
        setPool(all);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const openPicker = () => {
    setSelected(new Set(pinned.map((item) => item.id)));
    setAdding(true);
    setError(null);
  };

  const openCopy = () => {
    setCopying(true);
    setCopyTarget("");
    setError(null);
    if (students.length === 0) {
      void twisterStudentsAction().then((rows) => setStudents(rows.filter((row) => row.id !== studentId)));
    }
  };

  return (
    <div className="flex min-h-[320px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-bold text-white transition hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> {t.twisters.addToLesson}
        </button>

        {pinned.length > 0 && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => startBusy(async () => {
                await unpinTwisterAction(studentId);
                await reload();
              })}
              className="h-9 rounded-xl px-3 text-xs font-bold text-muted transition hover:bg-surface-2 hover:text-rose-500 disabled:opacity-50"
            >
              {t.classRoom.clearSection}
            </button>
            <button
              type="button"
              onClick={openCopy}
              className="ml-auto flex h-9 items-center gap-1.5 rounded-xl bg-surface-2 px-3 text-xs font-bold text-content ring-1 ring-line transition hover:ring-accent"
            >
              <IconUser className="h-4 w-4" /> {t.classRoom.duplicateForStudent}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}

      {loaded && pinned.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-2xl bg-surface-2 p-8 text-center">
          <div>
            <p className="text-sm font-bold text-content">{t.twisters.noPinned}</p>
            <p className="mt-1 text-xs text-faint">{t.twisters.addButtonHint}</p>
          </div>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pinned.map((item) => (
            <div key={item.id} className="group relative min-h-[190px] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
              <button type="button" onClick={() => setFocusAt(item.id)} className="relative block h-full w-full cursor-pointer">
                <Image
                  src={item.imageUrl}
                  alt={item.title ?? t.twisters.untitled}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-contain p-2 transition group-hover:scale-[1.01]"
                />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startBusy(async () => {
                  await unpinTwisterAction(studentId, item.id);
                  await reload();
                })}
                title={t.twisters.unpin}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setAdding(false)}>
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-line">
            <div className="flex items-center gap-3 border-b border-line p-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-content">{t.twisters.chooseForLesson}</h3>
                <p className="text-xs text-faint">{t.twisters.chooseManyHint}</p>
              </div>
              <button type="button" onClick={() => setAdding(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pool.map((item) => {
                const on = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected((value) => {
                      const next = new Set(value);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })}
                    className={cn(
                      "relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 ring-2 transition",
                      on ? "ring-accent" : "ring-transparent hover:ring-line",
                    )}
                  >
                    <Image src={item.imageUrl} alt={item.title ?? t.twisters.untitled} fill sizes="220px" className="object-contain p-2" />
                    {on && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white"><IconCheck className="h-4 w-4" /></span>}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-left text-[11px] font-semibold text-white">
                      {item.title || t.twisters.untitled}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line p-4">
              <span className="text-xs font-bold text-muted">{selected.size} {t.twisters.selected}</span>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => startBusy(async () => {
                  const result = await setPinnedTwistersAction(studentId, [...selected]);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setAdding(false);
                  await reload();
                })}
                className="h-10 rounded-xl bg-accent px-5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {t.twisters.saveSelection}
              </button>
            </div>
          </div>
        </div>
      )}

      {copying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onMouseDown={(event) => event.target === event.currentTarget && setCopying(false)}>
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-line">
            <div className="flex items-center gap-3">
              <h3 className="flex-1 font-black text-content">{t.classRoom.duplicateTitle}</h3>
              <button type="button" onClick={() => setCopying(false)}><IconX className="h-4 w-4 text-muted" /></button>
            </div>
            <select value={copyTarget} onChange={(event) => setCopyTarget(event.target.value)} className="mt-4 h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-content ring-1 ring-line outline-none focus:ring-accent">
              <option value="">{t.classRoom.chooseStudent}</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <button
              type="button"
              disabled={!copyTarget || busy}
              onClick={() => startBusy(async () => {
                const result = await duplicatePinnedTwistersAction(studentId, copyTarget);
                if (result.error) return setError(result.error);
                setCopying(false);
              })}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-black text-white disabled:opacity-40"
            >
              {t.classRoom.duplicate}
            </button>
          </div>
        </div>
      )}

      {focusAt && (
        <TwisterViewer
          items={pinned}
          startId={focusAt}
          teacher
          realtimeChannel={`class:${studentId}`}
          onClose={() => setFocusAt(null)}
        />
      )}
    </div>
  );
}
