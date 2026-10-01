/**
 * Чистка разметки скрипта.
 *
 * Текст пишет учитель в поле с форматированием, а показывается он через
 * innerHTML. Браузер при вставке из буфера тащит за собой что угодно —
 * от чужих стилей до обработчиков событий, — поэтому оставляем только
 * знакомые теги и знакомые атрибуты.
 *
 * Разбор строковый: на сервере DOM недоступен, а тащить ради этого
 * целый парсер не за чем.
 */

/** Теги, из которых состоит оформленный текст. */
const ALLOWED = new Set([
  "p", "div", "br", "span",
  "b", "strong", "i", "em", "u", "s", "strike",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "code", "pre", "mark", "sub", "sup",
]);

/** Атрибуты, которые ничего не выполняют. */
const SAFE_ATTR = /^(style|class|href|colspan|rowspan|align|data-focus-id)$/i;

/** Значения style, в которых нельзя спрятать вызов. */
const SAFE_STYLE = /^[^;{}()]*(:[^;{}()]*)?$/;

const MAX_LENGTH = 200_000;

function cleanStyle(value: string): string {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && SAFE_STYLE.test(part) && !/expression|url\s*\(/i.test(part))
    .join("; ");
}

function cleanAttrs(raw: string): string {
  const out: string[] = [];
  const attr = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

  let match: RegExpExecArray | null;
  while ((match = attr.exec(raw))) {
    const name = match[1];
    const value = match[3] ?? match[4] ?? "";
    if (!SAFE_ATTR.test(name)) continue;

    if (name.toLowerCase() === "href") {
      // Ссылка ведёт наружу или никуда: javascript: здесь не место.
      if (!/^(https?:|mailto:|#|\/)/i.test(value.trim())) continue;
      out.push(`href="${value}" target="_blank" rel="noreferrer noopener"`);
      continue;
    }

    if (name.toLowerCase() === "style") {
      const style = cleanStyle(value);
      if (style) out.push(`style="${style}"`);
      continue;
    }

    if (name.toLowerCase() === "data-focus-id") {
      const id = value.trim();
      if (/^[a-z0-9:-]{1,80}$/i.test(id)) out.push(`data-focus-id="${id}"`);
      continue;
    }

    out.push(`${name}="${value}"`);
  }

  return out.length ? " " + out.join(" ") : "";
}

/** Оставить в разметке только знакомое и безобидное. */
export function cleanScriptHtml(raw: string): string {
  const text = String(raw ?? "").slice(0, MAX_LENGTH);

  return text
    // Скрипты и стили вырезаем вместе с содержимым — иначе останется текст.
    .replace(/<(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (whole, tag: string, attrs: string) => {
      const name = tag.toLowerCase();
      if (!ALLOWED.has(name)) return "";
      if (whole.startsWith("</")) return `</${name}>`;
      const selfClosing = name === "br" || name === "hr";
      return `<${name}${cleanAttrs(attrs)}${selfClosing ? " /" : ""}>`;
    });
}

/** Короткая выжимка для списка: первые слова без разметки. */
export function scriptPreview(html: string, limit = 90): string {
  const text = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
