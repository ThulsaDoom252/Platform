import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  users,
  lessons,
  homework,
  materialNodes,
  notifications,
  lessonPackages,
  studentMaterials,
  materialPhrases,
} from "./schema";
import { eq, sql } from "drizzle-orm";
import {
  sportPage,
  upbringingPage,
  wordplayPage,
  governmentPage,
  changesPage,
  mixPage,
  type SeedPage,
} from "./content";

const NOW = new Date();

/**
 * Обязательная переменная окружения.
 * Учётные данные не хранятся в коде — они приходят из .env, которого нет в репозитории.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Не задана переменная окружения ${name}. ` +
        `Скопируй .env.example в .env и заполни значения.`,
    );
  }
  return value;
}

/** Дата в текущем месяце: день + час (локальное время). */
function at(day: number, hour: number, minute = 0) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), day, hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("Очищаю таблицы...");
  await db.execute(sql`TRUNCATE TABLE
    material_phrases,
    notifications,
    contact_change_requests,
    wishlist_notes,
    vocabulary_words,
    homework,
    student_materials,
    lessons,
    material_nodes,
    users,
    lesson_packages
    RESTART IDENTITY CASCADE`);

  console.log("Создаю учителя...");
  const teacherName = requireEnv("TEACHER_NAME");
  const teacherLogin = requireEnv("TEACHER_LOGIN");
  const teacherPassword = requireEnv("TEACHER_PASSWORD");

  const [vlad] = await db
    .insert(users)
    .values({
      name: teacherName,
      login: teacherLogin,
      passwordHash: await bcrypt.hash(teacherPassword, 10),
      role: "TEACHER",
      locale: "ru",
    })
    .returning();

  console.log("Создаю общий пакет уроков (50, до 02.03.2027)...");
  // Общий пул на двоих: 50 уроков доступны прямо сейчас.
  const [pkg] = await db
    .insert(lessonPackages)
    .values({
      name: "Olexander + Sofia",
      totalLessons: 50,
      remainingLessons: 50,
      expiresAt: new Date(2027, 2, 2, 23, 59, 0, 0), // 02.03.2027
    })
    .returning();

  console.log("Создаю учеников...");
  const studentPassword = requireEnv("STUDENT_DEFAULT_PASSWORD");
  const demoHash = await bcrypt.hash(studentPassword, 10);

  const [olexander] = await db
    .insert(users)
    .values({
      name: "Olexander",
      login: "olexander",
      passwordHash: demoHash,
      role: "STUDENT",
      level: "B1 · Intermediate",
      progressPercent: 72,
      lessonBalance: pkg.remainingLessons,
      packageId: pkg.id,
    })
    .returning();

  const [sofia] = await db
    .insert(users)
    .values({
      name: "Sofia",
      login: "sofia",
      passwordHash: demoHash,
      role: "STUDENT",
      level: "A2 · Elementary",
      progressPercent: 64,
      lessonBalance: pkg.remainingLessons,
      packageId: pkg.id,
    })
    .returning();

  console.log("Создаю уроки...");
  // Прошедшие уроки — в графике будут зелёными.
  const past = [
    { student: olexander.id, day: 14, hour: 14, topic: "Speaking Practice" },
    { student: olexander.id, day: 16, hour: 14, topic: "Grammar Focus" },
    { student: olexander.id, day: 18, hour: 14, topic: "Conversation" },
    { student: sofia.id, day: 14, hour: 12, topic: "Vocabulary" },
    { student: sofia.id, day: 18, hour: 15, topic: "Listening Skills" },
  ];
  for (const l of past) {
    await db.insert(lessons).values({
      studentId: l.student,
      startTime: at(l.day, l.hour),
      topic: l.topic,
      status: "COMPLETED",
    });
  }

  console.log("Создаю дерево материалов...");

  /** Создаёт узел и возвращает его id. */
  async function node(v: {
    name: string;
    icon?: string;
    type?: "FOLDER" | "FILE";
    parentId?: string | null;
    fileKind?: string;
    category?: string;
    sizeLabel?: string;
    sortOrder?: number;
    description?: string;
  }) {
    const [row] = await db
      .insert(materialNodes)
      .values({
        name: v.name,
        icon: v.icon ?? null,
        type: v.type ?? "FOLDER",
        parentId: v.parentId ?? null,
        fileKind: v.fileKind ?? null,
        category: v.category ?? null,
        sizeLabel: v.sizeLabel ?? null,
        sortOrder: v.sortOrder ?? 0,
        description: v.description ?? null,
      })
      .returning();
    return row.id;
  }

  /** Страница материала из файла контента: узел + все его фразы. */
  async function seedPage(parentId: string, page: SeedPage, sortOrder: number) {
    const id = await node({
      name: page.name,
      icon: page.icon,
      type: "FILE",
      parentId,
      sortOrder,
      description: page.description,
    });
    let i = 1;
    for (const p of page.phrases) {
      await db.insert(materialPhrases).values({
        nodeId: id,
        sortOrder: i++,
        icon: p.icon ?? null,
        phrase: p.phrase,
        transcription: p.transcription ?? null,
        translation: p.translation,
        section: p.section ?? null,
        kind: p.kind ?? "PHRASE",
        examples: p.examples ?? [],
      });
    }
    return id;
  }

  /** Фразы внутри страницы материала. */
  async function phrases(
    nodeId: string,
    items: {
      icon: string;
      phrase: string;
      translation: string;
      examples: { en: string; tr: string }[];
    }[],
  ) {
    let i = 1;
    for (const p of items) {
      await db.insert(materialPhrases).values({
        nodeId,
        sortOrder: i++,
        icon: p.icon,
        phrase: p.phrase,
        translation: p.translation,
        examples: p.examples,
      });
    }
  }

  /** Несколько учебных файлов внутри подкатегории. */
  async function files(
    parentId: string,
    items: [string, string, string, string][], // name, icon, kind, size
  ) {
    let i = 1;
    for (const [name, icon, kind, size] of items) {
      await node({
        name,
        icon,
        type: "FILE",
        parentId,
        fileKind: kind,
        sizeLabel: size,
        sortOrder: i++,
      });
    }
  }

  // ---- 📚 Vocabulary ----
  const vocabulary = await node({ name: "Vocabulary", icon: "📚", sortOrder: 1 });

  const c1 = await node({ name: "C1", icon: "😎", parentId: vocabulary, sortOrder: 1 });
  await seedPage(c1, sportPage, 1);
  await seedPage(c1, upbringingPage, 2);
  await seedPage(c1, wordplayPage, 3);
  await seedPage(c1, governmentPage, 4);

  const idioms = await node({ name: "Idioms", icon: "🤪", parentId: vocabulary, sortOrder: 2 });

  // --- Biting the bullet ---
  const biting = await node({
    name: "Biting the bullet",
    icon: "🌬️",
    type: "FILE",
    parentId: idioms,
    sortOrder: 1,
    description:
      "Idioms & Fixed Expressions — фрази про рішення, емоції та поведінку",
  });
  await phrases(biting, [
    {
      icon: "😬",
      phrase: "to bite the bullet",
      translation: "зібратися з духом / змиритися з неминучим",
      examples: [
        {
          en: "I hate going to the dentist, but I'll have to bite the bullet.",
          tr: "Я ненавиджу ходити до стоматолога, але доведеться зібратися з духом.",
        },
        {
          en: "We bit the bullet and paid for the repairs.",
          tr: "Ми змирилися з неминучим і заплатили за ремонт.",
        },
      ],
    },
    {
      icon: "🌧️",
      phrase: "doom and gloom",
      translation: "суцільний песимізм / похмурі прогнози",
      examples: [
        {
          en: "The news report was full of doom and gloom.",
          tr: "У новинному сюжеті були лише похмурі прогнози.",
        },
        {
          en: "Despite all the doom and gloom, the project succeeded.",
          tr: "Попри весь песимізм, проєкт завершився успішно.",
        },
      ],
    },
    {
      icon: "🥊",
      phrase: "to give as good as one gets",
      translation: "давати гідну відсіч / відповідати тим самим",
      examples: [
        {
          en: "Don't worry about Anna; she can give as good as she gets.",
          tr: "Не хвилюйся за Анну: вона вміє дати гідну відсіч.",
        },
        {
          en: "He was criticized, but he gave as good as he got.",
          tr: "Його критикували, але він відповідав тим самим.",
        },
      ],
    },
    {
      icon: "🏁",
      phrase: "to jump the gun",
      translation: "випередити події / почати надто рано",
      examples: [
        {
          en: "We jumped the gun and announced the result too early.",
          tr: "Ми випередили події й оголосили результат надто рано.",
        },
        {
          en: "Don't jump the gun; wait for the official decision.",
          tr: "Не поспішай; дочекайся офіційного рішення.",
        },
      ],
    },
    {
      icon: "🛋️",
      phrase: "the lap of luxury",
      translation: "розкішне життя / у розкоші",
      examples: [
        {
          en: "They spent their holiday in the lap of luxury.",
          tr: "Вони провели відпустку в розкоші.",
        },
        {
          en: "After years of hard work, she now lives in the lap of luxury.",
          tr: "Після років наполегливої праці вона тепер живе в розкоші.",
        },
      ],
    },
    {
      icon: "💔",
      phrase: "no love lost (between ...)",
      translation: "взаємна неприязнь / відсутність взаємної симпатії",
      examples: [
        {
          en: "There is no love lost between the two managers.",
          tr: "Двоє керівників відверто недолюблюють одне одного.",
        },
        {
          en: "There was no love lost between the rival teams.",
          tr: "Між командами-суперниками не було жодної симпатії.",
        },
      ],
    },
    {
      icon: "👅",
      phrase: "on the tip of my tongue",
      translation: "крутиться в мене на язиці / от-от згадаю",
      examples: [
        {
          en: "Her name is on the tip of my tongue.",
          tr: "Її ім'я крутиться в мене на язиці.",
        },
        {
          en: "The answer was on the tip of his tongue, but he couldn't remember it.",
          tr: "Відповідь крутилася в нього на язиці, але він не міг її згадати.",
        },
      ],
    },
  ]);

  // --- Smoking like a chimney ---
  const smoking = await node({
    name: "Smoking like a chimney",
    icon: "🚬",
    type: "FILE",
    parentId: idioms,
    sortOrder: 2,
    description:
      "Similes & Idioms — фрази про пам'ять, звички, почуття та відмінності",
  });
  await phrases(smoking, [
    {
      icon: "🦠",
      phrase: "to avoid someone like the plague",
      translation: "уникати когось як чуми / всіляко уникати когось",
      examples: [
        {
          en: "I avoid my former boss like the plague.",
          tr: "Я уникаю свого колишнього начальника як чуми.",
        },
        {
          en: "Since their argument, she has avoided him like the plague.",
          tr: "Після їхньої сварки вона всіляко його уникає.",
        },
      ],
    },
    {
      icon: "🧀",
      phrase: "to be like chalk and cheese",
      translation: "бути абсолютно різними / бути як небо і земля",
      examples: [
        {
          en: "My brother and I are like chalk and cheese.",
          tr: "Ми з братом зовсім різні — як небо і земля.",
        },
        {
          en: "The two designs are like chalk and cheese.",
          tr: "Ці два дизайни кардинально відрізняються.",
        },
      ],
    },
    {
      icon: "🐠",
      phrase: "to feel like a fish out of water",
      translation: "почуватися не у своїй тарілці / почуватися ніяково",
      examples: [
        {
          en: "I felt like a fish out of water at the formal dinner.",
          tr: "На офіційній вечері я почувався не у своїй тарілці.",
        },
        {
          en: "She feels like a fish out of water in her new job.",
          tr: "На новій роботі вона почувається ніяково й невпевнено.",
        },
      ],
    },
    {
      icon: "🧠",
      phrase: "to have a memory like a sieve",
      translation: "мати пам'ять як решето / мати дуже погану пам'ять",
      examples: [
        {
          en: "I've got a memory like a sieve — I forgot his name again.",
          tr: "У мене пам'ять як решето — я знову забув його ім'я.",
        },
        {
          en: "If you have a memory like a sieve, write everything down.",
          tr: "Якщо у вас дуже погана пам'ять, усе записуйте.",
        },
      ],
    },
    {
      icon: "🏭",
      phrase: "to smoke like a chimney",
      translation: "курити як паровоз / дуже багато курити",
      examples: [
        {
          en: "He smokes like a chimney and coughs all the time.",
          tr: "Він курить як паровоз і постійно кашляє.",
        },
        {
          en: "She used to smoke like a chimney, but she has quit.",
          tr: "Раніше вона дуже багато курила, але вже кинула.",
        },
      ],
    },
  ]);

  // --- Hard as nails (Similes & Idioms) ---
  const hardAsNails = await node({
    name: "Hard as nails",
    icon: "🏋️",
    type: "FILE",
    parentId: idioms,
    sortOrder: 3,
    description: "Similes & Idioms — фрази про силу, враження та зрозумілість",
  });
  await phrases(hardAsNails, [
    {
      icon: "💪",
      phrase: "He's as hard as nails",
      translation: "він дуже витривалий / незламний / жорсткий",
      examples: [
        {
          en: "My grandfather is as hard as nails and never complains.",
          tr: "Мій дідусь дуже витривалий і ніколи не скаржиться.",
        },
        {
          en: "The coach may seem strict, but she's as hard as nails.",
          tr: "Тренерка може здаватися суворою, але вона незламна.",
        },
      ],
    },
    {
      icon: "🐦",
      phrase: "It's as dead as a dodo",
      translation: "це повністю зникло / безнадійно застаріло / більше не вживається",
      examples: [
        {
          en: "That old technology is as dead as a dodo.",
          tr: "Та стара технологія безнадійно застаріла.",
        },
        {
          en: "By the end of the decade, this fashion trend was as dead as a dodo.",
          tr: "До кінця десятиліття цей модний тренд повністю зник.",
        },
      ],
    },
    {
      icon: "😱",
      phrase: "She went as white as a sheet",
      translation: "вона зблідла / стала білою як полотно",
      examples: [
        {
          en: "She went as white as a sheet when she heard the news.",
          tr: "Вона стала білою як полотно, коли почула новину.",
        },
        {
          en: "He was as white as a sheet after the accident.",
          tr: "Після аварії він був дуже блідий.",
        },
      ],
    },
    {
      icon: "⛰️",
      phrase: "That joke is as old as the hills",
      translation: "цей жарт старий як світ / дуже давній",
      examples: [
        { en: "That joke is as old as the hills.", tr: "Цей жарт старий як світ." },
        {
          en: "Their family tradition is as old as the hills.",
          tr: "Їхня сімейна традиція дуже давня.",
        },
      ],
    },
    {
      icon: "🌫️",
      phrase: "That's as clear as mud",
      translation: "це зовсім незрозуміло / ясно, як болото (саркастично)",
      examples: [
        {
          en: "His explanation was as clear as mud.",
          tr: "Після його пояснення нічого не стало зрозуміліше.",
        },
        {
          en: "The new instructions are as clear as mud.",
          tr: "Нові інструкції зовсім незрозумілі.",
        },
      ],
    },
  ]);

  const bonuses = await node({ name: "bonuses", icon: "➕", parentId: vocabulary, sortOrder: 3 });
  await seedPage(bonuses, changesPage, 1);
  await seedPage(bonuses, mixPage, 2);

  // ---- 🦜 Phrasal verbs ----
  const phrasal = await node({ name: "Phrasal verbs", icon: "🦜", sortOrder: 2 });
  const work = await node({ name: "work", icon: "💼", parentId: phrasal, sortOrder: 1 });
  await files(work, [
    ["Work & office verbs", "🏢", "PDF", "1.3 MB"],
    ["Practice sheet", "📝", "DOC", "0.6 MB"],
  ]);

  // ---- ✅ Rules ----
  const rules = await node({ name: "Rules", icon: "✅", sortOrder: 3 });

  const basics = await node({ name: "Basics", icon: "🧱", parentId: rules, sortOrder: 1 });
  await files(basics, [
    ["Word order", "🔤", "PDF", "1.0 MB"],
    ["Questions & negatives", "❓", "PDF", "1.2 MB"],
  ]);

  const articles = await node({ name: "Articles", icon: "🔮", parentId: rules, sortOrder: 2 });
  await files(articles, [
    ["a / an / the", "🔠", "PDF", "0.9 MB"],
    ["Zero article", "⭕", "DOC", "0.5 MB"],
  ]);

  const lexic = await node({ name: "Lexic", icon: "🧐", parentId: rules, sortOrder: 3 });
  await files(lexic, [
    ["Confusing pairs", "🔀", "PDF", "1.1 MB"],
    ["Word formation", "🧩", "PDF", "1.5 MB"],
  ]);

  const clefts = await node({ name: "Clefts", icon: "✂️", parentId: rules, sortOrder: 4 });
  await files(clefts, [
    ["It-clefts", "📐", "PDF", "0.8 MB"],
    ["What-clefts", "📏", "DOC", "0.7 MB"],
  ]);

  const conditionals = await node({ name: "Conditionals", icon: "↔️", parentId: rules, sortOrder: 5 });
  await files(conditionals, [
    ["Types 0–3", "🔢", "PDF", "1.6 MB"],
    ["Mixed conditionals", "🌀", "PDF", "1.2 MB"],
  ]);

  await node({ name: "Modal Perfect", icon: "🙃", type: "FILE", parentId: rules, fileKind: "PDF", sizeLabel: "1.3 MB", sortOrder: 6 });
  await node({ name: "Object sentences", icon: "🧠", type: "FILE", parentId: rules, fileKind: "DOC", sizeLabel: "0.9 MB", sortOrder: 7 });

  // ---- 🕹️ Activities ----
  const activities = await node({ name: "Activities", icon: "🕹️", sortOrder: 4 });
  const speakingGames = await node({ name: "Speaking games", icon: "🎭", parentId: activities, sortOrder: 1 });
  await files(speakingGames, [
    ["Role-play cards", "🃏", "PDF", "2.0 MB"],
    ["Board game: Talk a lot", "🎲", "PPT", "6.1 MB"],
  ]);
  await node({ name: "Listening quiz", icon: "🎬", type: "FILE", parentId: activities, fileKind: "MP3", sizeLabel: "5.4 MB", sortOrder: 2 });

  console.log("Назначаю материалы Olexander...");
  await db.insert(studentMaterials).values(
    [vocabulary, phrasal, rules, activities].map((id) => ({
      studentId: olexander.id,
      materialNodeId: id,
    })),
  );

  console.log("Создаю домашние задания...");
  await db.insert(homework).values([
    {
      studentId: olexander.id,
      title: "Past Simple — упражнения 1-6",
      description: "Заполни пропуски правильной формой глагола.",
      status: "NOT_DONE",
    },
    {
      studentId: sofia.id,
      title: "Travel Vocabulary — карточки",
      description: "Выучить 20 слов из списка.",
      status: "SUBMITTED",
    },
  ]);

  console.log("Создаю уведомления...");
  await db.insert(notifications).values({
    recipientId: vlad.id,
    type: "HOMEWORK_SUBMITTED",
    message: "Sofia сдала домашнее задание: «Travel Vocabulary — карточки».",
    relatedStudentId: sofia.id,
    isRead: false,
  });

  // Страховка: остаток пакета зеркалится обоим участникам.
  await db
    .update(users)
    .set({ lessonBalance: pkg.remainingLessons })
    .where(eq(users.packageId, pkg.id));

  console.log("");
  console.log("Готово.");
  console.log(`  Пакет: остаток ${pkg.remainingLessons} из ${pkg.totalLessons}, до 02.03.2027`);
  console.log(`  Учитель — логин: ${teacherLogin} (пароль из TEACHER_PASSWORD)`);
  console.log("  Ученики — olexander / sofia (пароль из STUDENT_DEFAULT_PASSWORD)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
