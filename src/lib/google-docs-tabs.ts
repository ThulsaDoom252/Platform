/**
 * Точный импорт дерева вкладок Google Docs.
 *
 * Google Docs API возвращает название, emoji и childTabs отдельно от
 * содержимого документа. Access token приходит из Google Identity Services,
 * используется для одного запроса из браузера и нигде не сохраняется.
 */
import type { ImportNode } from "@/lib/tree-import";

type GoogleTab = {
  tabProperties?: {
    title?: string;
    iconEmoji?: string;
    index?: number;
  };
  documentTab?: {
    body?: { content?: GoogleStructuralElement[] };
  };
  childTabs?: GoogleTab[];
};

type GoogleParagraphElement = {
  textRun?: { content?: string };
  autoText?: { content?: string };
};

export type GoogleStructuralElement = {
  paragraph?: {
    elements?: GoogleParagraphElement[];
    bullet?: unknown;
  };
  table?: {
    tableRows?: {
      tableCells?: { content?: GoogleStructuralElement[] }[];
    }[];
  };
  tableOfContents?: { content?: GoogleStructuralElement[] };
};

type GoogleDocument = { tabs?: GoogleTab[] };

export type GoogleTabsResult = {
  nodes?: ImportNode[];
  error?: string;
  /** Вкладок оказалось больше потолка — часть не доехала, надо сказать. */
  truncated?: boolean;
};

/**
 * Потолок на число вкладок. Нужен, чтобы случайный чужой документ не
 * подвесил предпросмотр, но молчать про обрезку нельзя: учитель увидит
 * правдоподобное дерево и не узнает, что конца у него нет.
 */
const MAX_TABS = 500;
const MAX_TAB_TEXT = 200_000;

/**
 * Превращает тело вкладки в текст, который понимают существующие парсеры.
 * Таблицы сохраняются строками с табуляцией, списки — с маркером.
 */
export function googleStructuralElementsToText(
  elements: GoogleStructuralElement[] | undefined,
): string {
  if (!Array.isArray(elements)) return "";
  let out = "";

  const append = (value: string) => {
    if (!value || out.length >= MAX_TAB_TEXT) return;
    out += value.slice(0, MAX_TAB_TEXT - out.length);
  };

  const read = (items: GoogleStructuralElement[] | undefined) => {
    for (const item of items ?? []) {
      if (out.length >= MAX_TAB_TEXT) break;
      if (item.paragraph) {
        const text = (item.paragraph.elements ?? [])
          .map((element) => element.textRun?.content ?? element.autoText?.content ?? "")
          .join("")
          .replace(/\n+$/, "")
          .trimEnd();
        if (text) append(`${item.paragraph.bullet ? "• " : ""}${text}\n`);
        continue;
      }

      if (item.table) {
        for (const row of item.table.tableRows ?? []) {
          const cells = (row.tableCells ?? []).map((cell) =>
            googleStructuralElementsToText(cell.content)
              .replace(/\s*\n\s*/g, " ")
              .trim(),
          );
          if (cells.some(Boolean)) append(`${cells.join("\t")}\n`);
        }
        continue;
      }

      if (item.tableOfContents) read(item.tableOfContents.content);
    }
  };

  read(elements);
  return out.trim();
}

/** ID из обычной ссылки на документ или ссылки на активную вкладку. */
export function googleDocumentId(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!/^https?:\/\/(docs|drive)\.google\.com\//i.test(value)) return null;

  const byPath = value.match(/\/(?:document|d)\/(?:e\/)?([A-Za-z0-9_-]{16,})/);
  if (byPath) return byPath[1];

  const byQuery = value.match(/[?&]id=([A-Za-z0-9_-]{16,})/);
  return byQuery?.[1] ?? null;
}

/** Google уже проверил, что iconEmoji — один emoji, поэтому не режем ZWJ и флаги. */
function cleanEmoji(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const emoji = value.trim();
  return emoji ? emoji.slice(0, 32) : null;
}

/**
 * Преобразование ответа Google в формат предпросмотра импортёра.
 * Вместе с деревом отдаёт признак того, что упёрлись в потолок.
 */
export function googleTabsToImportNodes(value: unknown): {
  nodes: ImportNode[];
  truncated: boolean;
} {
  const document = value && typeof value === "object" ? (value as GoogleDocument) : null;
  let seen = 0;
  let truncated = false;

  function convert(tabs: GoogleTab[] | undefined): ImportNode[] {
    if (!Array.isArray(tabs)) return [];
    if (seen >= MAX_TABS) {
      if (tabs.length > 0) truncated = true;
      return [];
    }

    return [...tabs]
      .sort(
        (a, b) =>
          (Number.isFinite(a.tabProperties?.index) ? Number(a.tabProperties?.index) : 0) -
          (Number.isFinite(b.tabProperties?.index) ? Number(b.tabProperties?.index) : 0),
      )
      .flatMap((tab) => {
        if (!tab || typeof tab !== "object") return [];
        if (seen >= MAX_TABS) {
          truncated = true;
          return [];
        }

        const name = String(tab.tabProperties?.title ?? "").trim().slice(0, 200);
        if (!name) return [];

        seen++;
        const children = convert(tab.childTabs);
        const content = googleStructuralElementsToText(tab.documentTab?.body?.content);
        return [
          {
            name,
            icon: cleanEmoji(tab.tabProperties?.iconEmoji),
            // В Docs раскрывашка есть именно тогда, когда у вкладки есть дети.
            kind: children.length > 0 ? "FOLDER" : "FILE",
            children,
            content: content || null,
          } satisfies ImportNode,
        ];
      });
  }

  const nodes = convert(document?.tabs);
  return { nodes, truncated };
}

/**
 * Читает свойства вкладок и, по опции, их текст. Текст сохраняется только в
 * предпросмотре; в базу он попадёт позже и только если учитель включил опцию.
 * Google Docs поддерживает максимум три уровня, поэтому field mask конечный.
 */
export async function readGoogleDocumentTabs(
  rawUrl: string,
  accessToken: string,
  includeContent = false,
): Promise<GoogleTabsResult> {
  const id = googleDocumentId(rawUrl);
  if (!id) return { error: "Нужна ссылка на документ Google Docs." };

  const token = String(accessToken ?? "").trim();
  if (!token || token.length > 4096) {
    return { error: "Google не выдал доступ к документу. Подключись ещё раз." };
  }

  const query = new URLSearchParams({ includeTabsContent: "true" });
  // Без разбора текста сохраняем прежний лёгкий запрос. Когда текст нужен,
  // просим полный Tab resource: так таблицы и вложенные элементы не потеряются
  // из-за слишком узкой partial-response маски.
  if (!includeContent) {
    const fields = [
      "tabs(",
      "tabProperties(title,iconEmoji,index),",
      "childTabs(tabProperties(title,iconEmoji,index),",
      "childTabs(tabProperties(title,iconEmoji,index)))",
      ")",
    ].join("");
    query.set("fields", fields);
  }

  try {
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(id)}?${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      return { error: "Доступ Google истёк. Нажми кнопку ещё раз." };
    }
    if (response.status === 403) {
      return {
        error:
          "Нет доступа к документу или Google Docs API не включён для этого приложения.",
      };
    }
    if (response.status === 404) return { error: "Документ не найден." };
    if (!response.ok) return { error: `Google ответил ${response.status}.` };

    const { nodes, truncated } = googleTabsToImportNodes(
      (await response.json()) as unknown,
    );
    if (nodes.length === 0) return { error: "Google не вернул ни одной вкладки." };
    return { nodes, truncated };
  } catch (error) {
    console.error("Не удалось прочитать вкладки Google Docs:", error);
    return { error: "Не получилось связаться с Google Docs." };
  }
}
