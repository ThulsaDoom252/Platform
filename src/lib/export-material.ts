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
  translation: string | null;
  examples: { en: string; tr: string }[];
};

export type ExportPage = {
  title: string;
  description: string | null;
  phrases: ExportPhrase[];
  blocks: RuleBlock[];
};

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

    const head = [p.phrase, p.transcription].filter(Boolean).join(" ");
    out.push(`${head}${p.translation ? ` — ${p.translation}` : ""}`);
    for (const ex of p.examples) {
      out.push(`• ${ex.en}${ex.tr ? ` — ${ex.tr}` : ""}`);
    }
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
  const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } =
    await import("docx");

  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: Block[] = [];

  if (titleLevel !== "none") {
    children.push(
      new Paragraph({
        text: page.title,
        heading: titleLevel === "h1" ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      }),
    );
  }
  if (page.description) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: page.description, italics: true })] }),
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
    let section: string | null = null;
    for (const p of page.phrases) {
      if ((p.section ?? null) !== section) {
        section = p.section ?? null;
        if (section) {
          children.push(new Paragraph({ text: section, heading: HeadingLevel.HEADING_2 }));
        }
      }

      if (p.kind === "NOTE") {
        children.push(para(`💡 ${p.phrase}${p.translation ? ` — ${p.translation}` : ""}`, { italics: true }));
        continue;
      }

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: p.phrase, bold: true }),
            ...(p.transcription ? [new TextRun({ text: ` ${p.transcription}` })] : []),
            ...(p.translation ? [new TextRun({ text: ` — ${p.translation}` })] : []),
          ],
        }),
      );
      for (const ex of p.examples) {
        children.push(new Paragraph({ text: ex.en, bullet: { level: 0 } }));
        if (ex.tr) children.push(para(ex.tr, { italics: true }));
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
