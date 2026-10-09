import type { ReactNode } from "react";
import { FileText, Video } from "lucide-react";
import type { HomeworkMediaSelection, HomeworkMediaSource } from "@/lib/homework-media";
import { richLineWords } from "@/lib/lesson-unit";
import { cn } from "@/lib/utils";

/** Presentation only: no class session, teacher actions or video state. */
export function HomeworkMediaView({ source, attached, labels, video }: {
  source: HomeworkMediaSource;
  attached: HomeworkMediaSelection;
  labels: { video: string; transcript: string; playbackHint: string };
  video: ReactNode;
}) {
  if (!attached.video && !attached.transcript) return null;
  return (
    <div data-homework-materials data-no-lesson-highlight className={cn("grid min-w-0 items-start gap-4", attached.video && attached.transcript && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]")}>
      {attached.video && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <header className="flex items-center gap-2.5 px-4 py-3">
            <Video className="h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="text-sm font-black text-content">{labels.video}</h3>
              <p className="mt-0.5 text-xs text-muted">{labels.playbackHint}</p>
            </div>
          </header>
          {video}
        </section>
      )}
      {attached.transcript && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <h3 className="flex items-center gap-2.5 border-b border-line px-4 py-3 text-sm font-black text-content"><FileText className="h-5 w-5 text-accent" />{labels.transcript}</h3>
          <div tabIndex={0} aria-label={labels.transcript} className="max-h-[34rem] space-y-3 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
            {source.transcript.map((line, index) => (
              <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-content">
                {line.speaker && <span className="mr-2 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-black text-accent">{line.speaker}</span>}
                {richLineWords(line.text).map((part, at) => part.bold ? <strong key={at}>{part.text}</strong> : part.text)}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
