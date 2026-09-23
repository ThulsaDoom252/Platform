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

/** Имя файла без символов, которые не любит файловая система. */
export function safeFileName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${clean || "material"}.docx`;
}

/**
 * Сборка .docx. Библиотека тяжёлая, поэтому подгружается только в момент
 * выгрузки — на остальных страницах она в бандл не попадает.
 */
export async function pageToDocxBlob(page: ExportPage): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } =
    await import("docx");

  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: Block[] = [];

  children.push(
    new Paragraph({ text: page.title, heading: HeadingLevel.HEADING_1 }),
  );
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

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
