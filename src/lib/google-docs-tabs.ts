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
  childTabs?: GoogleTab[];
};

type GoogleDocument = { tabs?: GoogleTab[] };

export type GoogleTabsResult = { nodes?: ImportNode[]; error?: string };

const MAX_TABS = 100;

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

/** Преобразование ответа Google в формат предпросмотра импортёра. */
export function googleTabsToImportNodes(value: unknown): ImportNode[] {
  const document = value && typeof value === "object" ? (value as GoogleDocument) : null;
  let seen = 0;

  function convert(tabs: GoogleTab[] | undefined): ImportNode[] {
    if (!Array.isArray(tabs) || seen >= MAX_TABS) return [];

    return [...tabs]
      .sort(
        (a, b) =>
          (Number.isFinite(a.tabProperties?.index) ? Number(a.tabProperties?.index) : 0) -
          (Number.isFinite(b.tabProperties?.index) ? Number(b.tabProperties?.index) : 0),
      )
      .flatMap((tab) => {
        if (seen >= MAX_TABS || !tab || typeof tab !== "object") return [];

        const name = String(tab.tabProperties?.title ?? "").trim().slice(0, 200);
        if (!name) return [];

        seen++;
        const children = convert(tab.childTabs);
        return [
          {
            name,
            icon: cleanEmoji(tab.tabProperties?.iconEmoji),
            // В Docs раскрывашка есть именно тогда, когда у вкладки есть дети.
            kind: children.length > 0 ? "FOLDER" : "FILE",
            children,
          } satisfies ImportNode,
        ];
      });
  }

  return convert(document?.tabs);
}

/**
 * Читает только свойства вкладок, без текста и изображений документа.
 * Google Docs поддерживает максимум три уровня, поэтому field mask конечный.
 */
export async function readGoogleDocumentTabs(
  rawUrl: string,
  accessToken: string,
): Promise<GoogleTabsResult> {
  const id = googleDocumentId(rawUrl);
  if (!id) return { error: "Нужна ссылка на документ Google Docs." };

  const token = String(accessToken ?? "").trim();
  if (!token || token.length > 4096) {
    return { error: "Google не выдал доступ к документу. Подключись ещё раз." };
  }

  const fields = [
    "tabs(",
    "tabProperties(title,iconEmoji,index),",
    "childTabs(tabProperties(title,iconEmoji,index),",
    "childTabs(tabProperties(title,iconEmoji,index)))",
    ")",
  ].join("");
  const query = new URLSearchParams({ includeTabsContent: "true", fields });

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

    const nodes = googleTabsToImportNodes((await response.json()) as unknown);
    if (nodes.length === 0) return { error: "Google не вернул ни одной вкладки." };
    return { nodes };
  } catch (error) {
    console.error("Не удалось прочитать вкладки Google Docs:", error);
    return { error: "Не получилось связаться с Google Docs." };
  }
}
