import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonUnits, users } from "../src/lib/db/schema";
import { cleanScriptHtml } from "../src/lib/script-html";
import {
  addRegularLessonFocusIds,
  normalizeRegularLessonSections,
  type RegularLessonSection,
  type RegularLessonTone,
} from "../src/lib/regular-lesson";

type ParsedSection = { className: string; title: string; html: string };

function text(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string, index: number): string {
  const ascii = text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
  return `${String(index + 1).padStart(2, "0")}-${ascii || "section"}`;
}

function tone(className: string): RegularLessonTone {
  if (/\bwarm\b/.test(className)) return "warm";
  if (/\bvocab\b/.test(className)) return "vocab";
  if (/\bgram\b/.test(className)) return "grammar";
  if (/\bread\b/.test(className)) return "reading";
  if (/\bdlg\b/.test(className)) return "dialogue";
  if (/teacher-note/.test(className)) return "teacher";
  return "exercise";
}

function parseSections(source: string): ParsedSection[] {
  const out: ParsedSection[] = [];
  const pattern = /<section\s+class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const body = match[2];
    const heading = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = text(heading?.[1] ?? "Teacher notes");
    const html = heading ? body.replace(heading[0], "") : body;
    out.push({ className: match[1], title, html });
  }
  return out;
}

async function main() {
  const [studentPath, teacherPath] = process.argv.slice(2);
  if (!studentPath || !teacherPath) {
    throw new Error("Usage: npm run lesson:import-html -- STUDENT.html TEACHER.html");
  }

  const [studentSource, teacherSource] = await Promise.all([
    readFile(studentPath, "utf8"),
    readFile(teacherPath, "utf8"),
  ]);
  const student = parseSections(studentSource);
  const teacher = parseSections(teacherSource);
  if (student.length === 0 || teacher.length < student.length) {
    throw new Error("The HTML files do not contain matching lesson sections");
  }

  const sections: RegularLessonSection[] = student.map((section, index) => {
    const answer = teacher[index];
    if (!answer || answer.title !== section.title) {
      throw new Error(`Section mismatch at ${index + 1}: ${section.title}`);
    }
    return {
      id: slug(section.title, index),
      title: section.title,
      tone: tone(section.className),
      studentHtml: cleanScriptHtml(addRegularLessonFocusIds(section.html)),
      teacherHtml: cleanScriptHtml(addRegularLessonFocusIds(answer.html)),
      defaultOpen: index !== 0,
    };
  });

  for (const note of teacher.slice(student.length)) {
    sections.push({
      id: slug(note.title, sections.length),
      title: note.title,
      tone: "teacher",
      studentHtml: "",
      teacherHtml: cleanScriptHtml(addRegularLessonFocusIds(note.html)),
      defaultOpen: false,
      teacherOnly: true,
    });
  }

  const normalized = normalizeRegularLessonSections(sections);
  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  const title = "Meat & Fish";
  const description =
    "Food · Reflexive pronouns · Conditionals 0 / 1 / 2 · can / should / will · Tenses review";
  const [existing] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, author.id), eq(lessonUnits.title, title)))
    .limit(1);

  const id = existing?.id
    ? (await db
        .update(lessonUnits)
        .set({ kind: "REGULAR", description, sections: normalized, updatedAt: new Date() })
        .where(eq(lessonUnits.id, existing.id))
        .returning({ id: lessonUnits.id }))[0]?.id
    : (await db
        .insert(lessonUnits)
        .values({ authorId: author.id, kind: "REGULAR", title, description, sections: normalized })
        .returning({ id: lessonUnits.id }))[0]?.id;

  console.log(JSON.stringify({ id, title, author: author.name, sections: normalized.length, source: [basename(studentPath), basename(teacherPath)] }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
