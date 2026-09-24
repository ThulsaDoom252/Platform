"use server";

/**
 * Загрузка структуры прямо по ссылке на Google Docs.
 *
 * Берём не саму страницу документа (её без входа не отдадут), а его
 * выгрузку в HTML — заголовки в ней ровно те же, что при вставке руками.
 * Работает, пока документ открыт по ссылке хотя бы на чтение.
 *
 * Разбирает HTML всё тот же parseTree уже в браузере: так у ссылки,
 * вставки и картинки один и тот же путь, и чинить его надо в одном месте.
 */
import { getSession } from "@/lib/session";

export type LinkResult = { html?: string; error?: string };

/** Выгрузка Docs редко бывает больше пары мегабайт. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Идентификатор документа из любой формы ссылки.
 * Сами по себе адреса мы не запрашиваем: ходим только на docs.google.com
 * и только по собранному здесь пути.
 */
function documentId(raw: string): string | null {
  const url = String(raw || "").trim();
  if (!/^https?:\/\/(docs|drive)\.google\.com\//i.test(url)) return null;

  const byPath = url.match(/\/(?:document|d)\/(?:e\/)?([A-Za-z0-9_-]{16,})/);
  if (byPath) return byPath[1];

  const byQuery = url.match(/[?&]id=([A-Za-z0-9_-]{16,})/);
  return byQuery ? byQuery[1] : null;
}

export async function readTreeLinkAction(rawUrl: string): Promise<LinkResult> {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return { error: "Загружать документы может только учитель" };
  }

  const id = documentId(rawUrl);
  if (!id) {
    return { error: "Нужна ссылка на документ Google Docs (docs.google.com/document/d/…)" };
  }

  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${id}/export?format=html`,
      { redirect: "follow", headers: { accept: "text/html" } },
    );

    // Закрытый документ уводит на страницу входа — по адресу это и видно.
    if (/accounts\.google\.com|ServiceLogin/i.test(res.url)) {
      return {
        error:
          "Документ закрыт. Открой к нему доступ по ссылке («Доступ → Все, у кого есть ссылка → Читатель») или вставь текст вручную.",
      };
    }

    if (res.status === 404) return { error: "Документ не найден — проверь ссылку." };
    if (!res.ok) {
      return {
        error:
          res.status === 401 || res.status === 403
            ? "Нет доступа к документу. Открой его по ссылке хотя бы на чтение."
            : `Google ответил ${res.status}`,
      };
    }

    const html = await res.text();
    if (html.length > MAX_BYTES) return { error: "Документ слишком большой" };
    if (!/<h[1-6]|<li|<p/i.test(html)) return { error: "В документе нечего разбирать" };

    return { html };
  } catch (e) {
    console.error("Загрузка документа не удалась:", e);
    return { error: "Не получилось скачать документ" };
  }
}
