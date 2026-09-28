/**
 * Хранилище картинок к словам.
 *
 * Пока это папка внутри проекта. Когда платформа переедет в онлайн,
 * менять придётся только две функции внизу — всё остальное работает с
 * путём, который они вернули, и не знает, откуда он взялся.
 *
 * Картинка кладётся к себе, а не остаётся ссылкой на чужой сайт: ссылка
 * живёт ровно столько, сколько её держит Pixabay, а словник учителя
 * должен пережить и это.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

/** Папка внутри public/uploads, где лежат картинки слов. */
export const STORE_DIR = "words";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Больше этого не скачиваем: для карточки столько не нужно. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Наша ли это картинка.
 *
 * Проверка нужна перед удалением файла: по ссылке из базы нельзя
 * позволить стереть что угодно на диске. Поэтому путь должен быть ровно
 * нашего вида — папка, имя, расширение, и ничего больше.
 */
export function isStoredImage(url: string): boolean {
  return /^\/uploads\/words\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(
    String(url ?? ""),
  );
}

/** Имя файла из нашей ссылки. Для чужой — null. */
export function storedFileName(url: string): string | null {
  if (!isStoredImage(url)) return null;
  return String(url).slice("/uploads/words/".length);
}

function storeRoot(): string {
  return path.join(process.cwd(), "public", "uploads", STORE_DIR);
}

/**
 * Скачать картинку к себе и вернуть ссылку на неё.
 *
 * Уже наша — возвращается как есть: перекачивать собственный файл
 * незачем, а повторный вызов случается при каждом выборе картинки.
 */
export async function storeRemoteImage(url: string): Promise<string | null> {
  const link = String(url ?? "").trim();
  if (!link) return null;
  if (isStoredImage(link)) return link;
  if (!/^https?:\/\//i.test(link)) return null;

  try {
    const response = await fetch(link);
    if (!response.ok) return null;

    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;

    const dir = storeRoot();
    await fs.mkdir(dir, { recursive: true });

    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    await fs.writeFile(path.join(dir, name), buffer);

    return `/uploads/${STORE_DIR}/${name}`;
  } catch {
    // Сеть моргнула или отдали не картинку — подбор из-за этого падать
    // не должен, останется ссылка на источник.
    return null;
  }
}

/**
 * Убрать файл из хранилища.
 *
 * Чужую ссылку не трогаем — удалять там нечего. Пропавший файл ошибкой
 * не считаем: строку в базе всё равно надо стереть.
 */
export async function removeStoredImage(url: string): Promise<void> {
  const name = storedFileName(url);
  if (!name) return;

  try {
    await fs.unlink(path.join(storeRoot(), name));
  } catch {
    /* файла уже нет — и хорошо */
  }
}
