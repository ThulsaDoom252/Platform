"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { saveRegularVoiceRecordingAction } from "@/lib/actions/lessons";
import {
  regularNoteKey,
  regularNoteVisibleKey,
  regularVoiceRecording,
  type RegularVoiceExercise,
} from "@/lib/regular-lesson";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "paused" | "ready";

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

const recorderMimeType = () => {
  const variants = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return variants.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const extensionFor = (mimeType: string) => {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

export function RegularVoiceRecorder({
  assignmentId,
  sectionId,
  exercise,
  teacher,
  state,
  onStateChange,
  onSaveResponse,
  compact = false,
}: {
  assignmentId: string;
  sectionId: string;
  exercise: RegularVoiceExercise;
  teacher: boolean;
  state: Record<string, string>;
  onStateChange: (state: Record<string, string>) => void;
  onSaveResponse?: (key: string, value: string) => Promise<{ error?: string }>;
  compact?: boolean;
}) {
  const published = regularVoiceRecording(state, sectionId);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMime, setPreviewMime] = useState("audio/webm");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const noteKey = regularNoteKey(sectionId, "recording");
  const visibleKey = regularNoteVisibleKey(sectionId, "recording");
  const [noteDraft, setNoteDraft] = useState(state[noteKey] ?? "");
  const [noteVisible, setNoteVisible] = useState(state[visibleKey] === "1");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const currentElapsed = () => accumulatedRef.current + (
    phase === "recording" ? (performance.now() - startedAtRef.current) / 1_000 : 0
  );

  const startTimer = () => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      const next = accumulatedRef.current + (performance.now() - startedAtRef.current) / 1_000;
      setElapsed(Math.min(next, exercise.maxSeconds));
      if (next >= exercise.maxSeconds && recorderRef.current?.state !== "inactive") {
        accumulatedRef.current = exercise.maxSeconds;
        recorderRef.current?.stop();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        stopTimer();
      }
    }, 200);
  };

  const resetPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPreviewBlob(null);
    setElapsed(0);
    accumulatedRef.current = 0;
  };

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio.");
      return;
    }
    try {
      resetPreview();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      accumulatedRef.current = 0;
      startedAtRef.current = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        if (discardRef.current) {
          chunksRef.current = [];
          setPhase("idle");
          return;
        }
        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewMime(finalMime);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setElapsed(Math.max(1, Math.min(exercise.maxSeconds, accumulatedRef.current)));
        setPhase("ready");
      };
      recorder.start(250);
      setPhase("recording");
      startTimer();
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Microphone access failed.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setPhase("idle");
    }
  };

  const pause = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    accumulatedRef.current = currentElapsed();
    setElapsed(accumulatedRef.current);
    recorder.pause();
    stopTimer();
    setPhase("paused");
  };

  const resume = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startedAtRef.current = performance.now();
    setPhase("recording");
    startTimer();
  };

  const finish = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "recording") accumulatedRef.current = currentElapsed();
    setElapsed(accumulatedRef.current);
    recorder.stop();
    stopTimer();
  };

  const startOver = () => {
    setError(null);
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    stopTimer();
    resetPreview();
    setPhase("idle");
  };

  const publish = async () => {
    if (!previewBlob || elapsed < 1) return;
    setUploading(true);
    setError(null);
    try {
      const uploadMime = previewMime.split(";", 1)[0] || "audio/webm";
      const extension = extensionFor(uploadMime);
      const file = new File([previewBlob], `voice-answer.${extension}`, { type: uploadMime });
      const blob = await upload(
        `uploads/lesson-audio/${assignmentId}-${sectionId}-${crypto.randomUUID()}.${extension}`,
        file,
        {
          access: "public",
          handleUploadUrl: `/api/lesson-audio/${assignmentId}`,
          clientPayload: JSON.stringify({ assignmentId, sectionId }),
        },
      );
      const result = await saveRegularVoiceRecordingAction(
        assignmentId,
        sectionId,
        blob.url,
        Math.round(elapsed),
        previewMime,
      );
      if (result.error || !result.state) throw new Error(result.error ?? "Publish failed.");
      onStateChange(result.state);
      resetPreview();
      setPhase("idle");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Publish failed.");
    } finally {
      setUploading(false);
    }
  };

  const saveNote = async (nextNote = noteDraft, nextVisible = noteVisible) => {
    if (!onSaveResponse) return;
    await onSaveResponse(noteKey, nextNote.trim());
    await onSaveResponse(visibleKey, nextVisible ? "1" : "");
  };

  return (
    <div className={compact ? "mt-3" : "p-4 sm:p-6"}>
      <div className={cn("grid gap-5", !compact && "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]")}>
        {!compact && <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-600">
            Speaking prompts
          </p>
          {exercise.instruction && (
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {exercise.instruction}
            </p>
          )}
          <ol className="mt-4 space-y-2.5">
            {exercise.prompts.map((prompt, index) => (
              <li key={`${index}-${prompt}`} className="flex gap-3 rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-violet-100">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-black text-violet-700">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold leading-relaxed text-slate-800">{prompt}</span>
              </li>
            ))}
          </ol>
        </section>}

        <section className="rounded-2xl border border-line bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Voice answer</p>
              <p className="mt-1 text-sm text-slate-300">
                {published ? "Published recording" : teacher ? "Waiting for the student" : "Record one answer for this exercise"}
              </p>
            </div>
            <div className={cn(
              "rounded-xl px-3 py-1.5 font-mono text-lg font-black",
              phase === "recording" ? "bg-rose-500/20 text-rose-300" : "bg-white/8 text-white",
            )}>
              {formatDuration(phase === "idle" && published ? published.durationSeconds : elapsed)}
            </div>
          </div>

          {published && phase === "idle" && (
            <div className="mt-5 rounded-2xl bg-white/7 p-3 ring-1 ring-white/10">
              <audio controls preload="metadata" src={published.url} className="w-full" />
              <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>✓ Published</span>
                <span>{formatDuration(published.durationSeconds)}</span>
              </div>
            </div>
          )}

          {!teacher && phase === "ready" && previewUrl && (
            <div className="mt-5 rounded-2xl bg-white/7 p-3 ring-1 ring-white/10">
              <audio controls preload="metadata" src={previewUrl} className="w-full" />
              <p className="mt-2 text-[11px] font-bold text-slate-400">Listen before publishing · {formatDuration(elapsed)}</p>
            </div>
          )}

          {!teacher && (
            <div className="mt-5 flex flex-wrap gap-2">
              {phase === "idle" && (
                <button type="button" onClick={start} className="flex h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-black shadow-lg shadow-rose-950/30 transition hover:bg-rose-400">
                  <span aria-hidden>🎙️</span>{published ? "Record again" : "Start recording"}
                </button>
              )}
              {phase === "recording" && (
                <>
                  <button type="button" onClick={pause} className="h-11 rounded-xl bg-amber-400 px-4 text-sm font-black text-slate-950">Ⅱ Pause</button>
                  <button type="button" onClick={finish} className="h-11 rounded-xl bg-emerald-500 px-4 text-sm font-black">■ Finish</button>
                  <button type="button" onClick={startOver} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-black">↺ Start over</button>
                </>
              )}
              {phase === "paused" && (
                <>
                  <button type="button" onClick={resume} className="h-11 rounded-xl bg-sky-400 px-4 text-sm font-black text-slate-950">▶ Resume</button>
                  <button type="button" onClick={finish} className="h-11 rounded-xl bg-emerald-500 px-4 text-sm font-black">■ Finish</button>
                  <button type="button" onClick={startOver} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-black">↺ Start over</button>
                </>
              )}
              {phase === "ready" && (
                <>
                  <button type="button" disabled={uploading} onClick={publish} className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-black disabled:opacity-50">
                    {uploading ? "Publishing…" : "Publish"}
                  </button>
                  <button type="button" disabled={uploading} onClick={startOver} className="h-11 rounded-xl bg-white/10 px-4 text-sm font-black disabled:opacity-50">↺ Start over</button>
                </>
              )}
            </div>
          )}

          {phase === "recording" && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full animate-pulse rounded-full bg-rose-400" style={{ width: `${Math.max(2, (elapsed / exercise.maxSeconds) * 100)}%` }} />
            </div>
          )}
          {error && <p className="mt-4 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200">{error}</p>}
        </section>
      </div>

      {!compact && <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        {teacher ? (
          <>
            <button type="button" onClick={() => setNoteOpen((value) => !value)} className="text-xs font-black text-accent">
              ✎ {noteDraft ? "Edit note" : "Add note"}
            </button>
            {noteOpen && (
              <div className="mt-3 grid gap-2">
                <textarea
                  rows={3}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  onBlur={() => void saveNote()}
                  placeholder="Teacher’s note…"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-content outline-none focus:border-accent"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-muted">
                  <input
                    type="checkbox"
                    checked={noteVisible}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setNoteVisible(next);
                      void saveNote(noteDraft, next);
                    }}
                  />
                  Show to student
                </label>
              </div>
            )}
          </>
        ) : noteVisible && noteDraft.trim() ? (
          <details>
            <summary className="cursor-pointer text-xs font-black text-accent">Teacher’s note</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content">{noteDraft}</p>
          </details>
        ) : (
          <p className="text-xs font-semibold text-muted">Your teacher can leave a note after listening.</p>
        )}
      </div>}
    </div>
  );
}
