"use client";

import { useMemo, useState, useTransition } from "react";
import {
  saveAssignedLessonContentAction,
  type AssignedLessonContentDraft,
  type LessonEditScope,
  type LessonView,
} from "@/lib/actions/lessons";
import type { LessonWord } from "@/lib/lesson-unit";
import type { RegularLessonSection, RegularLessonTone } from "@/lib/regular-lesson";
import { IconCheck, IconPlus, IconTrash, IconX } from "@/components/icons";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

type ActivityTab =
  | "main"
  | "vocabulary"
  | "lexis"
  | "video"
  | "transcript"
  | "questions"
  | "homework"
  | "games";

const tones: RegularLessonTone[] = [
  "warm",
  "vocab",
  "exercise",
  "grammar",
  "reading",
  "dialogue",
  "teacher",
];

const text = {
  en: {
    title: "Edit lesson in class",
    current: "Only this student",
    currentHint: "The reusable lesson and other students stay unchanged.",
    global: "Everywhere",
    globalHint: "Update the main template and every assigned copy.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Saved",
    close: "Close",
    lessonTitle: "Lesson title",
    description: "Description",
    add: "Add",
    remove: "Remove",
    section: "Section",
    studentContent: "Student content (HTML)",
    teacherContent: "Teacher content / answers (HTML)",
    defaultOpen: "Open by default",
    teacherOnly: "Teacher only",
    voicePrompts: "Voice prompts, one per line",
    main: "Main",
    vocabulary: "Vocabulary",
    lexis: "Lexis",
    video: "Video",
    transcript: "Transcript",
    questions: "Questions",
    homework: "Homework",
    games: "Games",
    noGames: "No games attached.",
    exerciseHint: "Interactive exercises are edited with the pencil on each exercise. The same save scope is available there.",
  },
  ru: {
    title: "Редактировать урок в классе",
    current: "Только этому ученику",
    currentHint: "Основной урок и версии других учеников не изменятся.",
    global: "Сохранить везде",
    globalHint: "Обновить основной шаблон и все выданные экземпляры.",
    save: "Сохранить изменения",
    saving: "Сохраняю…",
    saved: "Сохранено",
    close: "Закрыть",
    lessonTitle: "Название урока",
    description: "Описание",
    add: "Добавить",
    remove: "Удалить",
    section: "Секция",
    studentContent: "Содержимое ученика (HTML)",
    teacherContent: "Содержимое учителя / ответы (HTML)",
    defaultOpen: "Открыта по умолчанию",
    teacherOnly: "Только для учителя",
    voicePrompts: "Голосовые вопросы — по одному в строке",
    main: "Основное",
    vocabulary: "Словарь",
    lexis: "Лексика",
    video: "Видео",
    transcript: "Транскрипт",
    questions: "Вопросы",
    homework: "Домашка",
    games: "Игры",
    noGames: "К уроку не прикреплены игры.",
    exerciseHint: "Интерактивные упражнения редактируются карандашом на самом упражнении. Там доступен такой же выбор области сохранения.",
  },
  uk: {
    title: "Редагувати урок у класі",
    current: "Лише цьому учневі",
    currentHint: "Основний урок і версії інших учнів не зміняться.",
    global: "Зберегти всюди",
    globalHint: "Оновити основний шаблон і всі видані примірники.",
    save: "Зберегти зміни",
    saving: "Зберігаю…",
    saved: "Збережено",
    close: "Закрити",
    lessonTitle: "Назва уроку",
    description: "Опис",
    add: "Додати",
    remove: "Видалити",
    section: "Секція",
    studentContent: "Вміст учня (HTML)",
    teacherContent: "Вміст учителя / відповіді (HTML)",
    defaultOpen: "Відкрита за замовчуванням",
    teacherOnly: "Лише для вчителя",
    voicePrompts: "Голосові запитання — по одному в рядку",
    main: "Основне",
    vocabulary: "Словник",
    lexis: "Лексика",
    video: "Відео",
    transcript: "Транскрипт",
    questions: "Запитання",
    homework: "Домашнє",
    games: "Ігри",
    noGames: "До уроку не прикріплено ігор.",
    exerciseHint: "Інтерактивні вправи редагуються олівцем на самій вправі. Там доступний такий самий вибір області збереження.",
  },
} as const;

const draftOf = (lesson: LessonView): AssignedLessonContentDraft => ({
  title: lesson.title,
  description: lesson.description,
  words: lesson.words.map((word) => ({ ...word, examples: word.examples.map((row) => ({ ...row })) })),
  lexis: lesson.lexis.map((group) => ({ ...group, blocks: [...group.blocks], warnings: [...group.warnings] })),
  videoUrl: lesson.videoUrl,
  videoTitle: lesson.videoTitle,
  transcript: lesson.transcript.map((line) => ({ ...line })),
  questions: {
    afterVideo: [...lesson.questions.afterVideo],
    afterReading: [...lesson.questions.afterReading],
  },
  homework: lesson.homework.map((task) => ({ ...task })),
  interactiveHomework: lesson.interactiveHomework,
  activityIds: lesson.activities.map((activity) => activity.id),
  regularSections: lesson.regularSections.map((section) => ({
    ...section,
    ...(section.voiceExercise
      ? { voiceExercise: { ...section.voiceExercise, prompts: [...section.voiceExercise.prompts] } }
      : {}),
  })),
});

const field =
  "rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-content outline-none transition focus:border-accent";

export function LiveLessonEditor({
  assignmentId,
  studentName,
  lesson,
  onClose,
  onSaved,
}: {
  assignmentId: string;
  studentName: string;
  lesson: LessonView;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const { locale } = useT();
  const l = text[locale] ?? text.en;
  const [draft, setDraft] = useState(() => draftOf(lesson));
  const [scope, setScope] = useState<LessonEditScope>("STUDENT");
  const [tab, setTab] = useState<ActivityTab>("main");
  const [regularAt, setRegularAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, startSaving] = useTransition();

  const activeRegular = draft.regularSections[regularAt] ?? null;
  const tabs = useMemo(() => ([
    ["main", l.main],
    ["vocabulary", l.vocabulary],
    ["lexis", l.lexis],
    ["video", l.video],
    ["transcript", l.transcript],
    ["questions", l.questions],
    ["homework", l.homework],
    ["games", l.games],
  ] as const), [l]);

  const save = () => {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const result = await saveAssignedLessonContentAction(assignmentId, draft, scope);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      await onSaved?.();
      window.setTimeout(onClose, 350);
    });
  };

  const patchWord = (at: number, patch: Partial<LessonWord>) => {
    setDraft((current) => ({
      ...current,
      words: current.words.map((word, index) => index === at ? { ...word, ...patch } : word),
    }));
  };

  const patchRegular = (patch: Partial<RegularLessonSection>) => {
    setDraft((current) => ({
      ...current,
      regularSections: current.regularSections.map((section, index) =>
        index === regularAt ? { ...section, ...patch } : section),
    }));
  };

  return (
    <div className="fixed inset-0 z-[120] flex bg-slate-950/55 p-0 backdrop-blur-sm sm:p-4">
      <section className="m-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-[94vh] sm:rounded-[28px] sm:ring-1 sm:ring-line">
        <header className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">{studentName}</p>
            <h2 className="truncate text-xl font-black text-content">{l.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted hover:text-content" aria-label={l.close}>
            <IconX className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {lesson.kind === "REGULAR" ? (
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="space-y-2">
                {draft.regularSections.map((section, index) => (
                  <button key={section.id} type="button" onClick={() => setRegularAt(index)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition", index === regularAt ? "bg-accent text-white" : "bg-surface-2 text-content hover:bg-accent-soft")}>
                    {section.title}
                  </button>
                ))}
                <button type="button" onClick={() => {
                  const id = `section-${Date.now()}`;
                  setDraft((current) => ({ ...current, regularSections: [...current.regularSections, { id, title: "New section", tone: "exercise", studentHtml: "<p>New content</p>", teacherHtml: "<p>New content</p>", defaultOpen: false }] }));
                  setRegularAt(draft.regularSections.length);
                }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/40 px-3 py-2 text-sm font-black text-accent">
                  <IconPlus className="h-4 w-4" /> {l.add}
                </button>
              </aside>
              {activeRegular ? (
                <div className="space-y-4 rounded-2xl border border-line p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <label className="grid gap-1 text-xs font-bold text-muted">{l.section}
                      <input className={field} value={activeRegular.title} onChange={(event) => patchRegular({ title: event.target.value })} />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-muted">Tone
                      <select className={field} value={activeRegular.tone} onChange={(event) => patchRegular({ tone: event.target.value as RegularLessonTone })}>
                        {tones.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-content"><input type="checkbox" checked={activeRegular.defaultOpen} onChange={(event) => patchRegular({ defaultOpen: event.target.checked })} /> {l.defaultOpen}</label>
                    <label className="flex items-center gap-2 text-sm font-bold text-content"><input type="checkbox" checked={Boolean(activeRegular.teacherOnly)} onChange={(event) => patchRegular({ teacherOnly: event.target.checked || undefined })} /> {l.teacherOnly}</label>
                  </div>
                  <label className="grid gap-1 text-xs font-bold text-muted">{l.studentContent}
                    <textarea rows={10} className={field} value={activeRegular.studentHtml} onChange={(event) => patchRegular({ studentHtml: event.target.value })} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-muted">{l.teacherContent}
                    <textarea rows={10} className={field} value={activeRegular.teacherHtml} onChange={(event) => patchRegular({ teacherHtml: event.target.value })} />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-muted">{l.voicePrompts}
                    <textarea rows={4} className={field} value={activeRegular.voiceExercise?.prompts.join("\n") ?? ""} onChange={(event) => {
                      const prompts = event.target.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
                      patchRegular(prompts.length ? { voiceExercise: { instruction: activeRegular.voiceExercise?.instruction ?? "", maxSeconds: activeRegular.voiceExercise?.maxSeconds ?? 600, prompts } } : { voiceExercise: undefined });
                    }} />
                  </label>
                  <button type="button" onClick={() => {
                    setDraft((current) => ({ ...current, regularSections: current.regularSections.filter((_, index) => index !== regularAt) }));
                    setRegularAt((value) => Math.max(0, value - 1));
                  }} className="flex h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-black text-rose-600">
                    <IconTrash className="h-4 w-4" /> {l.remove}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
                {tabs.map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setTab(id)} className={cn("shrink-0 rounded-xl px-3 py-2 text-xs font-black transition", tab === id ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-content")}>{label}</button>
                ))}
              </nav>

              {tab === "main" && <div className="grid gap-4">
                <label className="grid gap-1 text-xs font-bold text-muted">{l.lessonTitle}<input className={field} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="grid gap-1 text-xs font-bold text-muted">{l.description}<textarea rows={5} className={field} value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value || null }))} /></label>
              </div>}

              {tab === "vocabulary" && <div className="space-y-3">
                {draft.words.map((word, index) => (
                  <div key={`${word.id}-${index}`} className="rounded-2xl border border-line bg-surface-2 p-3">
                    <div className="grid gap-2 sm:grid-cols-[64px_1fr_1fr_1fr]">
                      <input className={field} value={word.icon ?? ""} placeholder="🔊" onChange={(event) => patchWord(index, { icon: event.target.value || null })} />
                      <input className={field} value={word.word} placeholder="English" onChange={(event) => patchWord(index, { word: event.target.value })} />
                      <input className={field} value={word.translation ?? ""} placeholder="Translation" onChange={(event) => patchWord(index, { translation: event.target.value || null })} />
                      <input className={field} value={word.category} placeholder="Category" onChange={(event) => patchWord(index, { category: event.target.value })} />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <textarea rows={2} className={field} value={word.description ?? ""} placeholder="Description" onChange={(event) => patchWord(index, { description: event.target.value || null })} />
                      <textarea rows={2} className={field} value={word.note ?? ""} placeholder="Tip" onChange={(event) => patchWord(index, { note: event.target.value || null })} />
                    </div>
                    <textarea rows={2} className={cn(field, "mt-2 w-full")} value={word.examples.map((row) => `${row.en} | ${row.tr}`).join("\n")} placeholder="Example | Translation" onChange={(event) => patchWord(index, { examples: event.target.value.split(/\r?\n/).flatMap((line) => { const [en = "", ...rest] = line.split("|"); const tr = rest.join("|").trim(); return en.trim() || tr ? [{ en: en.trim(), tr }] : []; }) })} />
                    <button type="button" onClick={() => setDraft((current) => ({ ...current, words: current.words.filter((_, at) => at !== index) }))} className="mt-2 flex items-center gap-1 text-xs font-black text-rose-600"><IconTrash className="h-3.5 w-3.5" /> {l.remove}</button>
                  </div>
                ))}
                <button type="button" onClick={() => setDraft((current) => ({ ...current, words: [...current.words, { id: `local-word-${Date.now()}`, category: "", icon: null, word: "", ipaUs: null, ipaUk: null, translation: null, description: null, note: null, examples: [], sectionColor: null, imageUrl: null }] }))} className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-accent/40 px-4 text-sm font-black text-accent"><IconPlus className="h-4 w-4" /> {l.add}</button>
              </div>}

              {tab === "lexis" && <div className="space-y-3">
                {draft.lexis.map((group, index) => <div key={group.id} className="rounded-2xl border border-line p-4">
                  <div className="grid gap-2 sm:grid-cols-2"><input className={field} value={group.title} placeholder="Title" onChange={(event) => setDraft((current) => ({ ...current, lexis: current.lexis.map((entry, at) => at === index ? { ...entry, title: event.target.value } : entry) }))} /><input className={field} value={group.intro ?? ""} placeholder="Intro" onChange={(event) => setDraft((current) => ({ ...current, lexis: current.lexis.map((entry, at) => at === index ? { ...entry, intro: event.target.value || null } : entry) }))} /></div>
                  <textarea rows={12} className={cn(field, "mt-2 w-full font-mono text-xs")} value={group.source} onChange={(event) => setDraft((current) => ({ ...current, lexis: current.lexis.map((entry, at) => at === index ? { ...entry, source: event.target.value } : entry) }))} />
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, lexis: current.lexis.filter((_, at) => at !== index) }))} className="mt-2 flex items-center gap-1 text-xs font-black text-rose-600"><IconTrash className="h-3.5 w-3.5" /> {l.remove}</button>
                </div>)}
                <button type="button" onClick={() => setDraft((current) => ({ ...current, lexis: [...current.lexis, { id: `local-lexis-${Date.now()}`, source: "TYPE: LEXIS\nTITLE: Lexis\n\nITEM: word\nTR: translation", title: "Lexis", intro: null, blocks: [], warnings: [], sourceNodeId: null }] }))} className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-accent/40 px-4 text-sm font-black text-accent"><IconPlus className="h-4 w-4" /> {l.add}</button>
              </div>}

              {tab === "video" && <div className="grid gap-3"><input className={field} value={draft.videoTitle ?? ""} placeholder="Video title" onChange={(event) => setDraft((current) => ({ ...current, videoTitle: event.target.value || null }))} /><input className={field} value={draft.videoUrl ?? ""} placeholder="https://…" onChange={(event) => setDraft((current) => ({ ...current, videoUrl: event.target.value || null }))} /></div>}

              {tab === "transcript" && <textarea rows={24} className={cn(field, "w-full font-mono text-xs")} value={draft.transcript.map((line) => `${line.speaker}: ${line.text}`).join("\n")} onChange={(event) => setDraft((current) => ({ ...current, transcript: event.target.value.split(/\r?\n/).flatMap((line) => { const at = line.indexOf(":"); const speaker = at >= 0 ? line.slice(0, at).trim() : ""; const value = (at >= 0 ? line.slice(at + 1) : line).trim(); return value ? [{ speaker, text: value }] : []; }) }))} />}

              {tab === "questions" && <div className="grid gap-4 lg:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-muted">After video<textarea rows={18} className={field} value={draft.questions.afterVideo.join("\n")} onChange={(event) => setDraft((current) => ({ ...current, questions: { ...current.questions, afterVideo: event.target.value.split(/\r?\n/) } }))} /></label><label className="grid gap-1 text-xs font-bold text-muted">After reading<textarea rows={18} className={field} value={draft.questions.afterReading.join("\n")} onChange={(event) => setDraft((current) => ({ ...current, questions: { ...current.questions, afterReading: event.target.value.split(/\r?\n/) } }))} /></label></div>}

              {tab === "homework" && <div className="space-y-3">
                <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-semibold text-accent">{l.exerciseHint}</p>
                {draft.homework.map((task, index) => <div key={index} className="rounded-2xl border border-line p-3"><input className={cn(field, "w-full")} value={task.title} placeholder="Title" onChange={(event) => setDraft((current) => ({ ...current, homework: current.homework.map((entry, at) => at === index ? { ...entry, title: event.target.value } : entry) }))} /><textarea rows={4} className={cn(field, "mt-2 w-full")} value={task.text} placeholder="Task" onChange={(event) => setDraft((current) => ({ ...current, homework: current.homework.map((entry, at) => at === index ? { ...entry, text: event.target.value } : entry) }))} /><button type="button" onClick={() => setDraft((current) => ({ ...current, homework: current.homework.filter((_, at) => at !== index) }))} className="mt-2 flex items-center gap-1 text-xs font-black text-rose-600"><IconTrash className="h-3.5 w-3.5" /> {l.remove}</button></div>)}
                <button type="button" onClick={() => setDraft((current) => ({ ...current, homework: [...current.homework, { title: "", text: "" }] }))} className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-accent/40 px-4 text-sm font-black text-accent"><IconPlus className="h-4 w-4" /> {l.add}</button>
              </div>}

              {tab === "games" && <div className="space-y-2">{lesson.activities.length === 0 ? <p className="text-sm text-muted">{l.noGames}</p> : lesson.activities.map((activity) => { const checked = draft.activityIds.includes(activity.id); return <label key={activity.id} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-bold text-content"><input type="checkbox" checked={checked} onChange={() => setDraft((current) => ({ ...current, activityIds: checked ? current.activityIds.filter((id) => id !== activity.id) : [...current.activityIds, activity.id] }))} /><span className="min-w-0 flex-1 truncate">{activity.title}</span><span className="text-xs text-faint">{activity.cards.length}</span></label>; })}</div>}
            </div>
          )}
        </div>

        <footer className="border-t border-line bg-surface-2/80 p-4 sm:px-6">
          <div className="grid gap-2 md:grid-cols-2">
            {(["STUDENT", "GLOBAL"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setScope(value)} className={cn("rounded-2xl border p-3 text-left transition", scope === value ? "border-accent bg-accent-soft ring-1 ring-accent/20" : "border-line bg-surface")}>
                <span className="flex items-center gap-2 text-sm font-black text-content"><span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", scope === value ? "border-accent bg-accent text-white" : "border-line")}>{scope === value ? <IconCheck className="h-3 w-3" /> : null}</span>{value === "STUDENT" ? `${l.current}: ${studentName}` : l.global}</span>
                <span className="mt-1 block pl-7 text-[11px] leading-relaxed text-muted">{value === "STUDENT" ? l.currentHint : l.globalHint}</span>
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-sm font-bold text-rose-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-line px-4 text-sm font-bold text-content">{l.close}</button>
            <button type="button" onClick={save} disabled={busy || !draft.title.trim()} className="flex h-11 min-w-44 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-white disabled:opacity-50">{saved ? <><IconCheck className="h-4 w-4" /> {l.saved}</> : busy ? l.saving : l.save}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
