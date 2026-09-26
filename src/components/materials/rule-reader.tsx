"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSpeech, SpeakPair } from "./speech";
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

/**
 * Ячейка, которую есть смысл озвучить: одно английское слово.
 *
 * Транскрипции вроде «work/t/» и звуки «/ɪd/» отсеиваются по косой черте,
 * перечисления и пояснения — по пробелам и кириллице. В таблице про -ed
 * кнопки появляются ровно у слов, а не у каждой клетки.
 */
function speakableWord(cell: string): string | null {
  const word = cell.trim();
  if (word.length < 2 || word.length > 40) return null;
  return /^[A-Za-z][A-Za-z'’-]*$/.test(word) ? word : null;
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
  const s = useSpeech();
  const isStudySheet = blocks.some((block) => isSheetVariant(block.variant));

  // Подсказки — это то, что стоит знать, но не обязательно читать сразу.
  // Учитель прячет их, когда объясняет основное, и возвращает для разбора.
  const [hints, setHints] = useState(true);
  const hasHints = blocks.some(
    (block) =>
      (block.type === "callout" && block.hint) ||
      (block.type === "word" && block.notes.length > 0) ||
      (block.type === "marker" && !!block.hintText),
  );

  // Оглавление имеет смысл, когда разделов больше двух: иначе это просто
  // повтор того, что и так видно на экране.
  const sections = blocks
    .map((block, i) => ({ block, i }))
    .filter(({ block }) => block.type === "heading")
    .map(({ block, i }) => ({ id: `rule-section-${i}`, text: "text" in block ? block.text : "" }));

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

      {(sections.length > 2 || hasHints) && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-1.5 rounded-2xl bg-surface/95 p-2 ring-1 ring-line backdrop-blur-md">
          {sections.length > 2 &&
            sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-muted transition hover:text-accent"
              >
                {section.text}
              </a>
            ))}

          {hasHints && (
            <button
              type="button"
              onClick={() => setHints((v) => !v)}
              title="Дополнительная информация под материалом"
              className={cn(
                "ml-auto rounded-lg px-2.5 py-1 text-[12px] font-semibold transition",
                hints ? "tint-amber" : "bg-surface-2 text-faint hover:text-content",
              )}
            >
              💡 подсказки
            </button>
          )}
        </div>
      )}

      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            if (b.variant === "sheet-section") {
              const section = sectionParts(b.text);
              return (
                <div key={i} id={`rule-section-${i}`} className="rule-sheet-section scroll-mt-20">
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
                id={`rule-section-${i}`}
                className="mt-2 flex scroll-mt-20 items-center gap-2 text-base font-bold text-content"
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

            if (b.hint && !hints) return null;
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
                  <SpeakPair text={b.en} id={key} speech={s} />
                </p>
                {b.tr && <p className="mt-0.5 text-[13px] italic text-muted">{b.tr}</p>}
                {b.why && (
                  <p className="mt-1.5 border-l-2 border-accent pl-2.5 text-[13px] text-muted">
                    {b.why}
                  </p>
                )}
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
                          {row.map((cell, ci) => {
                            const word = speakableWord(cell);
                            return (
                              <td key={ci}>
                                {cell}
                                {word && (
                                  <SpeakPair
                                    text={word}
                                    id={`t${i}-${ri}-${ci}`}
                                    speech={s}
                                  />
                                )}
                              </td>
                            );
                          })}
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
                        {row.map((cell, ci) => {
                          const word = speakableWord(cell);
                          return (
                            <td
                              key={ci}
                              className={cn(
                                "px-3.5 py-2.5 align-top",
                                ci === 0 ? "font-semibold text-content" : "text-muted",
                              )}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {cell}
                                {word && (
                                  <SpeakPair
                                    text={word}
                                    id={`t${i}-${ri}-${ci}`}
                                    speech={s}
                                  />
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case "word":
            return (
              <article
                key={i}
                className="rounded-2xl bg-surface p-4 ring-1 ring-line"
              >
                <header className="flex flex-wrap items-baseline gap-2">
                  {b.icon && <span className="text-xl">{b.icon}</span>}
                  <h4 className="text-base font-bold text-content">{b.word}</h4>
                  {b.tr && <span className="text-sm text-muted">{b.tr}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    <SpeakPair text={b.word} id={`w-${i}`} speech={s} />
                  </span>
                </header>

                {(b.us || b.uk) && (
                  <p className="mt-1 flex flex-wrap gap-3 font-mono text-[12px] text-faint">
                    {b.us && <span>us {b.us}</span>}
                    {b.uk && <span>uk {b.uk}</span>}
                  </p>
                )}

                {b.sense && (
                  <p className="mt-2 text-sm leading-snug text-content">{b.sense}</p>
                )}

                {b.pattern && (
                  <p className="mt-2 inline-block rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-[13px] font-semibold text-accent">
                    {b.pattern}
                  </p>
                )}

                <div className="mt-2 flex flex-col gap-1.5">
                  {b.examples.map((ex, j) => (
                    <div key={j} className="rounded-xl bg-surface-2 px-3 py-2">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-content">
                        {ex.en}
                        <SpeakPair text={ex.en} id={`w-${i}-${j}`} speech={s} />
                      </p>
                      <p className="mt-0.5 text-[13px] italic text-muted">{ex.tr}</p>
                    </div>
                  ))}
                </div>

                {hints &&
                  b.notes.map((note, j) => (
                    <p key={j} className="mt-2 rounded-xl tint-amber px-3 py-2 text-[13px]">
                      {note}
                    </p>
                  ))}
              </article>
            );

          case "form":
            return (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base font-bold",
                    b.sign === "+" && "tint-green",
                    b.sign === "-" && "tint-rose",
                    b.sign === "?" && "tint-sky",
                  )}
                >
                  {b.sign}
                </span>
                <span className="font-mono text-[13px] font-semibold text-accent">
                  {b.formula}
                </span>
                <span className="flex w-full flex-wrap items-center gap-2 text-sm text-content sm:w-auto">
                  {b.en}
                  <SpeakPair text={b.en} id={`f-${i}`} speech={s} />
                  <span className="text-[13px] italic text-muted">{b.tr}</span>
                </span>
              </div>
            );

          case "marker":
            return (
              <div key={i} className="rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-line">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-lg bg-accent px-2 py-0.5 text-[13px] font-bold text-white">
                    {b.word}
                  </span>
                  <span className="text-[13px] text-muted">{b.tr}</span>
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-content">
                  {b.en}
                  <SpeakPair text={b.en} id={`m-${i}`} speech={s} />
                </p>
                <p className="text-[13px] italic text-muted">{b.ru}</p>
                {hints && b.hintText && (
                  <p className="mt-1.5 rounded-lg tint-amber px-2.5 py-1.5 text-[12px]">
                    {b.hintText}
                  </p>
                )}
              </div>
            );

          default:
            return (
              <p
                key={i}
                className={cn(
                  "text-sm leading-relaxed text-muted",
                  b.variant === "sheet-text" && "rule-sheet-copy",
                )}
              >
                {"text" in b ? b.text : ""}
              </p>
            );
        }
      })}
    </div>
  );
}
