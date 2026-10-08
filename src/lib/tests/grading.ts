// Imported only by server actions and tests, never by a Client Component.
import type { TestAnswerKey, TestAnswers, TestDefinition, TestExerciseResult, TestText } from "./types";

const text = (en: string, ru: string, uk: string): TestText => ({ en, ru, uk });
const future = text("The main clause describes a real future result: use will + the base verb. The time clause uses the present simple.", "Главная часть описывает реальный будущий результат: will + начальная форма глагола. В придаточной части времени — Present Simple.", "Головна частина описує реальний майбутній результат: will + початкова форма дієслова. У підрядній частині часу — Present Simple.");
const time = text("After when, as soon as, until or once, use the present simple for future time, not will. The main clause can use will or a modal verb.", "После when, as soon as, until или once для будущего времени используем Present Simple, а не will. В главной части можно использовать will или модальный глагол.", "Після when, as soon as, until або once для майбутнього часу використовуємо Present Simple, а не will. У головній частині можна використовувати will або модальне дієслово.");
const condition = text("After if/unless, use the present simple for a real future condition. Unless means if not.", "После if/unless в реальном будущем условии нужен Present Simple. Unless означает «если не».", "Після if/unless у реальній майбутній умові потрібен Present Simple. Unless означає «якщо не».");
const hypothetical = text("Would describes a hypothetical situation; this sentence is about a real future possibility.", "Would используется для гипотетической ситуации, а здесь речь о реальной возможности в будущем.", "Would вживається для гіпотетичної ситуації, а тут ідеться про реальну можливість у майбутньому.");
const habitual = text("The present simple here would describe a habit or general fact, not the intended future result.", "Present Simple здесь описывал бы привычку или общий факт, а не ожидаемый будущий результат.", "Present Simple тут описував би звичку або загальний факт, а не очікуваний майбутній результат.");
const emphasis = text("Does + the base verb can add emphasis, but this test asks for the neutral form: gets (he + verb-s).", "Does + начальная форма может выражать усиление, но в тесте нужна нейтральная форма: gets (he + глагол с -s).", "Does + початкова форма може виражати підсилення, але в тесті потрібна нейтральна форма: gets (he + дієслово з -s).");

export const FIRST_CONDITIONAL_KEY: TestAnswerKey = { "exercise-1": {
  q1: { answer: "will give", rule: future, reasons: { "would give": hypothetical, give: habitual } },
  q2: { answer: "arrive", rule: time, reasons: { "will arrive": time, "I'm arriving": text("After 'I', another 'I'm' would repeat the subject. Use 'as soon as I arrive'.", "После I вариант I'm повторяет подлежащее. Правильно: as soon as I arrive.", "Після I варіант I'm повторює підмет. Правильно: as soon as I arrive.") } },
  q3: { answer: "will be", rule: future, reasons: { am: text("The blank is in the main clause, not the when-clause. It describes where I will be in the future.", "Пропуск находится в главной части, не в части с when. Здесь говорится о том, где я буду в будущем.", "Пропуск розташований у головній частині, не в частині з when. Тут ідеться про те, де я буду в майбутньому."), "would be": hypothetical } },
  q4: { answer: "stay", rule: condition, reasons: { "should stay": text("Here unless introduces a condition, not advice or a tentative 'should' condition. The expected neutral form is 'unless you stay'.", "Здесь unless вводит обычное условие, а не совет или особую условную конструкцию с should. Ожидаемая нейтральная форма: unless you stay.", "Тут unless вводить звичайну умову, а не пораду чи особливу умовну конструкцію з should. Очікувана нейтральна форма: unless you stay."), "will stay": condition } },
  q5: { answer: "should call", rule: text("The main clause gives advice: you should call. First conditional can use a modal (should, can, may, might), not only will.", "Главная часть даёт совет: you should call. В First Conditional возможны модальные глаголы (should, can, may, might), не только will.", "Головна частина дає пораду: you should call. У First Conditional можливі модальні дієслова (should, can, may, might), не лише will."), reasons: { "would call": hypothetical, call: text("'You call' states a habit. Advice uses 'you should call'; an imperative would omit you: 'call'.", "You call описывает привычку. Для совета нужно you should call; в повелительной форме не было бы you: call.", "You call описує звичку. Для поради потрібне you should call; у наказовій формі не було б you: call.") } },
  q6: { answer: "gets", rule: time, reasons: { "does get": emphasis, "will get": time } },
  q7: { answer: "will you go", rule: text("A question about a real future result uses will + subject + base verb: Will you go...? The if-clause stays in the present simple.", "Вопрос о реальном будущем результате: will + подлежащее + начальная форма: Will you go...? Часть с if остаётся в Present Simple.", "Питання про реальний майбутній результат: will + підмет + початкова форма: Will you go...? Частина з if залишається в Present Simple."), reasons: { "do you go": habitual, "you will go": text("This is a direct question, so invert will and you: 'Will you go?', not statement order 'you will go'.", "Это прямой вопрос: ставим will перед you — Will you go?, а не порядок утверждения you will go.", "Це пряме питання: ставимо will перед you — Will you go?, а не порядок твердження you will go.") } },
  q8: { answer: "might try", rule: text("Might + base verb expresses a possible future result. If + present simple, then a modal in the main clause is valid first conditional.", "Might + начальная форма выражает возможный будущий результат. If + Present Simple и модальный глагол в главной части — корректный First Conditional.", "Might + початкова форма виражає можливий майбутній результат. If + Present Simple та модальне дієслово в головній частині — правильний First Conditional."), reasons: { tries: habitual, "does try": text("'Does try' emphasizes a present/habitual action. The intended meaning is a future possibility: 'might try'.", "Does try усиливает настоящее действие или привычку. Здесь нужен возможный будущий результат: might try.", "Does try підсилює теперішню дію або звичку. Тут потрібен можливий майбутній результат: might try.") } },
  q9: { answer: "am", rule: time, reasons: { "will be": time, "would be": hypothetical } },
  q10: { answer: "am", rule: time, reasons: { "would be": hypothetical, "will be": time } },
} };

export function libraryTestKey(testId: string, version: number): TestAnswerKey | null {
  return testId === "first-conditional" && version === 1 ? FIRST_CONDITIONAL_KEY : null;
}

export function gradeTestExercise(test: TestDefinition, key: TestAnswerKey, exerciseId: string, answers: TestAnswers): TestExerciseResult {
  const exercise = test.exercises.find((item) => item.id === exerciseId);
  if (!exercise?.questions.length || !key[exerciseId]) throw new Error("Invalid exercise");
  const questions = exercise.questions.map((question) => {
    const itemKey = key[exerciseId][question.id];
    if (!itemKey || !question.options.includes(itemKey.answer)) throw new Error("Invalid answer key");
    const selected = answers[question.id] || null;
    if (selected !== null && !question.options.includes(selected)) throw new Error("Invalid answer");
    const correct = selected === itemKey.answer;
    const explanation = correct ? itemKey.rule : selected ? itemKey.reasons[selected] ?? itemKey.rule : text(
      `No answer was selected. This counts as an error. ${itemKey.rule.en}`,
      `Ответ не выбран. Это считается ошибкой. ${itemKey.rule.ru}`,
      `Відповідь не вибрано. Це вважається помилкою. ${itemKey.rule.uk}`,
    );
    return { id: question.id, selected, answer: itemKey.answer, correct, explanation };
  });
  const correct = questions.filter((question) => question.correct).length;
  return { exerciseId, questions, correct, total: questions.length, percent: Math.round(correct * 100 / questions.length) };
}
