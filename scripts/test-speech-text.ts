import assert from "node:assert/strict";
import { speakableText } from "../src/lib/speech";

assert.equal(
  speakableText("🟪 RUN LOW / RUNNING LATE (verb phrase)"),
  "RUN LOW / RUNNING LATE",
);
assert.equal(speakableText("1️⃣ to get by (phrasal verb)"), "to get by");
assert.equal(speakableText("🏃‍♂️ 3) take a back seat (idiom)"), "take a back seat");
assert.equal(speakableText("She has 2 jobs (for now)."), "She has jobs.");
assert.equal(speakableText("✅ 4. set off [phrasal verb] {B2}"), "set off");

console.log("speech text sanitizer: ok");
