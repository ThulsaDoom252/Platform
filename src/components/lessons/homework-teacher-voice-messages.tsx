"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n-provider";
import { IconTrash } from "@/components/icons";
import {
  removeHomeworkTeacherVoiceMessageAction,
  saveHomeworkTeacherVoiceMessageAction,
} from "@/lib/actions/lesson-homework";
import {
  homeworkTeacherVoiceMessages,
  type HomeworkStoredState,
} from "@/lib/lesson-homework";

type Phase = "idle" | "recording" | "ready";

const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;

const recorderMimeType = () => [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

const extensionFor = (mimeType: string) => {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

export function HomeworkTeacherVoiceMessages({
  assignmentId,
  teacher,
  state,
  onStateChange,
}: {
  assignmentId: string;
  teacher: boolean;
  state: HomeworkStoredState;
  onStateChange: (state: HomeworkStoredState) => void;
}) {
  const { locale } = useT();
  const messages = homeworkTeacherVoiceMessages(state);
  const text = locale === "ru"
    ? {
        title: "Голосовые комментарии учителя",
        hint: "Запиши общий комментарий к домашней работе. Ученик сможет прослушать его в домашке.",
        empty: "Голосовых комментариев пока нет.",
        start: "Записать сообщение",
        finish: "Завершить",
        retry: "Перезаписать",
        publish: "Отправить ученику",
        publishing: "Отправляю…",
        preview: "Прослушай перед отправкой",
        message: "Комментарий учителя",
        remove: "Удалить запись",
        confirmRemove: "Нажми ещё раз для удаления",
        unsupported: "Этот браузер не поддерживает запись звука.",
        failed: "Не удалось записать или отправить сообщение.",
      }
    : locale === "uk"
      ? {
          title: "Голосові коментарі вчителя",
          hint: "Запиши загальний коментар до домашньої роботи. Учень зможе прослухати його в домашній роботі.",
          empty: "Голосових коментарів поки немає.",
          start: "Записати повідомлення",
          finish: "Завершити",
          retry: "Перезаписати",
          publish: "Надіслати учневі",
          publishing: "Надсилаю…",
          preview: "Прослухай перед надсиланням",
          message: "Коментар учителя",
          remove: "Видалити запис",
          confirmRemove: "Натисни ще раз для видалення",
          unsupported: "Цей браузер не підтримує запис звуку.",
          failed: "Не вдалося записати або надіслати повідомлення.",
        }
      : {
          title: "Teacher voice messages",
          hint: "Record overall feedback for this homework. The student can listen to it here.",
          empty: "There are no voice messages yet.",
          start: "Record a message",
          finish: "Finish",
          retry: "Record again",
          publish: "Send to student",
          publishing: "Sending…",
          preview: "Listen before sending",
          message: "Teacher feedback",
          remove: "Delete recording",
          confirmRemove: "Click again to delete",
          unsupported: "This browser cannot record audio.",
          failed: "Could not record or send the message.",
        };
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState("audio/webm");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeArmed, setRemoveArmed] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setBlob(null);
    setElapsed(0);
  };

  useEffect(() => () => {
    stopTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(text.unsupported);
      return;
    }
    try {
      clearPreview();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = recorderMimeType();
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      startedAtRef.current = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());
        const finalMime = recorder.mimeType || preferred || "audio/webm";
        const nextBlob = new Blob(chunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(nextBlob);
        previewUrlRef.current = url;
        setMimeType(finalMime);
        setBlob(nextBlob);
        setPreviewUrl(url);
        setElapsed((current) => Math.max(1, Math.min(600, current)));
        setPhase("ready");
      };
      recorder.start(250);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        const seconds = (performance.now() - startedAtRef.current) / 1_000;
        setElapsed(Math.min(600, seconds));
        if (seconds >= 600 && recorder.state !== "inactive") recorder.stop();
      }, 200);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : text.failed);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setPhase("idle");
    }
  };

  const finish = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setElapsed(Math.max(1, Math.min(600, (performance.now() - startedAtRef.current) / 1_000)));
    recorder.stop();
  };

  const retry = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    stopTimer();
    clearPreview();
    setPhase("idle");
    setError(null);
  };

  const publish = () => {
    if (!blob || elapsed < 1) return;
    startBusy(async () => {
      setError(null);
      try {
        const id = crypto.randomUUID();
        const cleanMime = mimeType.split(";", 1)[0] || "audio/webm";
        const extension = extensionFor(cleanMime);
        const file = new File([blob], `teacher-feedback.${extension}`, { type: cleanMime });
        const uploaded = await upload(
          `uploads/lesson-audio/${assignmentId}-teacher-feedback-${id}.${extension}`,
          file,
          {
            access: "public",
            handleUploadUrl: `/api/lesson-audio/${assignmentId}`,
            clientPayload: JSON.stringify({ assignmentId, sectionId: "teacher-feedback" }),
          },
        );
        const result = await saveHomeworkTeacherVoiceMessageAction(assignmentId, {
          id,
          url: uploaded.url,
          durationSeconds: Math.round(elapsed),
          mimeType,
        });
        if (result.error || !result.state) throw new Error(result.error ?? text.failed);
        onStateChange(result.state);
        clearPreview();
        setPhase("idle");
      } catch (publishError) {
        setError(publishError instanceof Error ? publishError.message : text.failed);
      }
    });
  };

  if (!teacher && messages.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-surface to-violet-50 p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-xl text-white shadow-sm">🎙️</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-content">{text.title}</h3>
          {teacher && <p className="mt-1 text-sm leading-relaxed text-muted">{text.hint}</p>}
        </div>
        {teacher && phase === "recording" && (
          <span className="rounded-xl bg-rose-100 px-3 py-2 font-mono text-sm font-black text-rose-700">● {duration(elapsed)}</span>
        )}
      </div>

      {messages.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {messages.map((message, index) => (
            <div key={message.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-sky-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sm font-black text-sky-700">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs font-black text-content">{text.message}</p>
                <audio controls preload="metadata" src={message.url} className="h-9 w-full min-w-48" />
              </div>
              <span className="text-xs font-bold text-muted">{duration(message.durationSeconds)}</span>
              {teacher && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (removeArmed !== message.id) {
                      setRemoveArmed(message.id);
                      return;
                    }
                    startBusy(async () => {
                      const result = await removeHomeworkTeacherVoiceMessageAction(assignmentId, message.id);
                      if (result.error || !result.state) return setError(result.error ?? text.failed);
                      setRemoveArmed(null);
                      onStateChange(result.state);
                    });
                  }}
                  title={removeArmed === message.id ? text.confirmRemove : text.remove}
                  aria-label={removeArmed === message.id ? text.confirmRemove : text.remove}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${removeArmed === message.id ? "bg-rose-500 text-white" : "text-faint hover:bg-rose-50 hover:text-rose-500"}`}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        teacher && <p className="mt-4 rounded-xl border border-dashed border-sky-200 px-3 py-4 text-center text-sm font-semibold text-muted">{text.empty}</p>
      )}

      {teacher && (
        <div className="mt-4">
          {phase === "ready" && previewUrl && (
            <div className="mb-3 rounded-2xl bg-slate-950 p-3 text-white">
              <p className="mb-2 text-xs font-bold text-slate-300">{text.preview} · {duration(elapsed)}</p>
              <audio controls preload="metadata" src={previewUrl} className="w-full" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {phase === "idle" && (
              <button type="button" disabled={busy} onClick={start} className="h-11 rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50">🎙️ {text.start}</button>
            )}
            {phase === "recording" && (
              <button type="button" onClick={finish} className="h-11 rounded-xl bg-rose-500 px-4 text-sm font-black text-white">■ {text.finish}</button>
            )}
            {phase === "ready" && (
              <>
                <button type="button" disabled={busy} onClick={retry} className="h-11 rounded-xl border border-line bg-surface px-4 text-sm font-black text-content disabled:opacity-50">↺ {text.retry}</button>
                <button type="button" disabled={busy} onClick={publish} className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white disabled:opacity-50">{busy ? text.publishing : text.publish}</button>
              </>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">{error}</p>}
    </section>
  );
}
