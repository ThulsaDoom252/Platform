import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadClassActivitySections, type ClassActivitySections } from "../src/lib/class-activity-load";

const studentId = "73e07e3b-cdb2-486c-935d-68b7b430d01e";
const sections: ClassActivitySections = {
  queue: [], decks: [], revisions: [], meta: { order: ["game:saved-game"], settings: {}, reviews: {} },
};
const loaders = () => ({
  queue: async () => sections.queue,
  decks: async () => sections.decks,
  revisions: async () => sections.revisions,
  meta: async () => sections.meta,
});

test("class activity reads return a complete, independently fetched snapshot", async () => {
  assert.deepEqual(await loadClassActivitySections(studentId, loaders()), { studentId, failed: [], ...sections });
});

for (const failed of ["queue", "decks", "revisions", "meta"] as const) {
  test(`a failed ${failed} query does not discard any other class section`, async () => {
    const load = loaders();
    load[failed] = async () => { throw new Error("Database unavailable"); };
    const result = await loadClassActivitySections(studentId, load);
    assert.deepEqual(result.failed, [failed]);
    assert(!Object.hasOwn(result, failed), "An unavailable section must not become []");
    for (const key of ["queue", "decks", "revisions", "meta"] as const) {
      if (key !== failed) assert.deepEqual(result[key], sections[key]);
    }
    const { studentId: _id, failed: _errors, ...successful } = result;
    void _id; void _errors;
    const previous = { ...sections, [failed]: "previously loaded data" };
    assert.equal({ ...previous, ...successful }[failed], "previously loaded data");
  });
}

test("synchronous loader errors are isolated as well as rejected promises", async () => {
  const load = loaders();
  load.revisions = () => { throw new Error("Missing column"); };
  const result = await loadClassActivitySections(studentId, load);
  assert.deepEqual(result.failed, ["revisions"]);
  assert.equal(result.decks, sections.decks);
});

test("all failed reads contain no fabricated empty lists or private error details", async () => {
  const fail = async () => { throw new Error("Sensitive database connection details"); };
  assert.deepEqual(await loadClassActivitySections(studentId, { queue: fail, decks: fail, revisions: fail, meta: fail }), {
    studentId, failed: ["queue", "decks", "revisions", "meta"],
  });
});

test("independent class reads start together instead of serial client action dispatch", async () => {
  const started: string[] = [];
  const releases: (() => void)[] = [];
  const wait = async <K extends keyof ClassActivitySections>(key: K): Promise<ClassActivitySections[K]> => {
    started.push(key);
    await new Promise<void>((resolve) => releases.push(resolve));
    return sections[key];
  };
  const result = loadClassActivitySections(studentId, {
    queue: () => wait("queue"), decks: () => wait("decks"), revisions: () => wait("revisions"), meta: () => wait("meta"),
  });
  await Promise.resolve();
  assert.deepEqual(started, ["queue", "decks", "revisions", "meta"]);
  releases.forEach((release) => release());
  assert.deepEqual((await result).failed, []);
});

test("class UI keeps data on errors, ignores stale loads and offers a localized retry", () => {
  const source = readFileSync("src/components/class/class-activities.tsx", "utf8");
  assert(!/set(?:Queue|Decks|Revisions)\(\[\]\)/.test(source));
  assert.match(source, /generation !== loadGeneration.current/);
  assert.match(source, /if \(result.decks !== undefined\) setDecks\(result.decks\)/);
  assert.match(source, /!loading && !loadError && queue/);
  assert.match(source, /t.activityPicker.retryLoad/);
  const room = readFileSync("src/components/class/class-room.tsx", "utf8");
  assert.match(room, /<ClassActivities key=\{partner.id\} studentId=\{partner.id\}/);
  const action = readFileSync("src/lib/actions/class-activities.ts", "utf8");
  assert.match(action, /session.role !== "TEACHER"/);
  assert.match(action, /teacher\?\.studentId !== target/);
});

test("feedback migration explicitly selects production and verifies preservation before commit", () => {
  const source = readFileSync("scripts/migrate-homework-feedback.ts", "utf8");
  assert.match(source, /process.argv.includes\("--production"\)/);
  assert.match(source, /loaded.parsed\?\.NEON_DATABASE_URL/);
  assert.match(source, /add column if not exists homework_feedback jsonb/);
  assert(source.indexOf("assert.deepEqual(preserved.rows, snapshot.rows") < source.indexOf('client.query("commit")'));
  assert(!/\b(?:delete from|truncate|drop table|update public.word_revisions)\b/i.test(source));
});
