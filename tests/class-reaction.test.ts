import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASS_REACTION_KINDS,
  isClassReactionKind,
  normalizeClassReaction,
} from "../src/lib/class-reaction";

test("accepts every supported class reaction", () => {
  const now = Date.parse("2026-10-05T12:00:10.000Z");
  for (const kind of CLASS_REACTION_KINDS) {
    assert.deepEqual(
      normalizeClassReaction(
        {
          id: `reaction-${kind}`,
          kind,
          sound: kind === "great",
          sentAt: "2026-10-05T12:00:00.000Z",
        },
        now,
      ),
      {
        id: `reaction-${kind}`,
        kind,
        sound: kind === "great",
        sentAt: "2026-10-05T12:00:00.000Z",
      },
    );
    assert.equal(isClassReactionKind(kind), true);
  }
});

test("rejects unknown, malformed, old, and future reactions", () => {
  const now = Date.parse("2026-10-05T12:01:00.000Z");
  assert.equal(isClassReactionKind("surprised"), false);
  assert.equal(normalizeClassReaction(null, now), null);
  assert.equal(
    normalizeClassReaction(
      { id: "reaction-old", kind: "great", sound: false, sentAt: "2026-10-05T12:00:00.000Z" },
      now,
    ),
    null,
  );
  assert.equal(
    normalizeClassReaction(
      { id: "reaction-new", kind: "great", sound: false, sentAt: "2026-10-05T12:01:10.000Z" },
      now,
    ),
    null,
  );
  assert.equal(
    normalizeClassReaction(
      { id: "short", kind: "great", sound: false, sentAt: "2026-10-05T12:00:59.000Z" },
      now,
    ),
    null,
  );
});
