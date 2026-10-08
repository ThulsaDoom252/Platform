/** Public feedback is rendered as text, never as teacher-supplied HTML. */
export function PublicHomeworkTeacherNote({ label, note }: { label: string; note?: string }) {
  if (!note) return null;
  return <div data-teacher-feedback-note className="mt-3 rounded-2xl border border-accent/25 bg-accent-soft p-4 text-content">
    <p className="text-xs font-black text-accent">{label}</p>
    <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed">{note}</p>
  </div>;
}
