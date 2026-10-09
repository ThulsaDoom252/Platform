"use client";

import { FileText, Video } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import type { HomeworkMediaSelection } from "@/lib/homework-media";
import { cn } from "@/lib/utils";

export function HomeworkMediaOptions({ available, value, onChange, disabled = false }: {
  available: HomeworkMediaSelection;
  value: HomeworkMediaSelection;
  onChange: (value: HomeworkMediaSelection) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  if (!available.video && !available.transcript) return null;
  return (
    <fieldset disabled={disabled} className="mt-4 rounded-2xl border border-line bg-canvas p-3.5">
      <legend className="px-1 text-xs font-black text-content">{t.interactiveHomework.mediaTitle}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["video", "transcript"] as const).filter((kind) => available[kind]).map((kind) => {
          const Icon = kind === "video" ? Video : FileText;
          return (
            <label key={kind} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm font-bold transition", value[kind] ? "border-accent/35 bg-accent-soft text-content" : "border-line bg-surface text-muted", disabled && "cursor-wait opacity-60")}>
              <input type="checkbox" checked={value[kind]} onChange={(event) => onChange({ ...value, [kind]: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
              <Icon className="h-4 w-4 text-accent" />
              {kind === "video" ? t.lessonUnits.secVideo : t.lessonUnits.secTranscript}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{t.interactiveHomework.mediaAssignmentHint}</p>
    </fieldset>
  );
}
