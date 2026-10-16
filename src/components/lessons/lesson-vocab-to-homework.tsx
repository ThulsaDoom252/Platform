"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { IconLayers } from "@/components/icons";
import { useT } from "@/components/i18n-provider";
import { DEFAULT_SHOW } from "@/lib/revision-modes";
import { listWordDeckStudentsAction, type WordDeckStudent } from "@/lib/actions/word-deck";
import { assignLessonVocabularyRevisionAction, lessonVocabularyRevisionSourceAction } from "@/lib/actions/lesson-vocabulary-revision";

const RevisionSetup = dynamic(() => import("@/components/revision/revision-setup").then(module => module.RevisionSetup));
type Source = NonNullable<Awaited<ReturnType<typeof lessonVocabularyRevisionSourceAction>>["source"]>;
const messages = {
  en: { add: "Assign vocabulary game to homework", choose: "Who is this word practice for?", student: "Student", placeholder: "Choose a student", next: "Choose words and modes", failed: "Could not load or assign the game. Please try again.", saved: "Added successfully to {name}'s homework.", empty: "No students available." },
  ru: { add: "Назначить игру со словами в домашку", choose: "Кому назначить повторение слов?", student: "Ученик", placeholder: "Выбери ученика", next: "Выбрать слова и режимы", failed: "Не удалось загрузить или назначить игру. Попробуй ещё раз.", saved: "Игра добавлена в домашку: {name}.", empty: "Нет доступных учеников." },
  uk: { add: "Призначити гру зі словами в домашнє завдання", choose: "Кому призначити повторення слів?", student: "Учень", placeholder: "Вибери учня", next: "Вибрати слова й режими", failed: "Не вдалося завантажити або призначити гру. Спробуй ще раз.", saved: "Гру додано в домашнє завдання: {name}.", empty: "Немає доступних учнів." },
};

export function LessonVocabToHomework({ unitId, lessonTitle, defaultStudentId, assignmentId }: {
  unitId: string; lessonTitle: string; defaultStudentId?: string | null; assignmentId?: string;
}) {
  const { t, locale } = useT();
  const copy = messages[locale];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<WordDeckStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const generation = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { generation.current++; setOpen(false); setSource(null); trigger.current?.focus(); };
  const load = async (id: string, token: number) => {
    try {
      const result = await lessonVocabularyRevisionSourceAction({ unitId, studentId: id,
        assignmentId: id === defaultStudentId ? assignmentId : undefined });
      if (generation.current !== token) return;
      if (!result.source) { setError(result.error ?? copy.failed); return; }
      setSource(result.source);
    } catch { if (generation.current === token) setError(copy.failed); }
  };
  const show = () => {
    const token = ++generation.current;
    setOpen(true); setSource(null); setStudents([]); setStudentId(defaultStudentId ?? "");
    setError(null); setNotice(null); setRequestId(crypto.randomUUID());
    startBusy(async () => {
      try {
        const next = await listWordDeckStudentsAction();
        if (generation.current !== token) return;
        setStudents(next);
        if (defaultStudentId && next.some(student => student.id === defaultStudentId)) await load(defaultStudentId, token);
        else setStudentId("");
      } catch { if (generation.current === token) setError(copy.failed); }
    });
  };
  const initial = useMemo(() => source ? ({ title: `${source.name} · ${t.revision.title}`, phraseIds: source.words.map(word => word.phraseId),
    modes: source.words.filter(word => word.translation?.trim()).length >= 3 ? ["flashcards", "choose"] : ["flashcards", "unscramble"],
    modeWords: {}, show: { ...DEFAULT_SHOW }, answerSeconds: null, totalSeconds: null }) : undefined, [source, t.revision.title]);
  const groups = useMemo(() => source ? [{ nodeId: source.id, words: source.words }] : undefined, [source]);

  return <>
    <button ref={trigger} type="button" onClick={show} disabled={busy} title={copy.add} aria-label={copy.add}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 transition hover:bg-emerald-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:text-emerald-300">
      <IconLayers className="h-4 w-4" aria-hidden="true" />
    </button>
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-[220] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-surface px-4 py-3 text-sm font-semibold text-content shadow-xl ring-1 ring-emerald-500/40">
      {notice}<button type="button" onClick={() => setNotice(null)} className="ml-3 text-muted" aria-label={t.common.close}>×</button>
    </div>}
    {open && source && groups && <RevisionSetup key={`${source.studentId}:${source.version}`} studentId={source.studentId} studentName={source.studentName}
      nodeId={source.id} nodeName={lessonTitle} wordGroupsOverride={groups} initial={initial} onClose={close}
      onAssign={async settings => {
        try { return await assignLessonVocabularyRevisionAction({ unitId, studentId: source.studentId,
          assignmentId: source.assignmentId, requestId, sourceVersion: source.version, settings }); }
        catch { return { error: copy.failed }; }
      }}
      onDone={() => { setNotice(copy.saved.replace("{name}", source.studentName)); router.refresh(); }} />}
    {open && !source && <Modal open onClose={close} title={copy.choose}>
      <div className="flex flex-col gap-4">
        <label className="grid gap-2 text-sm font-bold text-content">{copy.student}
          <select value={studentId} disabled={busy} onChange={event => { setStudentId(event.target.value); setError(null); }}
            className="h-11 min-w-0 rounded-xl border border-line bg-surface-2 px-3 text-sm text-content">
            <option value="">{copy.placeholder}</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
          </select>
        </label>
        {busy && <p role="status" className="text-sm text-muted">{t.common.loading}</p>}
        {!busy && !students.length && !error && <p className="text-sm text-muted">{copy.empty}</p>}
        {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
        <button type="button" disabled={busy || !studentId || !students.some(student => student.id === studentId)} onClick={() => {
          setError(null); const token = generation.current; startBusy(() => load(studentId, token));
        }} className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-50">{copy.next}</button>
      </div>
    </Modal>}
  </>;
}
