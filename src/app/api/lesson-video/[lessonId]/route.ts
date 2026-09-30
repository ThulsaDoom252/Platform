import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonUnits } from "@/lib/db/schema";
import { managedUploadPath } from "@/lib/public-file-store";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
];
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "ogv", "ogg", "mov", "m4v"]);

type VideoPayload = { lessonId: string; title: string };

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

function parsePayload(value: string | null | undefined): VideoPayload | null {
  try {
    const parsed = JSON.parse(String(value ?? "")) as Partial<VideoPayload>;
    const lessonId = String(parsed.lessonId ?? "").trim();
    const title = String(parsed.title ?? "").trim().slice(0, 160) || "Video";
    return lessonId ? { lessonId, title } : null;
  } catch {
    return null;
  }
}

async function ownedLesson(lessonId: string) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER") return null;
  const [lesson] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.id, lessonId), eq(lessonUnits.authorId, session.userId)))
    .limit(1);
  return lesson ?? null;
}

async function saveVideo(lessonId: string, url: string, title: string) {
  await db
    .update(lessonUnits)
    .set({ videoUrl: url, videoTitle: title, updatedAt: new Date() })
    .where(eq(lessonUnits.id, lessonId));

  revalidatePath(`/teacher/lessons/${lessonId}`);
  revalidatePath("/teacher/lessons");
  revalidatePath("/teacher/class");
  revalidatePath("/student/class");
}

/** Выдаёт авторизованному учителю токен для прямой загрузки в Blob. */
export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await context.params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        if (!payload || payload.lessonId !== lessonId) {
          throw new Error("Некорректные данные видео");
        }
        const lesson = await ownedLesson(lessonId);
        if (!lesson) throw new Error("Загружать видео может только учитель");

        const managedPath = managedUploadPath(`/${pathname}`);
        const extension = managedPath?.split(".").pop()?.toLowerCase();
        if (
          !managedPath?.startsWith(`uploads/lesson-videos/${lesson.id}-`) ||
          !extension ||
          !ALLOWED_EXTENSIONS.has(extension)
        ) {
          throw new Error("Некорректное имя видео");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parsePayload(tokenPayload);
        if (!payload || payload.lessonId !== lessonId) {
          throw new Error("Некорректные данные завершённой загрузки");
        }
        await saveVideo(payload.lessonId, blob.url, payload.title);
      },
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Не удалось загрузить видео", 400);
  }
}

/** Немедленно фиксирует URL после успешной прямой загрузки из браузера. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await context.params;
  const lesson = await ownedLesson(lessonId);
  if (!lesson) return jsonError("Загружать видео может только учитель", 403);

  const body = (await request.json().catch(() => null)) as
    | { url?: unknown; title?: unknown }
    | null;
  const url = String(body?.url ?? "").trim();
  const title = String(body?.title ?? "").trim().slice(0, 160) || "Video";
  const pathname = managedUploadPath(url);
  if (!pathname?.startsWith(`uploads/lesson-videos/${lesson.id}-`)) {
    return jsonError("Некорректная ссылка на видео", 400);
  }

  await saveVideo(lesson.id, url, title);
  return Response.json({ url, title });
}
