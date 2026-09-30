"use client";

/**
 * Чат урока.
 *
 * Переписка привязана к ученику и живёт между уроками. Новые сообщения
 * приходят опросом раз в несколько секунд: постоянного соединения в
 * проекте нет, а для разговора двоих этого хватает.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import {
  listMessagesAction,
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
  archiveMessageAction,
  type ClassMessage,
} from "@/lib/actions/class";
import { IconX, IconPencil, IconTrash, IconMessage } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

const POLL_MS = 4000;

export function ClassChat({
  studentId,
  title,
  canArchive,
  onUnread,
  compact = false,
}: {
  /** Чей разговор. Пусто — учитель ещё не выбрал класс. */
  studentId: string | null;
  title: string;
  canArchive: boolean;
  /** Сколько чужих сообщений пришло, пока панель свёрнута. */
  onUnread?: (n: number) => void;
  /** Заголовок уже показан общей оболочкой плавающей панели. */
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [withArchived, setWithArchived] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, startBusy] = useTransition();
  const feed = useRef<HTMLDivElement>(null);
  const seen = useRef(0);

  useEffect(() => {
    // Чужую переписку чистить незачем: при смене ученика родитель
    // пересоздаёт компонент, и состояние уходит вместе с ним.
    if (!studentId) return;
    let alive = true;

    const load = async () => {
      try {
        const list = await listMessagesAction(studentId, withArchived);
        if (!alive) return;
        setMessages(list);

        // Считаем только чужие: свои сообщения уведомлением быть не могут.
        const theirs = list.filter((m) => !m.mine).length;
        if (theirs > seen.current) onUnread?.(theirs - seen.current);
        seen.current = theirs;
      } catch {
        /* сеть моргнула — следующий опрос подхватит */
      }
    };

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [studentId, withArchived, onUnread]);

  // Лента всегда показывает последнее сообщение.
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body || !studentId) return;
    setText("");
    startBusy(async () => {
      await sendMessageAction(body, studentId);
      setMessages(await listMessagesAction(studentId, withArchived));
    });
  }

  function apply(what: () => Promise<unknown>) {
    startBusy(async () => {
      await what();
      if (studentId) setMessages(await listMessagesAction(studentId, withArchived));
    });
  }

  if (!studentId) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 px-4 py-10 text-center">
        <IconMessage className="h-6 w-6 text-faint" />
        <p className="text-sm text-muted">{t.classRoom.pickStudentChat}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(!compact || canArchive) && (
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {!compact && (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-content">{title}</span>
        )}
        {compact && <span className="flex-1" />}
        {canArchive && (
          <button
            type="button"
            onClick={() => setWithArchived((v) => !v)}
            className={cn(
              "h-7 rounded-lg px-2 text-[11px] font-semibold transition",
              withArchived ? "bg-accent text-white" : "text-faint hover:text-content",
            )}
            title={t.classRoom.archiveHint}
          >
            {t.classRoom.archive}
          </button>
        )}
      </div>
      )}

      <div ref={feed} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-faint">{t.common.empty}</p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("group flex flex-col", m.mine ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                m.mine ? "bg-accent text-white" : "bg-surface-2 text-content",
                m.archived && "opacity-50",
              )}
            >
              {editing?.id === m.id ? (
                <input
                  value={editing.text}
                  autoFocus
                  onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null);
                    if (e.key === "Enter") {
                      apply(() => editMessageAction(m.id, editing.text));
                      setEditing(null);
                    }
                  }}
                  className="w-full bg-transparent outline-none"
                />
              ) : (
                <span className="whitespace-pre-wrap break-words">{m.text}</span>
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-faint">
              <span>
                {new Date(m.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {m.editedAt && <span>· {t.classRoom.edited}</span>}
              {m.archived && <span>· {t.classRoom.archived}</span>}

              <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                {m.mine && (
                  <button
                    type="button"
                    onClick={() => setEditing({ id: m.id, text: m.text })}
                    title={t.classRoom.edit}
                    className="hover:text-content"
                  >
                    <IconPencil className="h-3 w-3" />
                  </button>
                )}
                {canArchive && (
                  <button
                    type="button"
                    onClick={() => apply(() => archiveMessageAction(m.id, !m.archived))}
                    title={m.archived ? t.classRoom.unarchive : t.classRoom.toArchive}
                    className="hover:text-content"
                  >
                    {m.archived ? "↩" : "▾"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => apply(() => deleteMessageAction(m.id))}
                  title={t.common.delete}
                  className="hover:text-rose-500"
                >
                  <IconTrash className="h-3 w-3" />
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-line p-2">
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            title={t.classRoom.cancelEdit}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:text-content"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.classRoom.messagePlaceholder}
          className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-content outline-none transition placeholder:text-faint focus:border-accent"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !text.trim()}
          title={t.classRoom.send}
          aria-label={t.classRoom.send}
          className="h-9 shrink-0 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
