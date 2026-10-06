import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits } from "@/lib/db/schema";
import {
  findHomeworkItem,
  homeworkPlanForAssignment,
  homeworkVoiceRecordingItemId,
  interactiveHomeworkFromEntries,
  normalizeInteractiveHomework,
} from "@/lib/lesson-homework";
import { normalizeRegularLessonSections } from "@/lib/regular-lesson";
import { managedUploadPath } from "@/lib/public-file-store";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
];
const ALLOWED_EXTENSIONS = new Set(["webm", "ogg", "oga", "mp4", "m4a", "mp3", "wav"]);

type AudioPayload = { assignmentId: string; sectionId: string };

function parsePayload(value: string | null | undefined): AudioPayload | null {
  try {
    const parsed = JSON.parse(String(value ?? "")) as Partial<AudioPayload>;
    const assignmentId = String(parsed.assignmentId ?? "").trim();
    const sectionId = String(parsed.sectionId ?? "").trim();
    return assignmentId && sectionId ? { assignmentId, sectionId } : null;
  } catch {
    return null;
  }
}

async function accessibleVoiceSection(assignmentId: string, sectionId: string) {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db
    .select({
      assignmentId: lessonAssignments.id,
      studentId: lessonAssignments.studentId,
      authorId: lessonUnits.authorId,
      kind: lessonUnits.kind,
      sections: lessonUnits.sections,
      homework: lessonUnits.homework,
      answers: lessonAssignments.answers,
      contentOverride: lessonAssignments.contentOverride,
    })
    .from(lessonAssignments)
    .innerJoin(lessonUnits, eq(lessonUnits.id, lessonAssignments.unitId))
    .where(eq(lessonAssignments.id, assignmentId))
    .limit(1);
  if (!row) return null;
  const allowed = session.role === "STUDENT"
    ? row.studentId === session.userId
    : session.role === "TEACHER" && row.authorId === session.userId;
  if (!allowed) return null;
  if (sectionId === "teacher-feedback") {
    return session.role === "TEACHER" && row.authorId === session.userId ? row : null;
  }
  const section = row.kind === "REGULAR"
    ? normalizeRegularLessonSections(row.sections)
        .find((item) => item.id === sectionId && item.voiceExercise)
    : null;
  if (section) return row;

  const homeworkItemId = homeworkVoiceRecordingItemId(sectionId);
  const contentPlan = row.contentOverride && typeof row.contentOverride === "object"
    ? normalizeInteractiveHomework(row.contentOverride.interactiveHomework, { allowEmpty: true })
    : null;
  const plan = homeworkPlanForAssignment(
    contentPlan ?? interactiveHomeworkFromEntries(row.homework),
    row.answers ?? {},
  );
  const item = homeworkItemId && plan ? findHomeworkItem(plan, homeworkItemId) : null;
  return item?.exercise.kind === "question-audio" ? row : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await context.params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = parsePayload(clientPayload);
        if (!payload || payload.assignmentId !== assignmentId) {
          throw new Error("Некорректные данные записи");
        }
        const assignment = await accessibleVoiceSection(assignmentId, payload.sectionId);
        if (!assignment) throw new Error("Голосовое упражнение недоступно");

        const managedPath = managedUploadPath(`/${pathname}`);
        const extension = managedPath?.split(".").pop()?.toLowerCase();
        if (
          !managedPath?.startsWith(`uploads/lesson-audio/${assignmentId}-`) ||
          !extension ||
          !ALLOWED_EXTENSIONS.has(extension)
        ) {
          throw new Error("Некорректное имя записи");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_AUDIO_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify(payload),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить запись" },
      { status: 400 },
    );
  }
}
