"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconCheck, IconPlus, IconTrash, IconX } from "@/components/icons";
import {
  saveStudentHomeworkPlanAction,
  translateHomeworkRowsAction,
} from "@/lib/actions/lesson-homework";
import {
  homeworkFillEditorLine,
  homeworkFillItemFromEditorLine,
  homeworkTranslationLanguage,
  type HomeworkExercise,
  type HomeworkItem,
  type HomeworkStoredState,
  type InteractiveHomeworkPlan,
} from "@/lib/lesson-homework";

type EditableKind = "fill" | "describe" | "translate" | "question-text" | "question-audio";
type EditorRow = { id: string; primary: string; answer: string };

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function editableKind(exercise?: HomeworkExercise): EditableKind {
  if (!exercise) return "fill";
  if (exercise.kind === "describe") return "describe";
  if (exercise.kind === "translate") return "translate";
  if (exercise.kind === "question-audio") return "question-audio";
  if (exercise.kind === "question-text") return "question-text";
  return "fill";
}

function rowsFromExercise(exercise: HomeworkExercise | undefined, kind: EditableKind): EditorRow[] {
  if (!exercise || exercise.items.length === 0) {
    return [{ id: newId("item"), primary: "", answer: "" }];
  }
  return exercise.items.map((item) => ({
    id: item.id,
    primary:
      kind === "fill"
        ? homeworkFillEditorLine(item)
        : kind === "describe"
          ? item.word || item.prompt
          : item.prompt,
    answer: kind === "translate" ? item.answer ?? "" : "",
  }));
}

export function StudentHomeworkExerciseEditor({
  assignmentId,
  plan,
  exerciseId,
  onClose,
  onSaved,
}: {
  assignmentId: string;
  plan: InteractiveHomeworkPlan;
  exerciseId: string | null;
  onClose: () => void;
  onSaved: (plan: InteractiveHomeworkPlan, state: HomeworkStoredState) => void;
}) {
  const { t, locale } = useT();
  const original = exerciseId
    ? plan.exercises.find((exercise) => exercise.id === exerciseId)
    : undefined;
  const initialKind = editableKind(original);
  const [kind, setKind] = useState<EditableKind>(initialKind);
  const [title, setTitle] = useState(original?.title ?? t.interactiveHomework.typeFill);
  const [optional, setOptional] = useState(original?.optional ?? false);
  const [direction, setDirection] = useState<"to-english" | "from-english">(
    original?.translationDirection === "from-english" ? "from-english" : "to-english",
  );
  const [rowsDirection, setRowsDirection] = useState<"to-english" | "from-english">(
    original?.translationDirection === "from-english" ? "from-english" : "to-english",
  );
  const [translationLanguage, setTranslationLanguage] = useState<"RU" | "UK">(
    original ? homeworkTranslationLanguage(original, locale === "uk" ? "UK" : "RU") : locale === "uk" ? "UK" : "RU",
  );
  const [rows, setRows] = useState<EditorRow[]>(() => rowsFromExercise(original, initialKind));
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startSave] = useTransition();
  const [translating, startTranslation] = useTransition();

  const changeKind = (next: EditableKind) => {
    setKind(next);
    setRows([{ id: newId("item"), primary: "", answer: "" }]);
    setRowsDirection("to-english");
    setError(null);
  };

  const translateRows = () => {
    setError(null);
    startTranslation(async () => {
      const result = await translateHomeworkRowsAction(assignmentId, {
        sourceDirection: rowsDirection,
        targetDirection: direction,
        language: translationLanguage,
        rows,
      });
      if (result.error || !result.rows) {
        setError(result.error ?? t.interactiveHomework.translationFailed);
        return;
      }
      setRows(result.rows);
      setRowsDirection(direction);
    });
  };

  const updateRow = (id: string, field: "primary" | "answer", value: string) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setError(null);
  };

  const buildExercise = (): HomeworkExercise | null => {
    if (!title.trim() || rows.length === 0) {
      setError(t.interactiveHomework.completeEveryRow);
      return null;
    }
    const oldItems = new Map((original?.items ?? []).map((item) => [item.id, item]));
    let items: HomeworkItem[] = [];

    if (kind === "fill") {
      const parsed = rows.map((row) => homeworkFillItemFromEditorLine(row.id, row.primary));
      if (parsed.some((item) => !item)) {
        setError(t.interactiveHomework.invalidFillMarker);
        return null;
      }
      items = parsed.map((item) => {
        const next = item!;
        const old = oldItems.get(next.id);
        return old?.accepted ? { ...next, accepted: old.accepted } : next;
      });
    } else if (kind === "describe") {
      if (rows.some((row) => !row.primary.trim())) {
        setError(t.interactiveHomework.completeEveryRow);
        return null;
      }
      items = rows.map((row) => {
        const word = row.primary.trim();
        const old = oldItems.get(row.id);
        return { id: row.id, prompt: word, word, ...(old?.hint ? { hint: old.hint } : {}) };
      });
    } else if (kind === "translate") {
      if (rows.some((row) => !row.primary.trim() || !row.answer.trim())) {
        setError(t.interactiveHomework.completeEveryRow);
        return null;
      }
      items = rows.map((row) => ({
        id: row.id,
        prompt: row.primary.trim(),
        answer: row.answer.trim(),
      }));
    } else {
      if (rows.some((row) => !row.primary.trim())) {
        setError(t.interactiveHomework.completeEveryRow);
        return null;
      }
      items = rows.map((row) => ({ id: row.id, prompt: row.primary.trim() }));
    }

    return {
      id: original?.id ?? newId("exercise"),
      title: title.trim(),
      instruction: original?.instruction ?? "",
      kind,
      optional,
      ...(kind === "fill" ? { wordBank: [...new Set(items.map((item) => item.answer!))] } : {}),
      ...(kind === "translate"
        ? { translationDirection: direction, translationLanguage }
        : {}),
      items,
    };
  };

  const persist = (nextPlan: InteractiveHomeworkPlan) => {
    setError(null);
    startSave(async () => {
      const result = await saveStudentHomeworkPlanAction(assignmentId, nextPlan);
      if (result.error || !result.plan || !result.state) {
        setError(result.error ?? t.interactiveHomework.assignmentFailed);
        return;
      }
      onSaved(result.plan, result.state);
      onClose();
    });
  };

  const save = () => {
    const exercise = buildExercise();
    if (!exercise) return;
    persist({
      ...plan,
      exercises: original
        ? plan.exercises.map((item) => item.id === original.id ? exercise : item)
        : [...plan.exercises, exercise],
    });
  };

  const remove = () => {
    if (!original) return;
    persist({ ...plan, exercises: plan.exercises.filter((exercise) => exercise.id !== original.id) });
  };

  const typeOptions: { value: EditableKind; label: string }[] = [
    { value: "fill", label: t.interactiveHomework.typeFill },
    { value: "describe", label: t.interactiveHomework.typeDescribe },
    { value: "translate", label: t.interactiveHomework.typeTranslate },
    { value: "question-text", label: t.interactiveHomework.typeQuestions },
    { value: "question-audio", label: t.interactiveHomework.typeVoiceQuestions },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-2xl ring-1 ring-line sm:rounded-3xl sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent">
              {t.interactiveHomework.editForStudent}
            </p>
            <h2 className="mt-1 text-xl font-black text-content">
              {original ? t.interactiveHomework.editExercise : t.interactiveHomework.addExercise}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.interactiveHomework.individualCopyHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-faint transition hover:bg-surface-2 hover:text-content"
            aria-label={t.interactiveHomework.cancel}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-black text-muted">
            {t.interactiveHomework.exerciseType}
            <select
              value={kind}
              onChange={(event) => changeKind(event.target.value as EditableKind)}
              className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold text-content outline-none focus:border-accent"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-black text-muted">
            {t.interactiveHomework.exerciseTitle}
            <input
              value={title}
              maxLength={240}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm font-bold text-content outline-none focus:border-accent"
            />
          </label>
        </div>

        {kind === "translate" && (
          <div className="mt-4 grid gap-3 rounded-2xl bg-accent-soft/60 p-3 ring-1 ring-accent/20 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-xs font-black text-muted">
              {t.interactiveHomework.direction}
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as "to-english" | "from-english")}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-content outline-none focus:border-accent"
              >
                <option value="to-english">{t.interactiveHomework.toEnglish}</option>
                <option value="from-english">{t.interactiveHomework.fromEnglish}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-black text-muted">
              {t.interactiveHomework.translationLanguage}
              <select
                value={translationLanguage}
                onChange={(event) => setTranslationLanguage(event.target.value as "RU" | "UK")}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-content outline-none focus:border-accent"
              >
                <option value="RU">{t.interactiveHomework.russian}</option>
                <option value="UK">{t.interactiveHomework.ukrainian}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={translating || rows.length === 0}
              onClick={translateRows}
              className="h-11 rounded-xl bg-accent px-4 text-sm font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
            >
              {translating
                ? t.interactiveHomework.translatingWithDeepL
                : t.interactiveHomework.translateWithDeepL}
            </button>
          </div>
        )}

        {kind === "fill" && (
          <div className="mt-4 rounded-xl bg-accent-soft p-3 text-sm leading-relaxed text-accent ring-1 ring-accent/20">
            {t.interactiveHomework.fillEditorHint}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 ring-1 ring-line">
              <span className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-black text-accent">
                {index + 1}
              </span>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <label className={kind === "translate" ? "sm:col-span-1" : "sm:col-span-2"}>
                  <span className="mb-1 block text-[11px] font-black text-muted">
                    {kind === "fill"
                      ? t.interactiveHomework.typeFill
                      : kind === "describe"
                        ? t.interactiveHomework.wordOrPhrase
                        : kind === "translate"
                          ? t.interactiveHomework.sourceSentence
                          : t.interactiveHomework.question}
                  </span>
                  <textarea
                    value={row.primary}
                    onChange={(event) => updateRow(row.id, "primary", event.target.value)}
                    placeholder={kind === "fill" ? t.interactiveHomework.fillEditorPlaceholder : undefined}
                    className="min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
                  />
                </label>
                {kind === "translate" && (
                  <label>
                    <span className="mb-1 block text-[11px] font-black text-muted">
                      {t.interactiveHomework.correctTranslation}
                    </span>
                    <textarea
                      value={row.answer}
                      onChange={(event) => updateRow(row.id, "answer", event.target.value)}
                      className="min-h-20 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content outline-none focus:border-accent"
                    />
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-rose-50 hover:text-rose-500"
                aria-label={t.lessonUnits.remove}
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { id: newId("item"), primary: "", answer: "" }])}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-3 text-xs font-black text-accent transition hover:brightness-95"
          >
            <IconPlus className="h-4 w-4" />
            {t.interactiveHomework.addRow}
          </button>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-black text-muted">
            <input
              type="checkbox"
              checked={optional}
              onChange={(event) => setOptional(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t.interactiveHomework.bonus}
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-600">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {original && !deleteArmed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeleteArmed(true)}
              className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-rose-500 transition hover:bg-rose-50"
            >
              <IconTrash className="h-4 w-4" />
              {t.interactiveHomework.deleteExercise}
            </button>
          )}
          {deleteArmed && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">
              <span>{t.interactiveHomework.confirmDeleteExercise}</span>
              <button type="button" disabled={busy} onClick={remove} className="rounded-lg bg-rose-500 px-3 py-2 text-white">
                {t.interactiveHomework.confirmDelete}
              </button>
              <button type="button" disabled={busy} onClick={() => setDeleteArmed(false)} className="rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                {t.interactiveHomework.cancel}
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="ml-auto flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-50"
          >
            <IconCheck className="h-4 w-4" />
            {busy ? t.interactiveHomework.savingChanges : t.interactiveHomework.saveChanges}
          </button>
        </div>
      </section>
    </div>
  );
}
