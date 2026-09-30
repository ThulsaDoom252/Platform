import { promises as fs } from "node:fs";
import path from "node:path";
import { del, put } from "@vercel/blob";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

function normalizePathname(value: string): string | null {
  const pathname = value.replace(/^\/+/, "");
  if (!pathname.startsWith("uploads/") || pathname.includes("..")) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(pathname)) return null;
  return pathname;
}

/** Путь managed-файла независимо от того, лежит он локально или в Vercel Blob. */
export function managedUploadPath(value: string): string | null {
  const source = String(value ?? "").trim();
  if (!source) return null;
  if (source.startsWith("/uploads/")) return normalizePathname(source);

  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !url.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;
    return normalizePathname(url.pathname);
  } catch {
    return null;
  }
}

function localTarget(pathname: string): string {
  return path.join(process.cwd(), "public", ...pathname.split("/"));
}

/**
 * Сохраняет публичный файл устойчиво: в Vercel Blob на production и
 * в public/uploads при локальной разработке.
 */
export async function storePublicFile(
  pathname: string,
  body: Buffer | ArrayBuffer | Blob | File | ReadableStream,
  contentType?: string,
): Promise<string> {
  const safePath = normalizePathname(pathname);
  if (!safePath) throw new Error("Некорректный путь файла");

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safePath, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return blob.url;
  }

  const target = localTarget(safePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const bytes =
    body instanceof Buffer
      ? body
      : body instanceof ArrayBuffer
        ? Buffer.from(body)
        : body instanceof Blob
          ? Buffer.from(await body.arrayBuffer())
          : null;
  if (!bytes) throw new Error("Локальное хранилище не поддерживает потоковую запись");
  await fs.writeFile(target, bytes);
  return `/${safePath}`;
}

/** Удаляет только файл из управляемой папки uploads. */
export async function removePublicFile(value: string, prefix: string): Promise<void> {
  const pathname = managedUploadPath(value);
  const safePrefix = normalizePathname(`uploads/${prefix}/placeholder`)?.replace(
    /placeholder$/,
    "",
  );
  if (!pathname || !safePrefix || !pathname.startsWith(safePrefix)) return;

  if (/^https:\/\//i.test(value)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return;
    await del(value);
    return;
  }

  try {
    await fs.unlink(localTarget(pathname));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
