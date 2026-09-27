/**
 * Обратный разбор: страница платформы → обычный текст и docx.
 *
 * Сам материал при этом не меняется — здесь только чтение. Текст строится
 * так, чтобы его можно было вставить обратно в парсер и получить то же
 * самое: разделы заголовками, записи через тире, примеры маркерами.
 */
import type { RuleBlock } from "./rule-parser";

export type ExportPhrase = {
  icon: string | null;
  section: string | null;
  kind: string;
  phrase: string;
  transcription: string | null;
  /** Американское и британское произношение, если они различаются. */
  transcriptionUs?: string | null;
  transcriptionUk?: string | null;
  translation: string | null;
  /** Жёлтая подсказка «что стоит знать» под словом. */
  note?: string | null;
  examples: { en: string; tr: string }[];
};

export type ExportPage = {
  title: string;
  description: string | null;
  phrases: ExportPhrase[];
  blocks: RuleBlock[];
  /** Язык перевода страницы — от него зависит ссылка на Reverso. */
  lang?: "UK" | "RU";
  /** Текст, из которого страницу разобрали. */
  sourceText?: string | null;
};

/** Цвета выгрузки. Те же роли, что на странице: шапка, раздел, перевод. */
const DOCX = {
  title: "1F3864",
  section: "1A7A8C",
  word: "1B2733",
  translation: "17843F",
  faint: "6B7A8C",
  example: "2B3A4A",
  noteFill: "FFF3D6",
  noteText: "7A5A10",
  white: "FFFFFF",
} as const;

/** Ссылка на Reverso: по ней слово открывается в живых примерах. */
function reversoUrl(word: string, lang: "UK" | "RU"): string {
  const pair = lang === "RU" ? "english-russian" : "english-ukrainian";
  return `https://context.reverso.net/translation/${pair}/${encodeURIComponent(word.trim())}`;
}

/** Произношение одной строкой: два варианта показываем, только если разные. */
function transcriptionOf(p: ExportPhrase): string {
  const us = p.transcriptionUs?.trim();
  const uk = p.transcriptionUk?.trim();
  if (us && uk && us !== uk) return `us ${us} uk ${uk}`;
  return (us || uk || p.transcription || "").trim();
}

/** Словник в текст: «слово /транскрипция/ — перевод» и примеры маркерами. */
function phrasesToText(phrases: ExportPhrase[]): string[] {
  const out: string[] = [];
  let section: string | null = null;

  for (const p of phrases) {
    if ((p.section ?? null) !== section) {
      section = p.section ?? null;
      if (section) {
        out.push("", section);
      }
    }

    if (p.kind === "NOTE") {
      out.push(`💡 ${p.phrase}${p.translation ? ` — ${p.translation}` : ""}`);
      continue;
    }

    const head = [p.phrase, transcriptionOf(p)].filter(Boolean).join(" ");
    out.push(`${head}${p.translation ? ` — ${p.translation}` : ""}`);
    for (const ex of p.examples) {
      out.push(`• ${ex.en}${ex.tr ? ` — ${ex.tr}` : ""}`);
    }
    if (p.note) out.push(`💡 ${p.note}`);
  }
  return out;
}

/** Правило в текст: таблицы колонками через табуляцию, как их читает парсер. */
function blocksToText(blocks: RuleBlock[]): string[] {
  const out: string[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push("", b.text);
        break;
      case "callout":
        out.push(b.label ? `${b.label}: ${b.text}` : b.text);
        break;
      case "formula":
      case "text":
        out.push(b.text);
        break;
      case "example":
        out.push(`• ${b.en}${b.tr ? ` — ${b.tr}` : ""}`);
        break;
      case "list":
        for (const item of b.items) out.push(`• ${item}`);
        break;
      case "table":
        if (b.headers.length) out.push(b.headers.join("\t"));
        for (const row of b.rows) out.push(row.join("\t"));
        out.push("");
        break;
    }
  }
  return out;
}

/** Готовый текст страницы — его же показываем в окне и кладём в буфер. */
export function pageToText(page: ExportPage): string {
  const lines = [page.title];
  if (page.description) lines.push(page.description);
  lines.push("");

  lines.push(
    ...(page.blocks.length > 0 ? blocksToText(page.blocks) : phrasesToText(page.phrases)),
  );

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Текст для окна выгрузки.
 *
 * Если исходник сохранён — отдаём именно его: это то, из чего страница
 * собрана, и то, что можно вставить обратно или отдать на правку.
 * Собранный заново текст нужен только там, где исходника нет: у старых
 * страниц и у тех, что правили руками.
 */
export function pageSourceOrText(page: ExportPage): string {
  return page.sourceText?.trim() || pageToText(page);
}

/** Одна страница внутри отчёта, вместе с путём до неё. */
export type ReportEntry = { path: string[]; page: ExportPage };

export type Report = {
  studentName: string;
  /** Строки шапки: уровень, сколько уроков, с какого времени занимаемся. */
  meta: string[];
  entries: ReportEntry[];
};

/**
 * Весь пройденный материал одним текстом.
 * Шапка нужна не только человеку: по ней модель понимает, с кем работает,
 * а путь до страницы показывает, к какой теме относится блок.
 */
export function reportToText(report: Report): string {
  const lines = [
    `Ученик: ${report.studentName}`,
    ...report.meta,
    `Разделов и страниц: ${report.entries.length}`,
    "",
    "=".repeat(48),
  ];

  for (const { path, page } of report.entries) {
    lines.push("", path.join(" / "), "-".repeat(40), pageToText(page), "");
  }

  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

/** Имя файла без символов, которые не любит файловая система. */
export function safeFileName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${clean || "material"}.docx`;
}

/**
 * Сборка .docx. Библиотека тяжёлая, поэтому подгружается только в момент
 * выгрузки — на остальных страницах она в бандл не попадает.
 */
async function pageToDocxChildren(
  page: ExportPage,
  titleLevel: "h1" | "h2" | "none" = "h1",
) {
  const {
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ExternalHyperlink,
    AlignmentType,
  } = await import("docx");

  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: Block[] = [];

  const vocabulary = page.blocks.length === 0 && page.phrases.length > 0;

  if (titleLevel !== "none") {
    children.push(
      vocabulary
        ? // Словник открывается плашкой: в распечатке она отделяет один
          // материал от другого лучше любого заголовка.
          new Paragraph({
            shading: { fill: DOCX.title },
            spacing: { before: 120, after: 0 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: page.title.toUpperCase(),
                bold: true,
                size: 34,
                color: DOCX.white,
              }),
            ],
          })
        : new Paragraph({
            text: page.title,
            heading: titleLevel === "h1" ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          }),
    );
  }

  if (page.description) {
    children.push(
      vocabulary
        ? new Paragraph({
            shading: { fill: DOCX.title },
            spacing: { before: 0, after: 0 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: page.description.toUpperCase(),
                size: 20,
                color: "C7D2E4",
              }),
            ],
          })
        : new Paragraph({ children: [new TextRun({ text: page.description, italics: true })] }),
    );
  }

  if (vocabulary) {
    children.push(
      new Paragraph({
        shading: { fill: DOCX.title },
        spacing: { before: 0, after: 200 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "🔊 Нажми на слово, чтобы открыть его в Reverso Context",
            italics: true,
            size: 18,
            color: "C7D2E4",
          }),
        ],
      }),
    );
  }

  const para = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
    new Paragraph({ children: [new TextRun({ text, ...opts })] });

  if (page.blocks.length > 0) {
    for (const b of page.blocks) {
      switch (b.type) {
        case "heading":
          children.push(new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2 }));
          break;
        case "callout":
          children.push(para(b.label ? `${b.label}: ${b.text}` : b.text, { bold: true }));
          break;
        case "formula":
          children.push(para(b.text, { bold: true }));
          break;
        case "text":
          children.push(para(b.text));
          break;
        case "example":
          children.push(new Paragraph({ text: b.en, bullet: { level: 0 } }));
          if (b.tr) children.push(para(b.tr, { italics: true }));
          break;
        case "list":
          for (const item of b.items) {
            children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
          }
          break;
        case "table": {
          const rows: InstanceType<typeof TableRow>[] = [];
          const cell = (text: string, bold = false) =>
            new TableCell({ children: [para(text, { bold })] });

          if (b.headers.length) {
            rows.push(new TableRow({ children: b.headers.map((h) => cell(h, true)) }));
          }
          for (const r of b.rows) {
            rows.push(new TableRow({ children: r.map((c) => cell(c)) }));
          }
          if (rows.length) {
            children.push(
              new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
            );
            children.push(new Paragraph({ text: "" }));
          }
          break;
        }
      }
    }
  } else {
    const lang = page.lang ?? "UK";
    let section: string | null = null;

    for (const p of page.phrases) {
      if ((p.section ?? null) !== section) {
        section = p.section ?? null;
        if (section) {
          // Раздел плашкой: в длинном словнике глаз цепляется за цвет,
          // а не за размер шрифта.
          children.push(
            new Paragraph({
              shading: { fill: DOCX.section },
              spacing: { before: 240, after: 120 },
              children: [
                new TextRun({ text: section, bold: true, size: 26, color: DOCX.white }),
              ],
            }),
          );
        }
      }

      if (p.kind === "NOTE") {
        children.push(
          para(`💡 ${p.phrase}${p.translation ? ` — ${p.translation}` : ""}`, {
            italics: true,
          }),
        );
        continue;
      }

      const transcription = transcriptionOf(p);
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 40 },
          children: [
            ...(p.icon ? [new TextRun({ text: `${p.icon}  ` })] : []),
            // Слово — ссылка: по ней открываются живые примеры в Reverso.
            new ExternalHyperlink({
              link: reversoUrl(p.phrase, lang),
              children: [
                new TextRun({ text: p.phrase, bold: true, size: 26, color: DOCX.word }),
              ],
            }),
            ...(transcription
              ? [new TextRun({ text: `  ${transcription}`, size: 18, color: DOCX.faint })]
              : []),
            ...(p.translation
              ? [
                  new TextRun({ text: "  —  ", color: DOCX.faint }),
                  new TextRun({
                    text: p.translation,
                    bold: true,
                    size: 24,
                    color: DOCX.translation,
                  }),
                ]
              : []),
          ],
        }),
      );

      for (const ex of p.examples) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 0, after: 20 },
            children: [
              new TextRun({ text: ex.en, size: 21, color: DOCX.example }),
              ...(ex.tr
                ? [
                    new TextRun({ text: "  —  ", color: DOCX.faint }),
                    new TextRun({ text: ex.tr, italics: true, size: 20, color: DOCX.faint }),
                  ]
                : []),
            ],
          }),
        );
      }

      // Подсказка — та самая жёлтая полоса со страницы.
      if (p.note) {
        for (const line of p.note.split(String.fromCharCode(10))) {
          if (!line.trim()) continue;
          children.push(
            new Paragraph({
              shading: { fill: DOCX.noteFill },
              spacing: { before: 60, after: 60 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: line.trim(), size: 19, color: DOCX.noteText }),
              ],
            }),
          );
        }
      }
    }
  }

  return children;
}

/** Одна страница отдельным файлом. */
export async function pageToDocxBlob(page: ExportPage): Promise<Blob> {
  const { Document, Packer } = await import("docx");
  const children = await pageToDocxChildren(page);
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

/**
 * Отчёт по ученику одним файлом: шапка и все пройденные страницы подряд.
 * Путь до страницы идёт заголовком — по нему видно, к какой теме материал.
 */
export async function reportToDocxBlob(report: Report): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  type Child = Awaited<ReturnType<typeof pageToDocxChildren>>[number];
  const children: Child[] = [
    new Paragraph({ text: `Отчёт: ${report.studentName}`, heading: HeadingLevel.TITLE }),
    ...report.meta.map(
      (m) => new Paragraph({ children: [new TextRun({ text: m, italics: true })] }),
    ),
    new Paragraph({ text: "" }),
  ];

  for (const { path, page } of report.entries) {
    children.push(
      new Paragraph({ text: path.join(" / "), heading: HeadingLevel.HEADING_1 }),
    );
    children.push(...(await pageToDocxChildren(page, "h2")));
    children.push(new Paragraph({ text: "" }));
  }

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
