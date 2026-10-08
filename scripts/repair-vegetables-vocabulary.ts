/** Exact production lesson. Dry run unless --apply; preserve exercises and student work. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { Pool } from "pg";
import { vegetablesVocabulary } from "../src/lib/bundled-lessons/a2-vegetables-vocabulary";
import type { LessonWord } from "../src/lib/lesson-unit";
import type { RegularLessonSection } from "../src/lib/regular-lesson";

const UNIT_ID = "27618f0e-bf3a-41cc-8bf8-8ca9aa251af8";
const AUTHOR_ID = "324718ca-f381-4478-9555-2eff9f857528";
const apply = process.argv.includes("--apply");
const env = config({ path: ".env.production.local", quiet: true }).parsed;
assert(env?.NEON_DATABASE_URL, "Production database configuration missing");
const connection = new URL(env.NEON_DATABASE_URL);
assert(connection.hostname !== "base", "Production database configuration is a placeholder");
connection.searchParams.set("sslmode", "verify-full");
const pool = new Pool({ connectionString: connection.toString(), connectionTimeoutMillis: 10_000, max: 1 });

type Unit = { id: string; title: string; author_id: string; sections: RegularLessonSection[] };
type Assignment = {
  id: string; unit_id: string; student_id: string; open_sections: string[];
  content_override: Record<string, unknown> | null; answers: Record<string, string>;
  highlights: Record<string, string>; finished_at: Date | null; created_at: Date;
};

async function main() {
  const client = await pool.connect();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    if (apply) await client.query("SET LOCAL lock_timeout = '5s'");
    const { rows: units } = await client.query<Unit>(
      `SELECT * FROM lesson_units WHERE id=$1 AND author_id=$2 ${apply ? "FOR UPDATE" : ""}`,
      [UNIT_ID, AUTHOR_ID],
    );
    assert.equal(units.length, 1, "Exact teacher's Vegetables lesson missing");
    const unit = units[0];
    assert.equal(unit.title, "A2 · Vegetables");
    const vocabSection = unit.sections.find((section) => section.tone === "vocab");
    assert(vocabSection, "Vegetables vocabulary section missing");
    const content = vegetablesVocabulary(vocabSection.studentHtml);
    assert.equal(content.length, 28);
    assert(content.every((word) => word.note && word.examples.length && word.translation));
    const { rows: existing } = await client.query<{ id: string; word: string }>(
      "SELECT id,word FROM lesson_words WHERE unit_id=$1 ORDER BY sort_order", [UNIT_ID],
    );
    // Never delete or rewrite later teacher edits on repeated runs.
    assert(existing.length === 0 || (
      existing.length >= content.length && content.every((word) => existing.some((saved) => saved.word === word.word))
    ), "Existing vocabulary differs; refusing to overwrite teacher edits");
    const words: LessonWord[] = content.map((word, index) => ({
      ...word, id: existing.find((saved) => saved.word === word.word)?.id ?? randomUUID(),
      sortOrder: index + 1,
    }));
    const sections = unit.sections.map((section) => section.tone === "warm"
      ? { ...section, defaultOpen: false } : section);
    for (const section of unit.sections.filter((entry) => entry.tone !== "warm")) {
      assert.deepEqual(sections.find((entry) => entry.id === section.id), section);
    }
    const { rows: assignments } = await client.query<Assignment>(
      `SELECT * FROM lesson_assignments WHERE unit_id=$1 ${apply ? "FOR UPDATE" : ""}`, [UNIT_ID],
    );
    const copies = assignments.map((assignment) => {
      const warmKeys = unit.sections.filter((section) => section.tone === "warm").map((section) => `regular:${section.id}`);
      const open = assignment.open_sections.filter((key) => !warmKeys.includes(key));
      const override = assignment.content_override ? { ...assignment.content_override } : null;
      if (override && (!Array.isArray(override.words) || override.words.length === 0)) override.words = words;
      if (override && Array.isArray(override.regularSections)) {
        override.regularSections = (override.regularSections as RegularLessonSection[]).map((section) =>
          section.tone === "warm" ? { ...section, defaultOpen: false } : section);
      }
      return { assignment, open, override, changed: !isDeepStrictEqual(open, assignment.open_sections) || !isDeepStrictEqual(override, assignment.content_override) };
    });
    const changedCopies = copies.filter((copy) => copy.changed);
    const changedSections = !isDeepStrictEqual(sections, unit.sections);
    const insertWords = existing.length === 0;
    if (apply && (insertWords || changedSections || changedCopies.length)) {
      const directory = resolve("backups");
      mkdirSync(directory, { recursive: true });
      const backup = resolve(directory, `vegetables-vocabulary-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeFileSync(backup, JSON.stringify({ unit, existingWords: existing, assignments }, null, 2), { flag: "wx", mode: 0o600 });
      console.log(`Backup saved: ${backup}`);
      if (insertWords) {
        for (const word of words) {
          await client.query(`INSERT INTO lesson_words
            (id,unit_id,category,icon,word,ipa_us,ipa_uk,translation,description,note,examples,section_color,image_url,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`, [
            word.id, UNIT_ID, word.category, word.icon, word.word, word.ipaUs, word.ipaUk,
            word.translation, word.description, word.note, JSON.stringify(word.examples), word.sectionColor, word.imageUrl,
            words.indexOf(word) + 1,
          ]);
        }
      }
      if (insertWords || changedSections) await client.query(
        "UPDATE lesson_units SET sections=$1::jsonb,updated_at=now() WHERE id=$2 AND author_id=$3",
        [JSON.stringify(sections), UNIT_ID, AUTHOR_ID],
      );
      for (const copy of changedCopies) await client.query(
        "UPDATE lesson_assignments SET open_sections=$1::jsonb,content_override=$2::jsonb,updated_at=now() WHERE id=$3 AND unit_id=$4",
        [JSON.stringify(copy.open), copy.override ? JSON.stringify(copy.override) : null, copy.assignment.id, UNIT_ID],
      );
      const { rows: after } = await client.query<Assignment>("SELECT * FROM lesson_assignments WHERE unit_id=$1", [UNIT_ID]);
      assert.equal(after.length, assignments.length);
      for (const before of assignments) {
        const saved = after.find((row) => row.id === before.id);
        assert(saved);
        for (const key of ["answers", "highlights", "finished_at", "created_at", "student_id", "unit_id"] as const) assert.deepEqual(saved[key], before[key]);
      }
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", lessonId: UNIT_ID, words: words.length, insertedWords: insertWords ? words.length : 0,
      tips: words.filter((word) => word.note).length, changedCopies: changedCopies.length, warmupClosed: true, exercisesAndAnswersPreserved: true }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

main().catch((error: { name?: string; code?: string }) => {
  console.error({ stage: "vegetables-vocabulary", type: error.name, code: error.code });
  process.exitCode = 1;
}).finally(() => pool.end());
