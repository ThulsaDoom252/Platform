import { randomUUID } from "node:crypto";
import { asc, eq, ilike } from "drizzle-orm";
import { db } from "../src/lib/db";
import { lessonAssignments, lessonUnits, lessonWords, users } from "../src/lib/db/schema";
import { parseLexisDocuments } from "../src/lib/keyed-parser";
import { newDerekHomework } from "../src/lib/bundled-lessons/new-derek";

const title = "new derek";

const vocabulary = [
  {
    icon: "🙏",
    word: "mercy",
    translation: "милосердя; пощада",
    description: "Kindness shown to someone you could punish or hurt.",
  },
  {
    icon: "⚡",
    word: "mercy kill",
    translation: "вбивство з милосердя; швидко покінчити",
    description: "A killing intended to end suffering; here, a figurative way to say the fight will end quickly.",
  },
  {
    icon: "👴",
    word: "old man",
    translation: "старий чоловік",
    description: "An elderly man; informally, it can also mean someone's father or husband.",
  },
  {
    icon: "✊",
    word: "to squeeze",
    translation: "стискати",
    description: "To press something firmly from two or more sides.",
  },
  {
    icon: "🫁",
    word: "lungs",
    translation: "легені",
    description: "The two organs in your chest that you use to breathe.",
  },
  {
    icon: "🛟",
    word: "to beg for life",
    translation: "благати зберегти життя",
    description: "To desperately ask someone not to kill or seriously hurt you.",
  },
  {
    icon: "🚪",
    word: "to open up",
    translation: "відкритися",
    description: "To begin expressing your true thoughts and feelings.",
  },
  {
    icon: "✨",
    word: "the Lord",
    translation: "Господь",
    description: "A respectful name for God in Christianity.",
  },
  {
    icon: "🥊",
    word: "to knock out",
    translation: "нокаутувати",
    description: "To hit someone so that they become unconscious, especially in a fight.",
  },
  {
    icon: "🧩",
    word: "to make sense",
    translation: "мати сенс",
    description: "To be logical, understandable, or reasonable.",
  },
  {
    icon: "🤏",
    word: "kind of (kinda)",
    translation: "ніби; типу; трохи",
    description: "Somewhat or in a way. Kinda is the informal spoken form.",
  },
  {
    icon: "🧪",
    word: "a plastic tube",
    translation: "пластикова трубка",
    description: "A long, hollow piece of plastic that carries air, liquid, or food.",
  },
  {
    icon: "🏥",
    word: "to be paralyzed from the neck down",
    translation: "бути паралізованим нижче шиї",
    description: "To be unable to move the body below the neck.",
  },
] as const;

const lexisSource = `TYPE: LEXIS
TITLE: ain't & kinda
INTRO: Two very common informal forms in spoken English.

ITEM: ain't
ICON: 🗣️
TR: не є; не; немає
SENSE: A very informal negative form that can replace am not, isn't, aren't, hasn't, or haven't.
PATTERN: subject + ain't + complement
EX: This ain't even gonna be a fight! | Це навіть не буде бій!

ITEM: kind of (kinda)
ICON: 🤏
TR: ніби; типу; трохи
SENSE: Kind of softens a statement and means somewhat. Kinda is the informal spoken spelling.
PATTERN: kind of + adjective / verb / idea
EX: It kinda doesn't make sense. | Це якось не має сенсу.`;

const [parsedLexis] = parseLexisDocuments(lexisSource);
if (!parsedLexis) throw new Error("Could not parse New Derek lexis");

const transcript = [
  {
    speaker: "Derek",
    text: "This Saturday night, this ain't even gonna be a fight! I'll mercy-kill this old man.",
  },
  {
    speaker: "The Teacher",
    text: "God chose me for this fight. God is the teacher. Derek is the student, and I'm God's instrument. When I squeeze your lungs, Derek, and you beg me for your life, your heart will open up to the Lord.",
  },
  {
    speaker: "Derek",
    text: "I'm gonna knock him out in round one, bitch. Wait, what did he say again?",
  },
  {
    speaker: "Derek",
    text: "He said God chose him? Kinda... doesn't even make sense, really.",
  },
  {
    speaker: "The Teacher",
    text: "When you eat through a plastic tube, when you're paralyzed from the neck down, your family will gather around your hospital bed to see the new Derek.",
  },
  {
    speaker: "Derek",
    text: "Okay, he... he knows we're just talking here, right?",
  },
];

const questions = [
  "Is it a good idea to fight someone who is calmly explaining what he is going to do to you?",
  "How would you feel if you had to face such an opponent during a short trash-talk exchange?",
];

async function main() {
  const [author] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!author) throw new Error("No teacher account found");

  const [existing] = await db
    .select({ id: lessonUnits.id })
    .from(lessonUnits)
    .where(ilike(lessonUnits.title, title))
    .limit(1);

  const unitValues = {
    kind: "SHORTS",
    title,
    description: "Shorts · Derek vs. The Teacher",
    vocabNodeId: null,
    lexis: [{
      id: "new-derek-lexis",
      source: lexisSource,
      title: parsedLexis.title || "ain't & kinda",
      intro: parsedLexis.subtitle || null,
      blocks: parsedLexis.blocks,
      warnings: parsedLexis.warnings,
      sourceNodeId: null,
    }],
    videoUrl: null,
    videoTitle: "Derek vs. The Teacher",
    transcript,
    questions: { afterVideo: questions, afterReading: [] },
    homework: [newDerekHomework],
    activityIds: [],
    sections: [],
    updatedAt: new Date(),
  };

  const unitId = existing?.id
    ? (await db
        .update(lessonUnits)
        .set(unitValues)
        .where(eq(lessonUnits.id, existing.id))
        .returning({ id: lessonUnits.id }))[0]?.id
    : (await db
        .insert(lessonUnits)
        .values({ authorId: author.id, ...unitValues })
        .returning({ id: lessonUnits.id }))[0]?.id;
  if (!unitId) throw new Error("Could not save New Derek lesson");

  await db.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
  await db.insert(lessonWords).values(
    vocabulary.map((entry, index) => ({
      id: randomUUID(),
      unitId,
      category: "Derek vs. The Teacher",
      ...entry,
      sortOrder: index + 1,
    })),
  );

  const assignments = await db
    .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
    .from(lessonAssignments)
    .where(eq(lessonAssignments.unitId, unitId));
  for (const assignment of assignments) {
    const openSections = new Set(assignment.openSections ?? []);
    openSections.add("homework");
    await db
      .update(lessonAssignments)
      .set({ openSections: [...openSections], updatedAt: new Date() })
      .where(eq(lessonAssignments.id, assignment.id));
  }

  console.log(JSON.stringify({
    id: unitId,
    title,
    kind: "SHORTS",
    author: author.name,
    words: vocabulary.length,
    lexis: parsedLexis.blocks.filter((block) => block.type === "word").length,
    transcript: transcript.length,
    questions: questions.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
