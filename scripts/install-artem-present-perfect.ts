import "dotenv/config";

import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, max } from "drizzle-orm";
import { db } from "../src/lib/db";
import {
  lessonAssignments,
  lessonFolders,
  lessonUnits,
  users,
} from "../src/lib/db/schema";
import {
  addRegularLessonFocusIds,
  normalizeRegularLessonSections,
  regularSectionKey,
  type RegularLessonSection,
  type RegularLessonTone,
} from "../src/lib/regular-lesson";

const LESSON_TITLE = "Present Perfect · Clear Grammar Guide";
const FOLDER_NAME = "Grammar boost";
const STUDENT_NAME = "Artem";

const focus = (html: string) => addRegularLessonFocusIds(html.trim());

const slide = (
  id: string,
  title: string,
  tone: RegularLessonTone,
  html: string,
  defaultOpen = false,
): RegularLessonSection => ({
  id,
  title,
  tone,
  studentHtml: focus(html),
  teacherHtml: focus(html),
  defaultOpen,
});

const checkedSlide = (
  id: string,
  title: string,
  instruction: string,
  items: { prompt: string; answer: string; tip?: string }[],
): RegularLessonSection => {
  const render = (teacher: boolean) => focus(`
    <div class="support"><p>${instruction}</p></div>
    <ol class="sentence-check">
      ${items.map((item) => `<li>${item.prompt.replace(
        "___",
        teacher
          ? `<span class="blank ans">${item.answer}</span>`
          : '<span class="blank"></span>',
      )}${teacher && item.tip ? `<div class="key"><b>Почему:</b> ${item.tip}</div>` : ""}</li>`).join("")}
    </ol>
  `);
  return {
    id,
    title,
    tone: "exercise",
    studentHtml: render(false),
    teacherHtml: render(true),
    defaultOpen: false,
  };
};

const sections = normalizeRegularLessonSections([
  slide(
    "01-present-perfect-idea",
    "1 · Present Perfect — главная идея",
    "warm",
    `<h3>Прошлое, которое важно СЕЙЧАС</h3>
     <p class="big"><b>Present Perfect</b> соединяет прошлое с настоящим.</p>
     <div class="support"><p><b>PAST</b> ───────────────▶ <b>NOW</b><br/>Что-то произошло раньше, но результат, опыт или период важен сейчас.</p></div>
     <table><thead><tr><th>Пример</th><th>Что он значит сейчас?</th></tr></thead><tbody>
       <tr><td>I <g>have lost</g> my keys.</td><td>Сейчас у меня нет ключей.</td></tr>
       <tr><td>She <g>has visited</g> Rome three times.</td><td>Это её жизненный опыт к настоящему моменту.</td></tr>
       <tr><td>We <g>have lived</g> here since 2022.</td><td>Начали в 2022 году и всё ещё живём здесь.</td></tr>
       <tr><td>I <g>have finished</g> the report.</td><td>Отчёт готов сейчас.</td></tr>
     </tbody></table>
     <div class="tip"><p><b>Главный вопрос:</b> важно <i>когда именно</i> это произошло или важен <i>результат сейчас</i>? Если результат сейчас — часто нужен Present Perfect.</p></div>
     <div class="warn"><p><b>Не называй законченное время:</b> yesterday, last week, in 2020, two days ago → с ними нужен <b>Past Simple</b>.</p></div>`,
    true,
  ),
  slide(
    "02-present-perfect-formula",
    "2 · Формула Present Perfect",
    "grammar",
    `<h3>Формула</h3>
     <p class="big"><b>Subject + have / has + V3</b></p>
     <table><thead><tr><th>Тип</th><th>Формула</th><th>Пример</th></tr></thead><tbody>
       <tr><td>✅ Утверждение</td><td>I / You / We / They <g>have</g> + V3<br/>He / She / It <g>has</g> + V3</td><td>She <g>has finished</g>.<br/>They <g>have arrived</g>.</td></tr>
       <tr><td>❌ Отрицание</td><td>haven't / hasn't + V3</td><td>I <g>haven't seen</g> it.<br/>He <g>hasn't called</g>.</td></tr>
       <tr><td>❓ Вопрос</td><td>Have / Has + subject + V3?</td><td><g>Have</g> you <g>eaten</g>?<br/><g>Has</g> she <g>left</g>?</td></tr>
     </tbody></table>
     <h3>Что такое V3?</h3>
     <table><thead><tr><th>Глагол</th><th>V2</th><th>V3</th></tr></thead><tbody>
       <tr><td>work</td><td>worked</td><td><g>worked</g></td></tr>
       <tr><td>go</td><td>went</td><td><g>gone</g></td></tr>
       <tr><td>see</td><td>saw</td><td><g>seen</g></td></tr>
       <tr><td>do</td><td>did</td><td><g>done</g></td></tr>
       <tr><td>write</td><td>wrote</td><td><g>written</g></td></tr>
     </tbody></table>
     <div class="support"><p><b>Сокращения:</b> I've, you've, we've, they've · he's, she's, it's · haven't, hasn't.</p></div>
     <div class="warn"><p>После <b>have / has</b> всегда нужна <b>третья форма</b>: <b>has gone</b>, а не <i>has went</i>.</p></div>`,
  ),
  slide(
    "03-present-perfect-keywords",
    "3 · Ключевые слова",
    "grammar",
    `<h3>Сигналы Present Perfect</h3>
     <table><thead><tr><th>Слово</th><th>Значение</th><th>Пример</th></tr></thead><tbody>
       <tr><td><g>just</g></td><td>только что</td><td>I've <g>just</g> finished.</td></tr>
       <tr><td><g>already</g></td><td>уже</td><td>She has <g>already</g> left.</td></tr>
       <tr><td><g>yet</g></td><td>уже / ещё (в вопросах и отрицаниях)</td><td>Have you finished <g>yet</g>?<br/>I haven't finished <g>yet</g>.</td></tr>
       <tr><td><g>ever / never</g></td><td>когда-либо / никогда</td><td>Have you <g>ever</g> flown?<br/>I've <g>never</g> flown.</td></tr>
       <tr><td><g>recently / lately</g></td><td>недавно / в последнее время</td><td>We have travelled a lot <g>lately</g>.</td></tr>
       <tr><td><g>so far</g></td><td>пока что, к данному моменту</td><td>I've read three chapters <g>so far</g>.</td></tr>
       <tr><td><g>for</g></td><td>в течение периода</td><td>I've known her <g>for</g> ten years.</td></tr>
       <tr><td><g>since</g></td><td>с начальной точки</td><td>I've known her <g>since</g> 2016.</td></tr>
       <tr><td><g>today / this week</g></td><td>незаконченный период</td><td>I've had two meetings <g>today</g>.</td></tr>
     </tbody></table>
     <div class="tip"><p><b>Позиция:</b> just / already / ever / never обычно стоят перед V3. <b>Yet</b> обычно стоит в конце.</p></div>
     <div class="support"><p><b>FOR = сколько времени:</b> for two hours, for a week.<br/><b>SINCE = с какого момента:</b> since Monday, since 2020, since I was a child.</p></div>`,
  ),
  slide(
    "04-present-perfect-uses",
    "4 · Когда он нужен",
    "grammar",
    `<h3>Пять понятных случаев</h3>
     <table><thead><tr><th>Зачем</th><th>Пример</th><th>Смысл</th></tr></thead><tbody>
       <tr><td>🎯 Результат сейчас</td><td>I <g>have broken</g> my glasses.</td><td>Сейчас очки сломаны.</td></tr>
       <tr><td>🌍 Жизненный опыт</td><td><g>Have</g> you ever <g>been</g> to Spain?</td><td>За всю жизнь до настоящего момента.</td></tr>
       <tr><td>🔢 Количество к настоящему моменту</td><td>She <g>has watched</g> five episodes.</td><td>Пять уже просмотрено.</td></tr>
       <tr><td>⏳ Началось раньше и продолжается</td><td>We <g>have known</g> each other for years.</td><td>Знаем друг друга до сих пор.</td></tr>
       <tr><td>📰 Новая информация</td><td>The plane <g>has landed</g>.</td><td>Сообщаем свежий результат.</td></tr>
     </tbody></table>
     <div class="tip"><p>Если вопрос <b>«Сколько уже сделано?»</b> — Present Perfect подходит очень часто.</p></div>`,
  ),
  slide(
    "05-perfect-vs-past-simple",
    "5 · Present Perfect или Past Simple?",
    "grammar",
    `<h3>Результат сейчас vs законченное прошлое</h3>
     <table><thead><tr><th>Present Perfect</th><th>Past Simple</th></tr></thead><tbody>
       <tr><td>Связь с настоящим.</td><td>Законченное событие в прошлом.</td></tr>
       <tr><td>Время не сказано или период ещё продолжается.</td><td>Есть законченное время: yesterday, last…, …ago, in 2020.</td></tr>
       <tr><td>I <g>have seen</g> this film.</td><td>I <c>saw</c> it yesterday.</td></tr>
       <tr><td>She <g>has called</g> me three times today. <i>(today ещё не закончился)</i></td><td>She <c>called</c> me three times yesterday.</td></tr>
       <tr><td><g>Have</g> you <g>eaten</g>? <i>(важен результат сейчас)</i></td><td><c>Did</c> you <c>eat</c> at 8? <i>(спрашиваем о конкретном времени)</i></td></tr>
     </tbody></table>
     <div class="warn"><p>❌ I have seen him yesterday.<br/>✅ I saw him yesterday.<br/>✅ I have seen him today. <i>(если today ещё продолжается)</i></p></div>`,
  ),
  slide(
    "06-perfect-continuous-idea",
    "6 · Present Perfect Continuous — главная идея",
    "warm",
    `<h3>Процесс, который длился до настоящего момента</h3>
     <p class="big"><b>Present Perfect Continuous</b> показывает длительность или видимый результат недавнего процесса.</p>
     <div class="support"><p><b>PAST</b> ─────── процесс ───────▶ <b>NOW</b></p></div>
     <table><thead><tr><th>Пример</th><th>Что происходит?</th></tr></thead><tbody>
       <tr><td>I <g>have been studying</g> for two hours.</td><td>Начал два часа назад и всё ещё учусь.</td></tr>
       <tr><td>She <g>has been working</g> here since May.</td><td>Работает с мая до сих пор.</td></tr>
       <tr><td>You're wet. <g>Have</g> you <g>been walking</g> in the rain?</td><td>Процесс недавно закончился, но результат виден сейчас.</td></tr>
       <tr><td>I'm tired because I <g>have been running</g>.</td><td>Бег закончился недавно; сейчас видна усталость.</td></tr>
     </tbody></table>
     <div class="tip"><p><b>Главный вопрос:</b> «Как долго это происходит?» или «Какой процесс дал такой видимый результат?»</p></div>`,
  ),
  slide(
    "07-perfect-continuous-formula",
    "7 · Формула и ключевые слова",
    "grammar",
    `<h3>Формула</h3>
     <p class="big"><b>Subject + have / has + been + V-ing</b></p>
     <table><thead><tr><th>Тип</th><th>Формула</th><th>Пример</th></tr></thead><tbody>
       <tr><td>✅ Утверждение</td><td>have / has + been + V-ing</td><td>He <g>has been waiting</g>.</td></tr>
       <tr><td>❌ Отрицание</td><td>haven't / hasn't + been + V-ing</td><td>We <g>haven't been sleeping</g> well.</td></tr>
       <tr><td>❓ Вопрос</td><td>Have / Has + subject + been + V-ing?</td><td><g>How long have</g> you <g>been learning</g> English?</td></tr>
     </tbody></table>
     <h3>Ключевые слова</h3>
     <p><g>for</g> · <g>since</g> · <g>how long</g> · <g>all day</g> · <g>all morning</g> · <g>lately</g> · <g>recently</g></p>
     <table><thead><tr><th>Сигнал</th><th>Пример</th></tr></thead><tbody>
       <tr><td>How long…?</td><td><g>How long have</g> you <g>been waiting</g>?</td></tr>
       <tr><td>for + период</td><td>I've <g>been waiting for</g> forty minutes.</td></tr>
       <tr><td>since + начало</td><td>I've <g>been waiting since</g> 9 o'clock.</td></tr>
       <tr><td>all day</td><td>It <g>has been raining all day</g>.</td></tr>
     </tbody></table>`,
  ),
  slide(
    "08-perfect-vs-perfect-continuous",
    "8 · Perfect или Perfect Continuous?",
    "grammar",
    `<h3>Результат и количество vs процесс и длительность</h3>
     <table><thead><tr><th>Present Perfect</th><th>Present Perfect Continuous</th></tr></thead><tbody>
       <tr><td>Фокус на <b>результате</b>.</td><td>Фокус на <b>процессе / длительности</b>.</td></tr>
       <tr><td>I <g>have written</g> five emails.<br/><i>Пять писем готовы.</i></td><td>I <c>have been writing</c> emails for two hours.<br/><i>Важно, как долго я этим занимаюсь.</i></td></tr>
       <tr><td>She <g>has read</g> the book.<br/><i>Книга дочитана.</i></td><td>She <c>has been reading</c> the book.<br/><i>Она читала; возможно, ещё не закончила.</i></td></tr>
       <tr><td>They <g>have painted</g> the room.<br/><i>Комната покрашена.</i></td><td>They <c>have been painting</c> the room.<br/><i>Важен процесс; краска на одежде, работа могла не закончиться.</i></td></tr>
     </tbody></table>
     <div class="warn"><p><b>Глаголы состояния обычно не ставятся в Continuous:</b> know, like, love, believe, understand, want, need, own.<br/>✅ I <b>have known</b> him for years.<br/>❌ I have been knowing him for years.</p></div>
     <div class="tip"><p><b>Короткая подсказка:</b><br/>How many / how much? → чаще <b>Present Perfect</b>.<br/>How long? → чаще <b>Present Perfect Continuous</b>.</p></div>`,
  ),
  checkedSlide(
    "09-quick-check",
    "9 · Быстрая проверка",
    "Вставь правильную форму глагола. Сначала реши, важен результат или процесс.",
    [
      { prompt: "I ___ (lose) my phone. I can't find it anywhere.", answer: "have lost", tip: "важен результат сейчас — телефона нет" },
      { prompt: "She ___ (study) since 8 a.m., and she still isn't finished.", answer: "has been studying", tip: "процесс продолжается и указана длительность" },
      { prompt: "We ___ (visit) this museum three times.", answer: "have visited", tip: "важно количество завершённых посещений" },
      { prompt: "Look at your hands! ___ (you / paint)?", answer: "Have you been painting", tip: "виден результат недавнего процесса" },
      { prompt: "He ___ (already / finish) the task.", answer: "has already finished", tip: "already + готовый результат" },
      { prompt: "How long ___ (they / wait)?", answer: "have they been waiting", tip: "How long спрашивает о длительности процесса" },
      { prompt: "I ___ (know) Artem for five years.", answer: "have known", tip: "know — глагол состояния, не Continuous" },
      { prompt: "I ___ (see) him yesterday.", answer: "saw", tip: "yesterday — законченное прошлое, поэтому Past Simple" },
    ],
  ),
]);

if (sections.length !== 9) throw new Error(`Expected 9 sections, got ${sections.length}`);

async function main() {
  const [teacher] = await db
    .select({ id: users.id, name: users.name, classWithId: users.classWithId })
    .from(users)
    .where(eq(users.role, "TEACHER"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!teacher) throw new Error("No teacher account found");

  const [student] = await db
    .select({ id: users.id, name: users.name, classFocus: users.classFocus })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), ilike(users.name, STUDENT_NAME)))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!student) throw new Error(`Student ${STUDENT_NAME} was not found`);

  let [folder] = await db
    .select({ id: lessonFolders.id })
    .from(lessonFolders)
    .where(and(eq(lessonFolders.authorId, teacher.id), ilike(lessonFolders.name, FOLDER_NAME)))
    .limit(1);
  if (!folder) {
    [folder] = await db
      .insert(lessonFolders)
      .values({ authorId: teacher.id, name: FOLDER_NAME })
      .returning({ id: lessonFolders.id });
  }
  if (!folder) throw new Error("Could not find or create Grammar boost folder");

  const [existing] = await db
    .select({ id: lessonUnits.id, sortOrder: lessonUnits.sortOrder })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, teacher.id), ilike(lessonUnits.title, LESSON_TITLE)))
    .limit(1);
  const [lastOrder] = await db
    .select({ value: max(lessonUnits.sortOrder) })
    .from(lessonUnits)
    .where(and(eq(lessonUnits.authorId, teacher.id), eq(lessonUnits.folderId, folder.id)));
  const sortOrder = existing?.sortOrder ?? Number(lastOrder?.value ?? 0) + 10;

  const unitValues = {
    kind: "REGULAR" as const,
    title: LESSON_TITLE,
    description: "Visual grammar presentation · Present Perfect and Present Perfect Continuous · formulas, keywords, timelines and examples",
    folderId: folder.id,
    sortOrder,
    vocabNodeId: null,
    lexis: null,
    videoUrl: null,
    videoTitle: null,
    transcript: [],
    questions: { afterVideo: [], afterReading: [] },
    homework: [],
    activityIds: [],
    sections,
    updatedAt: new Date(),
  };

  const result = await db.transaction(async (tx) => {
    const unitId = existing?.id
      ? (await tx
          .update(lessonUnits)
          .set(unitValues)
          .where(eq(lessonUnits.id, existing.id))
          .returning({ id: lessonUnits.id }))[0]?.id
      : (await tx
          .insert(lessonUnits)
          .values({ id: randomUUID(), authorId: teacher.id, ...unitValues })
          .returning({ id: lessonUnits.id }))[0]?.id;
    if (!unitId) throw new Error("Could not save the grammar presentation");

    const [assigned] = await tx
      .select({ id: lessonAssignments.id })
      .from(lessonAssignments)
      .where(and(eq(lessonAssignments.unitId, unitId), eq(lessonAssignments.studentId, student.id)))
      .limit(1);
    const openSections = sections.map((section) => regularSectionKey(section.id));
    const assignmentId = assigned?.id
      ? (await tx
          .update(lessonAssignments)
          .set({
            openSections,
            contentOverride: null,
            finishedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(lessonAssignments.id, assigned.id))
          .returning({ id: lessonAssignments.id }))[0]?.id
      : (await tx
          .insert(lessonAssignments)
          .values({ unitId, studentId: student.id, openSections })
          .returning({ id: lessonAssignments.id }))[0]?.id;
    if (!assignmentId) throw new Error("Could not assign the presentation to Artem");

    await tx
      .update(users)
      .set({
        classFocus: {
          panel: student.classFocus?.panel ?? "lesson",
          at: new Date().toISOString(),
          lessonAssignmentId: assignmentId,
        },
      })
      .where(eq(users.id, student.id));

    return { unitId, assignmentId };
  });

  console.log(JSON.stringify({
    ...result,
    title: LESSON_TITLE,
    folder: FOLDER_NAME,
    teacher: teacher.name,
    student: student.name,
    activeClassStudent: teacher.classWithId === student.id,
    sections: sections.length,
    openSections: sections.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
