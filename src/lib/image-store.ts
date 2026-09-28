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

/** Папки внутри public/uploads, которыми владеет платформа. */
export const STORE_DIRS = ["words", "twisters"] as const;
export type StoreDir = (typeof STORE_DIRS)[number];

/** Папка картинок словника — она же по умолчанию. */
export const STORE_DIR: StoreDir = "words";

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
export function isStoredImage(url: string, dir: StoreDir = STORE_DIR): boolean {
  if (!STORE_DIRS.includes(dir)) return false;
  const pattern = new RegExp(
    `^/uploads/${dir}/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$`,
  );
  return pattern.test(String(url ?? ""));
}

/** Имя файла из нашей ссылки. Для чужой — null. */
export function storedFileName(url: string, dir: StoreDir = STORE_DIR): string | null {
  if (!isStoredImage(url, dir)) return null;
  return String(url).slice(`/uploads/${dir}/`.length);
}

function storeRoot(dir: StoreDir): string {
  return path.join(process.cwd(), "public", "uploads", dir);
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

    const dir = storeRoot(STORE_DIR);
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

/** Что пошло не так при приёме файла — страница переведёт сама. */
export type StoreFailure = "type" | "size" | "failed";

/**
 * Положить в хранилище файл, выбранный на компьютере.
 *
 * Возвращает либо ссылку, либо причину отказа: текст ошибки собирает
 * страница, потому что язык знает она, а не хранилище.
 */
export async function storeUploadedImage(
  file: File,
  dir: StoreDir = STORE_DIR,
): Promise<{ url: string } | { error: StoreFailure }> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) return { error: "type" };
  if (file.size === 0 || file.size > MAX_BYTES) return { error: "size" };

  try {
    const target = storeRoot(dir);
    await fs.mkdir(target, { recursive: true });

    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    await fs.writeFile(path.join(target, name), Buffer.from(await file.arrayBuffer()));

    return { url: `/uploads/${dir}/${name}` };
  } catch {
    return { error: "failed" };
  }
}

/**
 * Убрать файл из хранилища.
 *
 * Чужую ссылку не трогаем — удалять там нечего. Пропавший файл ошибкой
 * не считаем: строку в базе всё равно надо стереть.
 */
export async function removeStoredImage(
  url: string,
  dir: StoreDir = STORE_DIR,
): Promise<void> {
  const name = storedFileName(url, dir);
  if (!name) return;

  try {
    await fs.unlink(path.join(storeRoot(dir), name));
  } catch {
    /* файла уже нет — и хорошо */
  }
}
