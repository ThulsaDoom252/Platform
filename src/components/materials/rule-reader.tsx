"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { speakableText } from "./phrase-reader";
import { IconVolume } from "@/components/icons";
import type { RuleBlock } from "@/lib/rule-parser";

const TONE: Record<string, string> = {
  key: "tint-accent",
  warn: "tint-rose",
  tip: "tint-amber",
  info: "tint-sky",
};

const isSheetVariant = (variant?: string) => variant?.startsWith("sheet-") ?? false;

function sectionParts(text: string): { number: string | null; title: string } {
  const match = text.match(/^\s*(\d{1,2})[.)]?\s*(.+)$/);
  return match ? { number: match[1], title: match[2] } : { number: null, title: text };
}

function formulaParts(text: string): { formula: string; meaning: string } {
  const at = text.indexOf("=");
  return at < 0
    ? { formula: text, meaning: "" }
    : { formula: text.slice(0, at).trim(), meaning: text.slice(at + 1).trim() };
}

function mistakeParts(text: string): { wrong: string; right: string | null } {
  const at = text.search(/[✓✔✅]/u);
  return at < 0
    ? { wrong: text.replace(/^[✗✘❌]\s*/u, ""), right: null }
    : {
        wrong: text.slice(0, at).replace(/^[✗✘❌]\s*/u, "").trim(),
        right: text.slice(at).replace(/^[✓✔✅]\s*/u, "").trim(),
      };
}

function useSpeak() {
  const [active, setActive] = useState<string | null>(null);

  function speak(key: string, text: string) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const spoken = speakableText(text);
    if (!spoken) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spoken);
    u.lang = "en-US";
    const voices = synth.getVoices();
    const v =
      voices.find((x) => x.lang.replace("_", "-") === "en-US") ??
      voices.find((x) => x.lang.toLowerCase().startsWith("en"));
    if (v) u.voice = v;
    u.rate = 0.95;
    u.onend = () => setActive(null);
    u.onerror = () => setActive(null);
    setActive(key);
    synth.speak(u);
  }

  return { speak, active, supported: typeof window !== "undefined" && !!window.speechSynthesis };
}

/** Страница-правило: заголовки, врезки, формулы, таблицы и примеры. */
export function RuleReader({
  title,
  icon,
  description,
  blocks,
}: {
  title: string;
  icon: string | null;
  description: string | null;
  blocks: RuleBlock[];
}) {
  const s = useSpeak();
  const isStudySheet = blocks.some((block) => isSheetVariant(block.variant));

  return (
    <div className={cn("flex flex-col gap-4", isStudySheet && "rule-sheet")}>
      {/* Шапка правила */}
      <header
        className={cn(
          "relative overflow-hidden rounded-2xl p-5 text-white shadow-md sm:p-6",
          isStudySheet ? "rule-sheet-hero" : "grad-accent",
        )}
      >
        <div className="relative z-10 flex items-center gap-3">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur",
              isStudySheet && "rule-sheet-hero-icon",
            )}
          >
            {icon ?? "📘"}
          </span>
          <div className="min-w-0">
            {isStudySheet && (
              <p className="rule-sheet-eyebrow">Grammar · Visual guide</p>
            )}
            <h2
              className={cn(
                "text-xl font-bold leading-tight sm:text-2xl",
                isStudySheet && "rule-sheet-title",
              )}
            >
              {title}
            </h2>
            {description && (
              <p className={cn("mt-0.5 text-sm text-white/80", isStudySheet && "rule-sheet-subtitle")}>
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -bottom-10 h-36 w-36 rounded-full bg-white/10" />
      </header>

      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            if (b.variant === "sheet-section") {
              const section = sectionParts(b.text);
              return (
                <div key={i} className="rule-sheet-section">
                  {section.number && (
                    <span className="rule-sheet-section-number">{section.number}</span>
                  )}
                  <h3>{section.title}</h3>
                </div>
              );
            }
            return (
              <h3
                key={i}
                className="mt-2 flex items-center gap-2 text-base font-bold text-content"
              >
                <span className="h-5 w-1 rounded-full bg-accent" />
                {b.text}
              </h3>
            );
          }

          case "callout": {
            if (b.variant === "sheet-lead") {
              return (
                <div key={i} className="rule-sheet-lead">
                  <span className="rule-sheet-kicker">{b.label ?? "Головна ідея"}</span>
                  <p>{b.text}</p>
                </div>
              );
            }

            if (b.variant === "sheet-mistake") {
              const parts = mistakeParts(b.text);
              return (
                <div key={i} className="rule-sheet-mistake">
                  <div className="rule-sheet-mistake-wrong">
                    <span aria-hidden="true">×</span>
                    <p>{parts.wrong}</p>
                  </div>
                  {parts.right && (
                    <div className="rule-sheet-mistake-right">
                      <span aria-hidden="true">✓</span>
                      <p>{parts.right}</p>
                    </div>
                  )}
                </div>
              );
            }

            if (b.variant === "sheet-answers") {
              return (
                <div key={i} className="rule-sheet-answers">
                  <span>{b.label ?? "Відповіді"}</span>
                  <p>{b.text}</p>
                </div>
              );
            }

            return (
              <div
                key={i}
                className={cn("rounded-2xl px-4 py-3.5 text-sm", TONE[b.tone ?? "info"])}
              >
                {b.label && <span className="font-bold">{b.label}: </span>}
                <span className="leading-snug">{b.text}</span>
              </div>
            );
          }

          case "formula": {
            if (b.variant === "sheet-formula") {
              const parts = formulaParts(b.text);
              return (
                <div key={i} className="rule-sheet-formula">
                  <strong>{parts.formula}</strong>
                  {parts.meaning && <span aria-hidden="true">→</span>}
                  {parts.meaning && <p>{parts.meaning}</p>}
                </div>
              );
            }
            return (
              <div
                key={i}
                className="rounded-2xl border-2 border-dashed border-accent bg-accent-soft px-4 py-3.5 text-center"
              >
                <p className="text-base font-bold tracking-wide text-accent">{b.text}</p>
              </div>
            );
          }

          case "example": {
            const key = `ex-${i}`;
            return (
              <div key={i} className="rounded-xl bg-surface-2 px-4 py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-content">
                  {b.en}
                  {s.supported && (
                    <button
                      type="button"
                      onClick={() => s.speak(key, b.en)}
                      aria-label="Произнести"
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition",
                        s.active === key
                          ? "bg-accent text-white"
                          : "text-faint hover:bg-accent-soft hover:text-accent",
                      )}
                    >
                      <IconVolume className="h-3.5 w-3.5" />
                    </button>
                  )}
                </p>
                {b.tr && <p className="mt-0.5 text-[13px] italic text-muted">{b.tr}</p>}
              </div>
            );
          }

          case "list":
            if (b.variant === "sheet-quiz") {
              return (
                <ol key={i} className="rule-sheet-quiz">
                  {b.items.map((item, j) => (
                    <li key={j}>
                      <span>{j + 1}</span>
                      <p>{item}</p>
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={i} className="flex flex-col gap-1.5 pl-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-sm text-content">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );

          case "table": {
            if (b.variant === "sheet-formula-grid") {
              const rows = b.headers.length ? [b.headers, ...b.rows] : b.rows;
              return (
                <div key={i} className="rule-sheet-formula-grid">
                  {rows.flat().filter(Boolean).map((cell, j) => {
                    const parts = formulaParts(cell);
                    return (
                      <div key={j}>
                        <strong>{parts.formula}</strong>
                        {parts.meaning && <p>{parts.meaning}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (b.variant === "sheet-table") {
              return (
                <div key={i} className="rule-sheet-table-wrap">
                  <table className="rule-sheet-table">
                    {b.headers.length > 0 && (
                      <thead>
                        <tr>
                          {b.headers.map((header, j) => <th key={j}>{header}</th>)}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {b.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            return (
              <div
                key={i}
                className="overflow-x-auto rounded-2xl ring-1 ring-line"
              >
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  {b.headers.length > 0 && (
                    <thead>
                      <tr className="bg-accent text-white">
                        {b.headers.map((h, j) => (
                          <th
                            key={j}
                            className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={cn(
                          "border-t border-line",
                          ri % 2 ? "bg-surface-2" : "bg-surface",
                        )}
                      >
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={cn(
                              "px-3.5 py-2.5 align-top",
                              ci === 0 ? "font-semibold text-content" : "text-muted",
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          default:
            return (
              <p
                key={i}
                className={cn(
                  "text-sm leading-relaxed text-muted",
                  b.variant === "sheet-text" && "rule-sheet-copy",
                )}
              >
                {(b as { text: string }).text}
              </p>
            );
        }
      })}
    </div>
  );
}
