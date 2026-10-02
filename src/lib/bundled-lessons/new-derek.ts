import { randomUUID } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonAssignments, lessonUnits, lessonWords } from "@/lib/db/schema";
import { parseLexisDocuments } from "@/lib/keyed-parser";
import type { InteractiveHomeworkPlan } from "@/lib/lesson-homework";

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

type VocabularyDetails = {
  note: string;
  examples: { en: string; tr: string }[];
  ipaUs: string | null;
  sectionColor: string;
};

/** Full Materials-compatible payload, kept here so reinstalling the lesson is lossless. */
export const newDerekVocabularyDetails: Record<string, VocabularyDetails> = {
  mercy: {
    note: "Common patterns: show mercy, have mercy on someone, and beg for mercy.",
    examples: [
      { en: "The judge showed mercy to the young man.", tr: "Суддя змилувався над юнаком." },
      { en: "They begged the soldier for mercy.", tr: "Вони благали солдата про пощаду." },
    ],
    ipaUs: "/ˈmɜrsi/",
    sectionColor: "#ec4899",
  },
  "mercy kill": {
    note: "Mercy killing is the usual noun. The verb mercy-kill is rare and often figurative or darkly humorous.",
    examples: [
      { en: "The vet had to mercy-kill the badly injured animal.", tr: "Ветеринару довелося приспати тяжко поранену тварину, щоб припинити її страждання." },
      { en: "The fighter joked that the match would be a mercy kill.", tr: "Боєць пожартував, що цей поєдинок буде «вбивством з милосердя»." },
    ],
    ipaUs: "/ˈmɜrsi kɪl/",
    sectionColor: "#ec4899",
  },
  "old man": {
    note: "Normally an elderly man; informally, someone's father or male partner.",
    examples: [
      { en: "The old man walks in the park every morning.", tr: "Старий чоловік щоранку гуляє парком." },
      { en: "Her old man still works at the factory.", tr: "Її чоловік досі працює на заводі." },
    ],
    ipaUs: "/oʊld mæn/",
    sectionColor: "#ec4899",
  },
  "to squeeze": {
    note: "Means press firmly from two or more sides; it can also mean fit into a tight space.",
    examples: [
      { en: "Squeeze the lemon into the tea.", tr: "Вичави лимон у чай." },
      { en: "She squeezed my hand gently.", tr: "Вона ніжно стиснула мою руку." },
    ],
    ipaUs: "/skwiːz/",
    sectionColor: "#ec4899",
  },
  lungs: {
    note: "Normally used in the plural because people have two lungs.",
    examples: [
      { en: "Smoking can damage your lungs.", tr: "Куріння може пошкодити твої легені." },
      { en: "Take a deep breath and fill your lungs with air.", tr: "Зроби глибокий вдих і наповни легені повітрям." },
    ],
    ipaUs: "/lʌŋz/",
    sectionColor: "#ec4899",
  },
  "to beg for life": {
    note: "The natural phrase is beg for one's life, so the possessive changes with the person.",
    examples: [
      { en: "The prisoner began to beg for his life.", tr: "В'язень почав благати зберегти йому життя." },
      { en: "In the film, the victim begs for her life.", tr: "У фільмі жертва благає зберегти їй життя." },
    ],
    ipaUs: "/bɛɡ fɔr laɪf/",
    sectionColor: "#ec4899",
  },
  "to open up": {
    note: "Use open up to someone or open up about a subject.",
    examples: [
      { en: "It took him time to open up to his therapist.", tr: "Йому знадобився час, щоб відкритися своєму терапевту." },
      { en: "She opened up about her childhood.", tr: "Вона відверто розповіла про своє дитинство." },
    ],
    ipaUs: "/ˈoʊpən ʌp/",
    sectionColor: "#ec4899",
  },
  "the Lord": {
    note: "A respectful religious title for God; it is capitalized in this meaning.",
    examples: [
      { en: "They prayed to the Lord for help.", tr: "Вони молили Господа про допомогу." },
      { en: "He thanked the Lord for bringing them home safely.", tr: "Він подякував Господу за їхнє безпечне повернення додому." },
    ],
    ipaUs: "/ðə lɔrd/",
    sectionColor: "#ec4899",
  },
  "to knock out": {
    note: "It can make someone unconscious literally or make someone sleep very deeply.",
    examples: [
      { en: "The boxer knocked out his opponent in round two.", tr: "Боксер нокаутував суперника у другому раунді." },
      { en: "The medicine knocked me out for eight hours.", tr: "Через ліки я проспав вісім годин без пробудження." },
    ],
    ipaUs: "/nɑk aʊt/",
    sectionColor: "#ec4899",
  },
  "to make sense": {
    note: "The subject is the idea or statement: it makes sense. Do not say it has sense.",
    examples: [
      { en: "Your plan makes sense to me.", tr: "Твій план здається мені логічним." },
      { en: "This sentence does not make sense.", tr: "Це речення не має сенсу." },
    ],
    ipaUs: "/meɪk sɛns/",
    sectionColor: "#ec4899",
  },
  "kind of (kinda)": {
    note: "Kind of softens a statement. Kinda is very informal and mainly represents speech.",
    examples: [
      { en: "I am kind of tired today.", tr: "Я сьогодні трохи втомився." },
      { en: "The film was kinda strange, but I liked it.", tr: "Фільм був трохи дивним, але мені сподобався." },
    ],
    ipaUs: "/kaɪnd ʌv/",
    sectionColor: "#ec4899",
  },
  "a plastic tube": {
    note: "Tube is a hollow cylinder used to carry air, liquid, or food.",
    examples: [
      { en: "The nurse used a plastic tube to give him water.", tr: "Медсестра використала пластикову трубку, щоб дати йому води." },
      { en: "Air travels through the plastic tube.", tr: "Повітря проходить крізь пластикову трубку." },
    ],
    ipaUs: "/ə ˈplæstɪk tuːb/",
    sectionColor: "#ec4899",
  },
  "to be paralyzed from the neck down": {
    note: "Use be or become paralyzed from the neck down. Paralyzed is the American spelling; paralysed is British.",
    examples: [
      { en: "After the accident, he was paralyzed from the neck down.", tr: "Після аварії його паралізувало нижче шиї." },
      { en: "The injury left her paralyzed from the neck down.", tr: "Через травму її паралізувало нижче шиї." },
    ],
    ipaUs: null,
    sectionColor: "#ec4899",
  },
};

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

export const newDerekHomework: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "New Derek — Homework",
  exercises: [
    {
      id: "new-derek-fill",
      title: "Vocabulary 1 — Fill in the gaps",
      instruction: "Complete each sentence with a word or phrase from the list.",
      kind: "fill",
      wordBank: vocabulary.map(([, word]) => word),
      items: [
        { id: "nd-fill-mercy", prompt: "The judge showed ___ and gave the young man a lighter sentence.", answer: "mercy" },
        { id: "nd-fill-mercy-kill", prompt: "The vet had to ___ the badly injured animal to end its suffering.", answer: "mercy kill", accepted: ["mercy-kill"] },
        { id: "nd-fill-old-man", prompt: "The ___ walks slowly with a cane every morning.", answer: "old man" },
        { id: "nd-fill-squeeze", prompt: "It is easy ___ a soft ball.", answer: "to squeeze", accepted: ["squeeze"] },
        { id: "nd-fill-lungs", prompt: "Smoking can damage your ___.", answer: "lungs" },
        { id: "nd-fill-beg", prompt: "He was terrified and started ___.", answer: "to beg for life", accepted: ["begging for life"] },
        { id: "nd-fill-open-up", prompt: "She was quiet at first, but later she began ___.", answer: "to open up", accepted: ["opening up"] },
        { id: "nd-fill-lord", prompt: "They prayed to ___ before dinner.", answer: "the Lord", accepted: ["Lord"] },
        { id: "nd-fill-knock-out", prompt: "The boxer hopes ___ his opponent in the first round.", answer: "to knock out", accepted: ["knock out"] },
        { id: "nd-fill-make-sense", prompt: "For this explanation ___, we need one more fact.", answer: "to make sense", accepted: ["make sense"] },
        { id: "nd-fill-kinda", prompt: "I am ___ tired, so I will go home early.", answer: "kind of", accepted: ["kinda", "kind of (kinda)"] },
        { id: "nd-fill-tube", prompt: "The nurse used ___ to give him water.", answer: "a plastic tube", accepted: ["plastic tube"] },
        { id: "nd-fill-paralyzed", prompt: "No one wants ___ after an accident.", answer: "to be paralyzed from the neck down", accepted: ["be paralyzed from the neck down"] },
      ],
    },
    {
      id: "new-derek-describe",
      title: "Vocabulary 2 — Explain it yourself",
      instruction: "Explain each word or phrase in simple English.",
      kind: "describe",
      items: vocabulary.map(([, word], index) => ({
        id: `nd-describe-${index + 1}`,
        prompt: word,
        word,
      })),
    },
    {
      id: "new-derek-translate",
      title: "Translation — From English",
      instruction: "Translate each sentence from English.",
      kind: "translate",
      translationDirection: "from-english",
      items: [
        { id: "nd-tr-mercy", prompt: "The judge showed mercy to the young man.", answer: "Суддя проявив милосердя до молодого чоловіка." },
        { id: "nd-tr-mercy-kill", prompt: "The vet decided to mercy-kill the badly injured horse.", answer: "Ветеринар вирішив приспати тяжко пораненого коня з милосердя." },
        { id: "nd-tr-old-man", prompt: "The old man walks in the park every morning.", answer: "Старий чоловік гуляє в парку щоранку." },
        { id: "nd-tr-squeeze", prompt: "Please squeeze the lemon into the tea.", answer: "Будь ласка, вичави лимон у чай." },
        { id: "nd-tr-lungs", prompt: "Smoking can damage your lungs.", answer: "Куріння може пошкодити твої легені." },
        { id: "nd-tr-beg", prompt: "The frightened man began to beg for his life.", answer: "Наляканий чоловік почав благати зберегти йому життя." },
        { id: "nd-tr-open-up", prompt: "It is hard for him to open up to strangers.", answer: "Йому важко відкритися незнайомим людям." },
        { id: "nd-tr-lord", prompt: "They prayed to the Lord for help.", answer: "Вони молили Господа про допомогу." },
        { id: "nd-tr-knock-out", prompt: "The boxer knocked out his opponent in round two.", answer: "Боксер нокаутував суперника в другому раунді." },
        { id: "nd-tr-make-sense", prompt: "Your plan makes sense to me.", answer: "Твій план здається мені логічним." },
        { id: "nd-tr-kind-of", prompt: "I am kind of tired today.", answer: "Я сьогодні трохи втомився." },
        { id: "nd-tr-tube", prompt: "The nurse used a plastic tube to give him water.", answer: "Медсестра використала пластикову трубку, щоб дати йому води." },
        { id: "nd-tr-paralyzed", prompt: "After the accident, he was paralyzed from the neck down.", answer: "Після аварії його паралізувало нижче шиї." },
        { id: "nd-tr-aint", prompt: "This ain't gonna be easy.", answer: "Це буде нелегко." },
        { id: "nd-tr-kinda", prompt: "The film was kinda strange, but I liked it.", answer: "Фільм був трохи дивним, але мені сподобався." },
      ],
    },
  ],
};

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
      homework: [newDerekHomework],
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
        note: newDerekVocabularyDetails[word].note,
        examples: newDerekVocabularyDetails[word].examples,
        ipaUs: newDerekVocabularyDetails[word].ipaUs,
        sectionColor: newDerekVocabularyDetails[word].sectionColor,
        sortOrder: index + 1,
      })),
    );

    const assignments = await tx
      .select({ id: lessonAssignments.id, openSections: lessonAssignments.openSections })
      .from(lessonAssignments)
      .where(eq(lessonAssignments.unitId, unitId));
    for (const assignment of assignments) {
      const openSections = new Set(assignment.openSections ?? []);
      openSections.add("homework");
      await tx
        .update(lessonAssignments)
        .set({ openSections: [...openSections], updatedAt: new Date() })
        .where(eq(lessonAssignments.id, assignment.id));
    }

    return unitId;
  });
}
