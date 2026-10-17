export type ClassNoteKind = "NOTE" | "SPELLING";
export type ClassNoteSubmission = { id: string; text: string; kind: ClassNoteKind };

/** Snapshot each Enter immediately, then save in order without blocking typing. */
export function createClassNoteQueue(
  save: (entry: ClassNoteSubmission) => Promise<{ error?: string }>,
  notify: (entry: ClassNoteSubmission, state: "pending" | "saved" | "failed", error?: string) => void,
) {
  let tail = Promise.resolve();
  const active = new Set<string>();
  return {
    enqueue(entry: ClassNoteSubmission) {
      if (active.has(entry.id)) return tail;
      active.add(entry.id);
      notify(entry, "pending");
      tail = tail.then(async () => {
        try {
          const result = await save(entry);
          notify(entry, result.error ? "failed" : "saved", result.error);
        } catch {
          notify(entry, "failed");
        } finally { active.delete(entry.id); }
      });
      return tail;
    },
  };
}

/** Notes may reclaim a pointer click on the lesson, never another editor or dialog. */
export function canRestoreClassNoteFocus(doc: Document, input: HTMLInputElement): boolean {
  if (doc.visibilityState === "hidden" || !input.isConnected) return false;
  if (doc.querySelector('[role="dialog"], [aria-modal="true"], [data-class-note-dialog]')) return false;
  const active = doc.activeElement;
  if (active === input) return false;
  if (active?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), iframe, [role="textbox"], [aria-expanded="true"], [aria-haspopup]')) return false;
  if (doc.getSelection()?.toString().trim()) return false;
  return true;
}
