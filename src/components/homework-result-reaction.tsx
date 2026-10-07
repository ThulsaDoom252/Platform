import { HOMEWORK_RESULT_REACTIONS, type HomeworkResultReaction } from "@/lib/homework-feedback";

/** Deliberately no percentages: those remain in the attempt statistics. */
export function HomeworkResultReactionBadge({ reaction, compact = false }: {
  reaction: HomeworkResultReaction | null | undefined; compact?: boolean;
}) {
  const item = HOMEWORK_RESULT_REACTIONS.find((entry) => entry.id === reaction);
  if (!item) return null;
  return (
    <div key={item.id} className={`homework-result-reaction${compact ? " homework-result-reaction-compact" : ""}`}
      data-result-reaction={item.id} data-tone={item.tone} data-strength={item.strength} role="status">
      <span className="homework-result-emoji" aria-hidden>{item.emoji}</span>
      <p className="homework-result-caption">{item.caption}</p>
    </div>
  );
}
