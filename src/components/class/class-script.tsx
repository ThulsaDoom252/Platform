"use client";

/**
 * Скрипт урока внутри класса.
 *
 * Берётся тот, что написан к сегодняшнему занятию этого ученика: в
 * классе известен ученик, а урок подбирается сам. Открывается на всём
 * рабочем месте — подготовку читают целиком, а не вполглаза, — и
 * закрывается той же кнопкой снизу или крестиком здесь.
 *
 * Ученик этого не видит: панель показывается только учителю.
 */
import { useEffect, useState } from "react";
import { getClassScriptAction, type ScriptDoc } from "@/lib/actions/script";
import { ScriptEditor } from "@/components/script/script-editor";
import { IconX } from "@/components/icons";
import { useT } from "@/components/i18n-provider";
import { SCHEDULE_FORMAT_TIME_ZONE } from "@/lib/schedule-time";

export function ClassScript({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  // Дата занятия — на языке учителя: «1 окт., 09:00» или «1 Oct, 09:00».
  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SCHEDULE_FORMAT_TIME_ZONE,
  });
  const [doc, setDoc] = useState<(ScriptDoc & { lessonAt: string }) | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getClassScriptAction(studentId)
      .then((next) => {
        if (!alive) return;
        setDoc(next);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [studentId]);

  return (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-content">{t.classRoom.scriptTitle}</span>
        {doc && (
          <span className="text-[12px] text-faint">{when.format(new Date(doc.lessonAt))}</span>
        )}
        <span className="text-[11px] text-faint">{t.classRoom.onlyYou}</span>
        <button
          type="button"
          onClick={onClose}
          title={t.classRoom.scriptBackHint}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] font-semibold text-muted transition hover:border-accent hover:text-accent"
        >
          <IconX className="h-3.5 w-3.5" /> {t.classRoom.scriptBack}
        </button>
      </div>

      {!loaded && <p className="text-sm text-faint">{t.classRoom.scriptOpening}</p>}

      {loaded && !doc && (
        <p className="text-sm text-faint">{t.classRoom.scriptNoLesson}</p>
      )}

      {loaded && doc && <ScriptEditor key={doc.lessonId} doc={doc} compact />}
    </section>
  );
}
