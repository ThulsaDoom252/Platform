import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonUnits, lessonWords } from "@/lib/db/schema";
import { parseLexisDocuments } from "@/lib/keyed-parser";

const title = "new derek";

const vocabulary = [
  ["🙏", "mercy", "милосердя; пощада", "Kindness shown to someone you could punish or hurt."],
  ["⚡", "mercy kill", "вбивство з милосердя; швидко покінчити", "A killing intended to end suffering; here, a figurative way to say the fight will end quickly."],
  ["👴", "old man", "старий чоловік", "An elderly man; informally, it can also mean someone's father or husband."],
  ["✊", "to squeeze", "стискати", "To press something firmly from two or more sides."],
  ["🫁", "lungs", "легені", "The two organs in your chest that you use to breathe."],
  ["🛟", "to beg for life", "благати зберегти життя", "To desperately ask someone not to kill or seriously hurt you."],
  ["🚪", "to open up", "відкритися", "To begin expressing your true thoughts and feelings."],
  ["✨", "the Lord", "Господь", "A respectful name for God in Christianity."],
  ["🥊", "to knock out", "нокаутувати", "To hit someone so that they become unconscious, especially in a fight."],
  ["🧩", "to make sense", "мати сенс", "To be logical, understandable, or reasonable."],
  ["🤏", "kind of (kinda)", "ніби; типу; трохи", "Somewhat or in a way. Kinda is the informal spoken form."],
  ["🧪", "a plastic tube", "пластикова трубка", "A long, hollow piece of plastic that carries air, liquid, or food."],
  ["🏥", "to be paralyzed from the neck down", "бути паралізованим нижче шиї", "To be unable to move the body below the neck."],
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

/** Installs the bundled lesson into the database used by the running app. */
export async function installNewDerekLesson(authorId: string) {
  const [parsedLexis] = parseLexisDocuments(lexisSource);
  if (!parsedLexis) throw new Error("Could not parse New Derek lexis");

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: lessonUnits.id })
      .from(lessonUnits)
      .where(and(eq(lessonUnits.authorId, authorId), ilike(lessonUnits.title, title)))
      .limit(1);

    const unitValues = {
      kind: "SHORTS" as const,
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
      homework: [],
      activityIds: [],
      sections: [],
      updatedAt: new Date(),
    };

    const unitId = existing?.id
      ? (await tx
          .update(lessonUnits)
          .set(unitValues)
          .where(eq(lessonUnits.id, existing.id))
          .returning({ id: lessonUnits.id }))[0]?.id
      : (await tx
          .insert(lessonUnits)
          .values({ id: randomUUID(), authorId, ...unitValues })
          .returning({ id: lessonUnits.id }))[0]?.id;

    if (!unitId) throw new Error("Could not save New Derek lesson");

    await tx.delete(lessonWords).where(eq(lessonWords.unitId, unitId));
    await tx.insert(lessonWords).values(
      vocabulary.map(([icon, word, translation, description], index) => ({
        id: randomUUID(),
        unitId,
        category: "Derek vs. The Teacher",
        icon,
        word,
        translation,
        description,
        sortOrder: index + 1,
      })),
    );

    return unitId;
  });
}
