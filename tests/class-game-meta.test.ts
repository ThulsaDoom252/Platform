import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASS_GAME_GRADES,
  classActivityKey,
  classGameGradeStyle,
  normalizeClassGameReview,
} from "../src/lib/class-game-meta";

test("class activity keys keep games and revisions in one collision-free order", () => {
  assert.equal(classActivityKey("game", "same"), "game:same");
  assert.equal(classActivityKey("revision", "same"), "revision:same");
  assert.notEqual(classActivityKey("game", "same"), classActivityKey("revision", "same"));
});

test("student reviews accept only known grades and bounded public fields", () => {
  const review = normalizeClassGameReview({
    activityKey: `game:${"x".repeat(200)}`,
    title: "T".repeat(200),
    grade: "GREAT",
    notes: "N".repeat(2_000),
    visible: true,
    at: "2026-10-04T12:00:00.000Z",
  });
  assert.ok(review);
  assert.equal(review.activityKey.length, 100);
  assert.equal(review.title.length, 120);
  assert.equal(review.notes.length, 1_000);
  assert.equal(review.visible, true);
  assert.equal(normalizeClassGameReview({ ...review, grade: "PERFECT" }), null);
});

test("every game rating has its own emoji and visual theme", () => {
  assert.equal(new Set(CLASS_GAME_GRADES.map((grade) => classGameGradeStyle[grade].emoji)).size, 4);
  for (const grade of CLASS_GAME_GRADES) {
    assert.ok(classGameGradeStyle[grade].panel);
    assert.ok(classGameGradeStyle[grade].button);
  }
});
