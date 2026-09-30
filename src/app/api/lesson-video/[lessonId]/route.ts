import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonUnits } from "@/lib/db/schema";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "ogv", "ogg", "mov", "m4v"]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

export async function PUT(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") {
    return jsonError("Загружать видео может только учитель", 403);
  }

  const { lessonId } = await context.params;
  const [lesson] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(
      and(
        eq(lessonUnits.id, String(lessonId ?? "")),
        eq(lessonUnits.authorId, session.userId),
      ),
    )
    .limit(1);
  if (!lesson) return jsonError("Урок не найден", 404);

  if (!request.body) return jsonError("Файл не выбран", 400);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_VIDEO_BYTES) {
    return jsonError("Видео больше 1 ГБ", 413);
  }

  let originalName = "video";
  try {
    originalName = decodeURIComponent(request.headers.get("x-file-name") || "video");
  } catch {
    return jsonError("Некорректное имя файла", 400);
  }
  originalName = path.basename(originalName).slice(0, 240);
  const suppliedExtension = path.extname(originalName).slice(1).toLowerCase();
  const mime = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const extension = ALLOWED_EXTENSIONS.has(suppliedExtension)
    ? suppliedExtension
    : EXTENSION_BY_MIME[mime];
  if (!extension) {
    return jsonError("Поддерживаются MP4, WebM, OGV, MOV и M4V", 415);
  }

  const directory = path.join(process.cwd(), "public", "uploads", "lesson-videos");
  await mkdir(directory, { recursive: true });
  const base = `${lesson.id}-${randomUUID()}`;
  const temporaryPath = path.join(directory, `${base}.upload`);
  const finalPath = path.join(directory, `${base}.${extension}`);
  let received = 0;

  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) {
        const error = new Error("VIDEO_TOO_LARGE");
        callback(error);
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(request.body as never),
      limiter,
      createWriteStream(temporaryPath, { flags: "wx" }),
    );
    if (received === 0) throw new Error("EMPTY_VIDEO");
    await rename(temporaryPath, finalPath);

    const url = `/uploads/lesson-videos/${base}.${extension}`;
    const title = path.basename(originalName, path.extname(originalName)).trim().slice(0, 160)
      || "Video";
    await db
      .update(lessonUnits)
      .set({ videoUrl: url, videoTitle: title, updatedAt: new Date() })
      .where(eq(lessonUnits.id, lesson.id));

    revalidatePath(`/teacher/lessons/${lesson.id}`);
    revalidatePath("/teacher/lessons");
    revalidatePath("/teacher/class");
    revalidatePath("/student/class");
    return Response.json({ url, title });
  } catch (error) {
    await Promise.all([
      rm(temporaryPath, { force: true }).catch(() => undefined),
      rm(finalPath, { force: true }).catch(() => undefined),
    ]);
    if (error instanceof Error && error.message === "VIDEO_TOO_LARGE") {
      return jsonError("Видео больше 1 ГБ", 413);
    }
    if (error instanceof Error && error.message === "EMPTY_VIDEO") {
      return jsonError("Файл пуст", 400);
    }
    return jsonError("Не удалось сохранить видео", 500);
  }
}
