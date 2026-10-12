"use client";

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { TimerNumberInput } from "@/components/timer-number-input";
import { WordDeckBoard } from "./word-deck-board";
import {
  addWordDeckToClassAction, deleteWordDeckActivityAction, listWordDeckActivitiesAction,
  listWordDeckStudentsAction, saveWordDeckActivityAction,
  type WordDeckActivity, type WordDeckStudent,
} from "@/lib/actions/word-deck";
import { DEFAULT_WORD_DECK_SETTINGS } from "@/lib/word-deck";
import { normalizeTenseCorrectionSettings, TENSE_IDS, TENSE_NAMES, type TenseCorrectionSettings } from "@/lib/tense-correction-settings";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUiChoice } from "@/components/ui-preferences-provider";

const input = "h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:border-accent";
type SaveInput = Parameters<typeof saveWordDeckActivityAction>[0];

export function TenseCorrectionForm({ activity, busy = false, externalError, onCancel, onSave, submitLabel }: {
  activity: WordDeckActivity | null;
  busy?: boolean;
  externalError?: string | null;
  onCancel: () => void;
  onSave: (payload: SaveInput) => void;
  submitLabel?: string;
}) {
  const { t } = useT();
  const [title, setTitle] = useState(activity?.title ?? t.tenseCorrection.title);
  const [settings, setSettings] = useState(() => normalizeTenseCorrectionSettings(activity?.settings.correction));
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeTenseCorrectionSettings(settings);
  const total = normalized.tenses.reduce((sum, id) => sum + normalized.counts[id], 0);
  const update = (change: Partial<TenseCorrectionSettings>) => setSettings((previous) => {
    const next = { ...previous, ...change };
    const valid = normalizeTenseCorrectionSettings(next);
    return { ...next, correctCount: valid.correctCount };
  });

  return <form className="rounded-3xl bg-surface p-4 ring-1 ring-line sm:p-6" onSubmit={(event) => {
    event.preventDefault();
    if (!normalized.tenses.length) return setError(t.tenseCorrection.choose);
    if (!title.trim()) return;
    setError(null);
    onSave({ id: activity?.id, title: title.trim(), settings: {
      ...DEFAULT_WORD_DECK_SETTINGS, gameType: "TENSE_CORRECTION", repeats: 1,
      timerMode: normalized.timerMode, gameSeconds: normalized.gameSeconds, cardSeconds: normalized.cardSeconds,
      correction: normalized,
    } });
  }}>
    <h2 className="text-xl font-black text-content">✏️ {t.tenseCorrection.title}</h2>
    <p className="mt-1 text-sm text-muted">{t.tenseCorrection.subtitle}</p>
    <label className="mt-5 block text-sm font-bold text-content">{t.tenseCorrection.name}
      <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={cn(input, "mt-2")} />
    </label>
    <fieldset className="mt-5">
      <legend className="text-sm font-bold text-content">{t.tenseCorrection.tenses}</legend>
      <p className="mt-1 text-xs text-faint">{t.tenseCorrection.count}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TENSE_IDS.map((id) => {
          const selected = settings.tenses.includes(id);
          return <div key={id} className={cn("flex min-w-0 items-center gap-2 rounded-xl p-3 ring-1", selected ? "bg-accent-soft ring-accent" : "bg-surface-2 ring-line")}>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs font-bold text-content">
              <input type="checkbox" checked={selected} className="h-4 w-4 accent-accent" onChange={() => update({ tenses: selected ? settings.tenses.filter((tense) => tense !== id) : [...settings.tenses, id] })} />
              {TENSE_NAMES[id]}
            </label>
            <TimerNumberInput aria-label={`${TENSE_NAMES[id]} — ${t.tenseCorrection.count}`} value={settings.counts[id]} onChange={(count) => update({ counts: { ...settings.counts, [id]: count } })} required={selected} disabled={!selected} min={1} max={10} className="h-9 w-16 shrink-0 rounded-lg border border-line bg-surface px-2 text-sm text-content disabled:opacity-35" />
          </div>;
        })}
      </div>
    </fieldset>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-bold text-content">{t.tenseCorrection.correctCount}
        <TimerNumberInput aria-label={t.tenseCorrection.correctCount} min={0} max={total} value={settings.correctCount} onChange={(correctCount) => update({ correctCount })} className={cn(input, "mt-2")} />
        <span className="mt-2 block text-xs font-normal text-faint">{t.tenseCorrection.correctHint}</span>
      </label>
      <div className="rounded-xl bg-accent-soft p-4 text-accent">
        <p className="text-lg font-black">{fmt(t.tenseCorrection.total, { n: total })}</p>
        <p className="mt-2 text-xs font-semibold">{t.tenseCorrection.prompt}</p>
      </div>
    </div>
    <fieldset className="mt-5">
      <legend className="text-sm font-bold text-content">{t.tenseCorrection.timer}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["NONE", "GAME", "CARD"] as const).map((mode) => <button key={mode} type="button" onClick={() => update({ timerMode: mode })} aria-pressed={settings.timerMode === mode} className={cn("rounded-xl border px-4 py-2 text-sm font-bold", settings.timerMode === mode ? "border-accent bg-accent text-white" : "border-line text-muted")}>
          {mode === "NONE" ? t.wordDeck.timerNone : mode === "GAME" ? t.wordDeck.timerGame : t.tenseCorrection.timerSentence}
        </button>)}
      </div>
      {settings.timerMode !== "NONE" && <label className="mt-3 block max-w-xs text-xs font-bold text-content">{t.tenseCorrection.seconds}
        <TimerNumberInput min={0} max={settings.timerMode === "CARD" ? 300 : 3600} value={settings.timerMode === "CARD" ? settings.cardSeconds : settings.gameSeconds} onChange={(seconds) => update(settings.timerMode === "CARD" ? { cardSeconds: seconds } : { gameSeconds: seconds })} className={cn(input, "mt-1")} />
      </label>}
    </fieldset>
    {(error || externalError) && <p role="alert" className="mt-4 text-sm font-semibold text-rose-500">{error || externalError}</p>}
    <div className="mt-6 flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={onCancel} className="h-11 rounded-xl border border-line px-5 text-sm font-bold text-muted">{t.common.cancel}</button>
      <button type="submit" disabled={busy || !normalized.tenses.length} className="h-11 rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? t.common.loading : submitLabel ?? t.common.save}</button>
    </div>
  </form>;
}

export function TenseCorrectionStudio({ initialActivities, initialActivityId, studentId, onAdded, onCancel }: {
  initialActivities: WordDeckActivity[];
  initialActivityId?: string;
  studentId?: string;
  onAdded?: () => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [activities, setActivities] = useState(initialActivities);
  const [editing, setEditing] = useState<WordDeckActivity | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(() => initialActivities.find((activity) => activity.id === initialActivityId) ?? null);
  const [students, setStudents] = useState<WordDeckStudent[] | null>(null);
  const [target, setTarget] = useState(studentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [sort, setSort] = useUiChoice("tense-correction:sort", ["NEWEST", "TITLE"] as const, "NEWEST");
  const sorted = useMemo(() => [...activities].sort((a, b) => sort === "TITLE" ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt)), [activities, sort]);
  const reload = async () => {
    const rows = (await listWordDeckActivitiesAction()).filter((row) => row.settings.gameType === "TENSE_CORRECTION");
    setActivities(rows);
    return rows;
  };
  const add = async (id: string) => {
    const result = await addWordDeckToClassAction(id, studentId ?? target);
    if (result.error) setError(result.error);
    else { setError(null); await onAdded?.(); }
  };
  if (creating || editing) return <TenseCorrectionForm key={editing?.id ?? "new"} activity={editing} busy={busy} externalError={error} onCancel={() => { setCreating(false); setEditing(null); setError(null); }} onSave={(payload) => startBusy(async () => {
    setError(null);
    const saved = await saveWordDeckActivityAction(payload);
    if (!saved.id || saved.error) return setError(saved.error ?? t.wordDeck.saveFailed);
    const rows = await reload();
    setCreating(false); setEditing(null);
    if (studentId) await add(saved.id);
    else setPreview(rows.find((row) => row.id === saved.id) ?? null);
  })} submitLabel={studentId ? t.activityPicker.createAndAdd : undefined} />;

  return <section className="rounded-3xl bg-surface p-4 ring-1 ring-line sm:p-6">
    <div className="flex flex-wrap items-center gap-3">
      {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-line px-3 py-2 text-sm font-bold text-muted">← {t.wordDeck.back}</button>}
      <div className="min-w-0 flex-1"><h2 className="text-xl font-black text-content">✏️ {t.tenseCorrection.title}</h2><p className="mt-1 text-sm text-muted">{t.tenseCorrection.subtitle}</p></div>
      <button type="button" onClick={() => { setError(null); setCreating(true); }} className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white">+ {t.tenseCorrection.create}</button>
    </div>
    {preview && <div className="mt-5"><button type="button" onClick={() => setPreview(null)} className="mb-2 text-sm font-bold text-muted">✕ {t.common.close}</button><WordDeckBoard key={`${preview.id}:${preview.updatedAt}`} activity={preview} timerControls /></div>}
    {error && <p role="alert" className="mt-4 text-sm font-semibold text-rose-500">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      <select aria-label={t.wordDeck.sortNewest} value={sort} onChange={(event) => setSort(event.target.value as "NEWEST" | "TITLE")} className={cn(input, "max-w-xs")}>
        <option value="NEWEST">{t.wordDeck.sortNewest}</option><option value="TITLE">{t.wordDeck.sortTitle}</option>
      </select>
      {!studentId && (students === null ? <button type="button" disabled={busy} onClick={() => startBusy(async () => { try { setStudents(await listWordDeckStudentsAction()); } catch { setError(t.wordDeck.studentsFailed); } })} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-accent">{t.wordDeck.chooseStudent}</button> : <select aria-label={t.wordDeck.chooseStudent} value={target} onChange={(event) => setTarget(event.target.value)} className={cn(input, "max-w-xs")}><option value="">{t.wordDeck.chooseStudent}</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select>)}
    </div>
    {!sorted.length && <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-sm text-faint">{t.tenseCorrection.noPresets}</p>}
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{sorted.map((activity) => <article key={activity.id} className="rounded-2xl bg-surface-2 p-4 ring-1 ring-line">
      <h3 className="break-words font-black text-content">{activity.title}</h3>
      <p className="mt-1 text-xs text-faint">{fmt(t.tenseCorrection.total, { n: activity.cards.length })} · {activity.settings.correction?.tenses.map((id) => TENSE_NAMES[id]).join(" + ")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setPreview(activity)} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white">▶ {t.wordDeck.play}</button>
        <button type="button" onClick={() => { setEditing(activity); setError(null); }} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-content">{t.wordDeck.edit}</button>
        <button type="button" disabled={busy || !(studentId || target)} onClick={() => startBusy(async () => { await add(activity.id); })} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-accent disabled:opacity-35">{t.activityPicker.addPreset}</button>
        <button type="button" disabled={busy} onClick={() => startBusy(async () => { const result = await deleteWordDeckActivityAction(activity.id); if (result.error) setError(result.error); else { if (preview?.id === activity.id) setPreview(null); await reload(); } })} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-rose-500">{t.common.delete}</button>
      </div>
    </article>)}</div>
  </section>;
}
