"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, RotateCcw, Send } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { createClassLessonNoteAction } from "@/lib/actions/class-tools";
import { canRestoreClassNoteFocus, createClassNoteQueue, type ClassNoteKind, type ClassNoteSubmission } from "@/lib/class-note-entry";

const copy = {
  en: { type: "Entry type", expand: "Expand notes history", collapse: "Collapse notes history", failed: "Not saved. Your text is kept below.", retry: "Retry saving", saved: "Saved", saving: "Saving", note: "Note" },
  ru: { type: "Тип записи", expand: "Развернуть историю записей", collapse: "Свернуть историю записей", failed: "Не сохранено. Текст сохранён ниже — можно повторить отправку.", retry: "Повторить сохранение", saved: "Сохранено", saving: "Сохранение", note: "Note" },
  uk: { type: "Тип запису", expand: "Розгорнути історію записів", collapse: "Згорнути історію записів", failed: "Не збережено. Текст залишився нижче — можна повторити надсилання.", retry: "Повторити збереження", saved: "Збережено", saving: "Збереження", note: "Note" },
};

export function ClassNoteQuickEntry({ studentId, enabled, kind, onKindChange, expanded, onToggleHistory, onSaved }: {
  studentId: string; enabled: boolean; kind: ClassNoteKind; onKindChange: (kind: ClassNoteKind) => void;
  expanded: boolean; onToggleHistory: () => void; onSaved: () => void;
}) {
  const { t, locale } = useT();
  const labels = copy[locale];
  const input = useRef<HTMLInputElement>(null);
  const draftRef = useRef("");
  const savedCallback = useRef(onSaved);
  const keyboardNavigation = useRef(false);
  const mounted = useRef(true);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(0);
  const [saved, setSaved] = useState(false);
  const [failures, setFailures] = useState<(ClassNoteSubmission & { error?: string })[]>([]);
  const queue = useRef<ReturnType<typeof createClassNoteQueue> | null>(null);
  useEffect(() => { queue.current = createClassNoteQueue(
    entry => createClassLessonNoteAction(entry.text, entry.kind, studentId, entry.id),
    (entry, state, error) => {
      if (!mounted.current) return;
      if (state === "pending") {
        setPending(count => count + 1); setSaved(false);
        setFailures(items => items.filter(item => item.id !== entry.id));
      } else {
        setPending(count => Math.max(0, count - 1));
        if (state === "saved") { setSaved(true); savedCallback.current(); }
        else setFailures(items => [...items.filter(item => item.id !== entry.id), { ...entry, error }]);
      }
    },
  ); return () => { queue.current = null; }; }, [studentId]);
  useEffect(() => { savedCallback.current = onSaved; }, [onSaved]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    let recoveryFrame: number | null = null;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Tab") keyboardNavigation.current = true; };
    const onPointer = () => { keyboardNavigation.current = false; };
    const returnToEntry = () => {
      if (recoveryFrame !== null) return;
      recoveryFrame = requestAnimationFrame(() => {
        recoveryFrame = null;
        if (!keyboardNavigation.current && input.current && canRestoreClassNoteFocus(document, input.current)) input.current.focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(returnToEntry);
    observer.observe(document.querySelector("[data-class-room]") ?? document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("pointerup", returnToEntry);
    document.addEventListener("focusout", returnToEntry);
    window.addEventListener("focus", returnToEntry);
    return () => { cancelAnimationFrame(frame); if (recoveryFrame !== null) cancelAnimationFrame(recoveryFrame); observer.disconnect(); document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onPointer, true); document.removeEventListener("pointerup", returnToEntry); document.removeEventListener("focusout", returnToEntry); window.removeEventListener("focus", returnToEntry); };
  }, [enabled]);

  const restoreFocus = () => {
    requestAnimationFrame(() => {
      if (enabled && !keyboardNavigation.current && input.current && canRestoreClassNoteFocus(document, input.current)) input.current.focus({ preventScroll: true });
    });
  };
  const submit = () => {
    const text = draftRef.current.trim();
    if (!text || !queue.current) return;
    draftRef.current = ""; setDraft("");
    void queue.current.enqueue({ id: crypto.randomUUID(), text, kind });
    input.current?.focus({ preventScroll: true });
  };
  if (!enabled) return null;
  return <div className="relative min-w-0 basis-full sm:basis-auto" data-class-note-quick-entry>
    <div className="flex h-10 w-full min-w-0 items-center gap-1 rounded-xl bg-surface-2 px-1 ring-1 ring-accent/35 focus-within:ring-2 focus-within:ring-accent sm:w-[360px]">
      <select aria-label={labels.type} value={kind} onChange={event => { onKindChange(event.target.value as ClassNoteKind); input.current?.focus({ preventScroll: true }); }}
        className="h-8 w-[79px] shrink-0 rounded-lg border-0 bg-surface px-1.5 text-[11px] font-black text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <option value="NOTE">{labels.note}</option><option value="SPELLING">Spelling</option>
      </select>
      <input ref={input} aria-label={kind === "SPELLING" ? t.classRoom.spellingPlaceholder : t.classRoom.notesPlaceholder} value={draft} maxLength={4000}
        onChange={event => { draftRef.current = event.target.value; setDraft(event.target.value); }}
        onBlur={restoreFocus} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); submit(); }
        }} placeholder={kind === "SPELLING" ? t.classRoom.spellingPlaceholder : t.classRoom.notesPlaceholder}
        className="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-sm font-semibold text-content outline-none placeholder:text-faint" />
      <span role="status" className="flex shrink-0 items-center text-accent" aria-label={pending ? `${labels.saving}: ${pending}` : saved ? labels.saved : undefined}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <button type="button" disabled={!draft.trim()} onClick={submit} title={kind === "SPELLING" ? t.classRoom.spellingCreate : t.classRoom.notesAdd}
        aria-label={kind === "SPELLING" ? t.classRoom.spellingCreate : t.classRoom.notesAdd} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-30"><Send className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => { onToggleHistory(); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); }} aria-expanded={expanded} aria-controls="class-notes-history" title={expanded ? labels.collapse : labels.expand}
        aria-label={expanded ? labels.collapse : labels.expand} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent transition hover:bg-accent-soft">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
    </div>
    {failures.length > 0 && <div role="alert" className="absolute bottom-full left-0 z-[90] mb-2 max-h-48 w-full overflow-y-auto rounded-xl border border-rose-400/40 bg-surface p-3 text-xs shadow-lg">
      <p className="font-bold text-rose-600 dark:text-rose-300">{labels.failed}</p>
      {failures.map(entry => <div key={entry.id} className="mt-2 flex items-center gap-2"><span className="min-w-0 flex-1 break-words text-content">{entry.kind === "SPELLING" ? "Spelling" : labels.note}: {entry.text}</span>
        <button type="button" onClick={() => { void queue.current?.enqueue(entry); input.current?.focus({ preventScroll: true }); }} title={labels.retry} aria-label={labels.retry} className="shrink-0 rounded-lg bg-accent-soft p-2 text-accent"><RotateCcw className="h-4 w-4" /></button></div>)}
    </div>}
  </div>;
}
