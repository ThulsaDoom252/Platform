"use client";

import { useId, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { IconChevronDown, IconX } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { RevisionStrugglingWord } from "@/lib/revision-struggling";

/** Small by default; opening it never remounts the game or restarts its timers. */
export function RevisionStrugglingPanel({ words, selected, onToggle, saving = false }: {
  words: RevisionStrugglingWord[];
  selected: string[];
  onToggle: (phraseId: string) => void;
  saving?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const regionId = useId();
  const chosen = new Set(selected);
  const marked = words.filter((word) => chosen.has(word.phraseId));
  const matches = words.filter((word) => word.word.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="rounded-2xl bg-surface ring-1 ring-line">
    <button type="button" onClick={() => setOpen((prev) => !prev)} aria-expanded={open} aria-controls={regionId}
      title={t.revision.strugglingAdd}
      className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-xs font-bold text-content transition hover:bg-accent-soft">
      <span aria-hidden>🔖</span><span className="min-w-0 flex-1">{t.revision.strugglingWith}</span>
      <span role="status" aria-live="polite" title={saving ? t.revision.strugglingSaving : t.revision.strugglingSaved}
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-accent", saving ? "animate-pulse" : "opacity-0")}>
        <span className="sr-only">{saving ? t.revision.strugglingSaving : ""}</span>
      </span>
      <span className="rounded-full bg-accent-soft px-2 py-0.5 font-black tabular-nums text-accent">{marked.length}</span>
      <IconChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
    </button>
    {open && <div id={regionId} className="border-t border-line p-3">
      <p className="mb-2 text-[11px] text-muted">{t.revision.strugglingHint}</p>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder={t.revision.strugglingSearch} aria-label={t.revision.strugglingSearch}
        className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-content outline-none focus:border-accent" />
      <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto overscroll-contain sm:grid-cols-2">
        {matches.map((word) => <label key={word.phraseId}
          className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition", chosen.has(word.phraseId) ? "bg-accent-soft text-accent" : "text-content hover:bg-surface-2")}>
          <input type="checkbox" checked={chosen.has(word.phraseId)} onChange={() => onToggle(word.phraseId)}
            className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
          <span className="min-w-0 break-words font-semibold">{word.word}</span>
        </label>)}
      </div>
    </div>}
    {!open && marked.length > 0 && <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto px-3 pb-2">
      {marked.map((word) => <button key={word.phraseId} type="button" onClick={() => onToggle(word.phraseId)}
        title={t.revision.strugglingUnmark} aria-label={`${t.revision.strugglingUnmark}: ${word.word}`}
        className="flex max-w-full items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent transition hover:ring-1 hover:ring-accent">
        <span className="truncate">{word.word}</span><IconX className="h-3 w-3 shrink-0" />
      </button>)}
    </div>}
  </section>;
}

/** Reused under each attempt, so later lists never replace earlier ones. */
export function RevisionStrugglingSummary({ words }: { words: RevisionStrugglingWord[] }) {
  const { t } = useT();
  return <section className="mt-3 rounded-xl bg-accent-soft p-3 text-left ring-1 ring-accent/20">
    <h3 className="text-xs font-black text-accent">🔖 {t.revision.strugglingWith} · {words.length}</h3>
    {words.length ? <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
      {words.map((word) => <span key={word.phraseId}
        className="max-w-full break-words rounded-lg bg-surface px-2.5 py-1.5 text-xs font-bold text-content ring-1 ring-line">{word.word}</span>)}
    </div> : <p className="mt-1 text-[11px] text-muted">{t.revision.strugglingEmpty}</p>}
  </section>;
}
