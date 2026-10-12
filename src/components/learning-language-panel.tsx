"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { learningLanguageProgressAction, processLearningLanguageBatchAction, saveLearningLanguageAction, type LearningLanguageProgress } from "@/lib/actions/learning-language";
import type { LearningLanguage } from "@/lib/learning-language-content";

export function LearningLanguagePanel({ studentId, language }: { studentId: string; language: LearningLanguage | null }) {
  const { t } = useT(); const router = useRouter();
  const initial: LearningLanguageProgress = { language, token: null, total: 0, completed: 0, status: "IDLE" };
  const [saved, action, pending] = useActionState(saveLearningLanguageAction, initial);
  const [job, setJob] = useState<LearningLanguageProgress>(initial);
  const [selected, setSelected] = useState<string>(language ?? "");
  useEffect(() => {
    let alive = true;
    void learningLanguageProgressAction(studentId).then(next => { if (alive) { setJob(next); if (next.language) setSelected(next.language); } }).catch(() => {});
    return () => { alive = false; };
  }, [studentId, language]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive && saved.status !== "IDLE") { setJob(saved); if (saved.language) setSelected(saved.language); }
    });
    return () => { alive = false; };
  }, [saved]);
  const token = job.token, running = job.status === "RUNNING";
  useEffect(() => {
    if (!token || !running) return;
    let alive = true;
    void (async () => {
      let current: LearningLanguageProgress;
      do {
        try { current = await processLearningLanguageBatchAction(studentId, token); }
        catch (error) { current = { language, token, total: job.total, completed: job.completed, status: "ERROR", error: error instanceof Error ? error.message : t.profile.learningFailed }; }
        if (!alive) return;
        setJob(current);
        if (current.waiting) await new Promise(resolve => setTimeout(resolve, 1500));
      } while (alive && current.status === "RUNNING" && current.token === token);
      if (alive && current.status === "DONE") router.refresh();
    })();
    return () => { alive = false; };
    // Progress numbers change after each batch, but must not restart the worker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, token, running, router]);
  return <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6" data-learning-language-panel>
    <h2 className="font-semibold text-content">{t.profile.learningLanguage}</h2>
    <p className="mt-1 text-sm leading-relaxed text-muted">{t.profile.learningLanguageHint}</p>
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <label className="flex w-full min-w-0 flex-none flex-col gap-1.5 sm:w-auto sm:max-w-sm sm:flex-1">
        <span className="text-xs font-semibold text-muted">{t.profile.learningLanguage}</span>
        <select name="learningLanguage" value={selected} onChange={event => setSelected(event.target.value)} required disabled={pending} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-content outline-none focus:border-accent">
          <option value="" disabled>{t.profile.learningChoose}</option><option value="RU">Russian</option><option value="UK">Ukrainian</option>
        </select>
      </label>
      <button type="submit" disabled={pending || !selected} className="h-11 w-full rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">{pending ? t.common.loading : t.profile.saveChanges}</button>
    </form>
    {running && <div className="mt-4 rounded-xl bg-accent-soft p-3" role="status" aria-live="polite"><p className="text-sm font-semibold text-accent">{t.profile.learningTranslating} {job.completed} / {job.total}</p><progress value={job.completed} max={Math.max(1, job.total)} className="mt-2 h-2 w-full accent-[var(--accent)]" /><p className="mt-1 text-xs text-muted">{t.profile.learningResumeHint}</p></div>}
    {job.status === "DONE" && <p className="mt-4 text-sm font-semibold text-accent" role="status">{t.profile.learningComplete}</p>}
    {job.status === "ERROR" && <div className="mt-4 rounded-xl bg-rose-500/10 p-3" role="alert"><p className="text-sm font-semibold text-rose-600">{job.error || t.profile.learningFailed}</p>{job.token && <button type="button" onClick={() => setJob(current => ({ ...current, status: "RUNNING", error: undefined }))} className="mt-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-content">{t.profile.learningRetry}</button>}</div>}
  </section>;
}
