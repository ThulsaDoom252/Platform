"use client";

/**
 * Полноэкранная доска класса.
 *
 * Canvas остаётся изолированным в iframe, а оболочка отвечает за то, что
 * относится к классу: хранит доску выбранного ученика, показывает учителю
 * выбранный объект и доставляет ученику явные команды показа/фокусировки.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useT } from "@/components/i18n-provider";
import { IconEye, IconStar, IconUser, IconX } from "@/components/icons";
import { fmt } from "@/lib/i18n";
import {
  classBoardStateAction,
  flashBoardObjectAction,
  focusBoardObjectAction,
  saveClassBoardAction,
  showBoardToStudentAction,
} from "@/lib/actions/board";
import type { BoardScene } from "@/lib/board-scene";
import { cn } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/use-realtime";

const CHANNEL = "lingora-whiteboard";
type FrameMessage = {
  channel?: string;
  type?: string;
  scene?: BoardScene;
  objectId?: number | null;
  label?: string | null;
};

type BoardFocus = {
  objectId: number | null;
  command: "SHOW" | "FOCUS" | "FLASH";
  at: string;
} | null;

export function ClassBoard({
  teacher,
  studentId,
  studentName,
  studentHere,
  focus,
  onStudentShown,
  onClose,
}: {
  teacher: boolean;
  studentId: string | null;
  studentName: string | null;
  studentHere: boolean;
  focus: BoardFocus;
  onStudentShown: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const iframe = useRef<HTMLIFrameElement>(null);
  const frameReady = useRef(false);
  const initialLoaded = useRef(false);
  const latestScene = useRef<BoardScene | null>(null);
  const latestUpdatedAt = useRef<string | null>(null);
  const latestFocus = useRef<BoardFocus>(focus);
  const refreshBoard = useRef<() => void>(() => {});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));
  const [selected, setSelected] = useState<{ id: number; label: string } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const post = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    iframe.current?.contentWindow?.postMessage(
      { channel: CHANNEL, type, ...payload },
      window.location.origin,
    );
  }, []);

  const applyBoardCommand = useCallback((next: NonNullable<BoardFocus>) => {
    if (next.command === "FLASH" && next.objectId !== null) {
      post("FLASH", { objectId: next.objectId });
      return;
    }
    post("FOCUS", {
      objectId: next.command === "FOCUS" ? next.objectId : null,
    });
  }, [post]);

  const persist = useCallback((scene: BoardScene) => {
    setSaveState("saving");
    const next = saveChain.current
      .catch(() => false)
      .then(async () => {
        try {
          const result = await saveClassBoardAction(scene);
          if (result.error) {
            setError(result.error);
            setSaveState("idle");
            return false;
          }
          latestUpdatedAt.current = result.updatedAt ?? latestUpdatedAt.current;
          setSaveState("saved");
          return true;
        } catch {
          setError(t.classRoom.boardSyncError);
          setSaveState("idle");
          return false;
        }
      });
    saveChain.current = next;
    return next;
  }, [t.classRoom.boardSyncError]);

  const queueSave = useCallback((scene: BoardScene) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(scene);
    }, 500);
  }, [persist]);

  useEffect(() => {
    latestFocus.current = focus;
    if (!teacher && focus && frameReady.current) {
      applyBoardCommand(focus);
    }
  }, [applyBoardCommand, focus, teacher]);

  useEffect(() => {
    let alive = true;

    const receive = (event: MessageEvent<FrameMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframe.current?.contentWindow ||
        event.data?.channel !== CHANNEL
      ) return;

      if (event.data.type === "READY") {
        frameReady.current = true;
        if (latestScene.current) post("LOAD", { scene: latestScene.current });
        if (!teacher && latestFocus.current) {
          applyBoardCommand(latestFocus.current);
        }
        return;
      }

      if (teacher && event.data.type === "SELECTION") {
        const id = Number(event.data.objectId);
        setSelected(Number.isFinite(id) && id > 0
          ? { id, label: String(event.data.label ?? `#${id}`).slice(0, 100) }
          : null);
        return;
      }

      if (teacher && event.data.type === "SCENE" && event.data.scene) {
        latestScene.current = event.data.scene;
        if (initialLoaded.current) queueSave(event.data.scene);
      }
    };

    const refresh = async (first = false) => {
      try {
        const state = await classBoardStateAction();
        if (!alive) return;
        if (first) initialLoaded.current = true;

        if (state.scene && (first || state.updatedAt !== latestUpdatedAt.current)) {
          latestScene.current = state.scene;
          latestUpdatedAt.current = state.updatedAt;
          if (frameReady.current) post("LOAD", { scene: state.scene });
        } else if (first && teacher && latestScene.current) {
          queueSave(latestScene.current);
        }
      } catch {
        if (alive) setError(t.classRoom.boardSyncError);
      }
    };
    refreshBoard.current = () => void refresh();

    window.addEventListener("message", receive);
    void refresh(true);

    return () => {
      alive = false;
      window.removeEventListener("message", receive);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (teacher && initialLoaded.current && latestScene.current) {
          const scene = latestScene.current;
          void saveChain.current.then(() => saveClassBoardAction(scene));
        }
      }
    };
  }, [applyBoardCommand, post, queueSave, t.classRoom.boardSyncError, teacher]);

  useRealtimeSubscription({
    channel: studentId ? `class:${studentId}` : null,
    events: "board",
    onMessage: () => refreshBoard.current(),
    onFallback: () => refreshBoard.current(),
    fallbackMs: 1_000,
    enabled: !teacher,
  });

  // Escape закрывает доску, если фокус находится вне iframe.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const showStudent = () => startBusy(async () => {
    setError(null);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (latestScene.current && !(await persist(latestScene.current))) return;
    const result = await showBoardToStudentAction();
    if (result.error) setError(result.error);
    else onStudentShown();
  });

  const focusStudent = () => {
    if (!selected) return;
    startBusy(async () => {
      setError(null);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (latestScene.current && !(await persist(latestScene.current))) return;
      const result = await focusBoardObjectAction(selected.id);
      if (result.error) setError(result.error);
      else onStudentShown();
    });
  };

  const flashStudent = () => {
    if (!selected) return;
    startBusy(async () => {
      setError(null);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (latestScene.current && !(await persist(latestScene.current))) return;
      const result = await flashBoardObjectAction(selected.id);
      if (result.error) setError(result.error);
      else onStudentShown();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <iframe
        ref={iframe}
        src={`/whiteboard.html?role=${teacher ? "teacher" : "student"}`}
        title={t.classRoom.board}
        className="h-full w-full flex-1 border-0"
      />

      {teacher && (
        <div className="absolute left-3 top-3 flex max-w-[calc(100%_-_9rem)] flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-2 text-slate-700 shadow-lg ring-1 ring-slate-300 backdrop-blur">
          <button
            type="button"
            disabled={busy || !studentName || studentHere}
            onClick={showStudent}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
              studentHere
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-900 text-white hover:bg-slate-700",
              (!studentName || busy) && "cursor-not-allowed opacity-50",
            )}
          >
            <IconUser className="h-4 w-4" />
            {studentName
              ? studentHere
                ? fmt(t.classRoom.studentHere, { name: studentName })
                : fmt(t.classRoom.sendStudent, { name: studentName })
              : t.classRoom.boardNoStudent}
          </button>

          <button
            type="button"
            disabled={busy || !studentName || !selected}
            onClick={flashStudent}
            title={selected?.label ?? t.classRoom.boardPickObject}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconStar className="h-4 w-4" />
            {t.classRoom.boardHighlightObject}
          </button>

          <button
            type="button"
            disabled={busy || !studentName || !selected}
            onClick={focusStudent}
            title={selected?.label ?? t.classRoom.boardPickObject}
            className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconEye className="h-4 w-4" />
            {t.classRoom.boardFocusObject}
          </button>

          <span className="px-1 text-[11px] font-semibold text-slate-500">
            {saveState === "saving"
              ? t.classRoom.boardSaving
              : saveState === "saved"
                ? t.classRoom.boardSaved
                : ""}
          </span>
          {error && <span className="max-w-72 text-xs font-semibold text-rose-600">{error}</span>}
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        title={t.common.close}
        aria-label={t.common.close}
        className="absolute right-3 top-3 flex h-10 items-center gap-1.5 rounded-xl bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg ring-1 ring-slate-300 transition hover:text-rose-600"
      >
        <IconX className="h-4 w-4" />
        {t.classRoom.board}
      </button>
    </div>
  );
}
