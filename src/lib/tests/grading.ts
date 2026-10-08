// Imported only by server actions and tests, never by a Client Component.
import type { TestAnswer, TestAnswerKey, TestAnswers, TestDefinition, TestExerciseResult, TestText } from "./types";

const text = (en: string, ru: string, uk: string): TestText => ({ en, ru, uk });
const future = text("The main clause describes a real future result: use will + the base verb. The time clause uses the present simple.", "Главная часть описывает реальный будущий результат: will + начальная форма глагола. В придаточной части времени — Present Simple.", "Головна частина описує реальний майбутній результат: will + початкова форма дієслова. У підрядній частині часу — Present Simple.");
const time = text("After when, as soon as, before, after, until or once, use the present simple for future time, not will. The main clause can use will or a modal verb.", "После when, as soon as, before, after, until или once для будущего времени используем Present Simple, а не will. В главной части можно использовать will или модальный глагол.", "Після when, as soon as, before, after, until або once для майбутнього часу використовуємо Present Simple, а не will. У головній частині можна використовувати will або модальне дієслово.");
const condition = text("After if/unless, use the present simple for a real future condition. Unless means if not.", "После if/unless в реальном будущем условии нужен Present Simple. Unless означает «если не».", "Після if/unless у реальній майбутній умові потрібен Present Simple. Unless означає «якщо не».");
const hypothetical = text("Would describes a hypothetical situation; this sentence is about a real future possibility.", "Would используется для гипотетической ситуации, а здесь речь о реальной возможности в будущем.", "Would вживається для гіпотетичної ситуації, а тут ідеться про реальну можливість у майбутньому.");
const habitual = text("The present simple here would describe a habit or general fact, not the intended future result.", "Present Simple здесь описывал бы привычку или общий факт, а не ожидаемый будущий результат.", "Present Simple тут описував би звичку або загальний факт, а не очікуваний майбутній результат.");
const emphasis = text("Does + the base verb can add emphasis, but this test asks for the neutral form: gets (he + verb-s).", "Does + начальная форма может выражать усиление, но в тесте нужна нейтральная форма: gets (he + глагол с -s).", "Does + початкова форма може виражати підсилення, але в тесті потрібна нейтральна форма: gets (he + дієслово з -s).");
const modalResult = text("Choose both forms: will + base verb for a future result, and might/should + base verb for possibility/advice. The bare present simple is not the intended future result.", "Выбери обе формы: will + глагол для будущего результата и might/should + глагол для возможности или совета. Обычный Present Simple не передаёт ожидаемый будущий результат.", "Вибери обидві форми: will + дієслово для майбутнього результату та might/should + дієслово для можливості чи поради. Звичайний Present Simple не передає очікуваний майбутній результат.");

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
}, "exercise-2": {
  q1: { answer: ["might get", "will get"], rule: modalResult, reasons: { get: habitual } },
  q2: { answer: "doesn't open", rule: condition, reasons: { "won't open": condition, "might not open": condition } },
  q3: { answer: "is", rule: condition, reasons: { "must be": condition, "will be": condition } },
  q4: { answer: "see", rule: time, reasons: { "will see": time, "might see": time } },
  q5: { answer: ["should buy", "will buy"], rule: modalResult, reasons: { buy: habitual } },
  q6: { answer: ["might have", "'ll have"], rule: modalResult, reasons: { have: habitual } },
  q7: { answer: "leave", rule: time, reasons: { "must leave": time, "will leave": time } },
  q8: { answer: "knows", rule: condition, reasons: { "will know": condition, "would know": hypothetical } },
  q9: { answer: ["let me explain", "you must listen to me"], rule: text("The main clause can give an instruction (let me explain) or use a modal (you must listen to me). Select both. The expected neutral instruction is not the present-simple statement 'you listen to me'.", "В главной части возможны просьба (let me explain) и модальный глагол (you must listen to me). Выбери оба варианта. Обычное утверждение you listen to me — не ожидаемая нейтральная форма инструкции.", "У головній частині можливі прохання (let me explain) і модальне дієслово (you must listen to me). Вибери обидва варіанти. Звичайне твердження you listen to me — не очікувана нейтральна форма інструкції."), reasons: {} },
  q10: { answer: "is", rule: condition, reasons: { "will be": condition, "might be": condition } },
}, "exercise-3": {
  q1: { answer: "does not arrive", acceptedAnswers: ["doesn't arrive"], rule: condition, reasons: {} },
  q2: { answer: "will miss", acceptedAnswers: ["'ll miss"], rule: future, reasons: {} },
  q3: { answer: "will have to", acceptedAnswers: ["'ll have to"], rule: future, reasons: {} },
  q4: { answer: "get", rule: time, reasons: {} },
  q5: { answer: "will text", acceptedAnswers: ["'ll text"], rule: future, reasons: {} },
  q6: { answer: "check in", rule: time, reasons: {} },
  q7: { answer: "will look for", acceptedAnswers: ["'ll look for"], rule: future, reasons: {} },
  q8: { answer: "do not surf", acceptedAnswers: ["don't surf"], rule: condition, reasons: {} },
  q9: { answer: "is not", acceptedAnswers: ["'s not", "isn't"], rule: condition, reasons: {} },
  q10: { answer: "will be", acceptedAnswers: ["'ll be"], rule: future, reasons: {} },
  q11: { answer: "is", rule: condition, reasons: {} },
  q12: { answer: "will have", acceptedAnswers: ["'ll have"], rule: future, reasons: {} },
  q13: { answer: "check in", rule: time, reasons: {} },
  q14: { answer: "will you water", rule: text("Use will + subject + base verb in a future question: Will you water...? The condition after if uses the present simple.", "В вопросе о будущем: will + подлежащее + глагол — Will you water...? Условие после if выражается в Present Simple.", "У питанні про майбутнє: will + підмет + дієслово — Will you water...? Умова після if виражається в Present Simple."), reasons: {} },
  q15: { answer: "promise", rule: condition, reasons: {} },
} };

export function libraryTestKey(testId: string, version: number): TestAnswerKey | null {
  if (testId !== "first-conditional") return null;
  if (version === 1) return { "exercise-1": FIRST_CONDITIONAL_KEY["exercise-1"] };
  return version === 2 ? FIRST_CONDITIONAL_KEY : null;
}

const normalizeText = (value: string) => value.trim().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").toLowerCase();

export function gradeTestExercise(test: TestDefinition, key: TestAnswerKey, exerciseId: string, answers: TestAnswers): TestExerciseResult {
  const exercise = test.exercises.find((item) => item.id === exerciseId);
  if (!exercise?.questions.length || !key[exerciseId]) throw new Error("Invalid exercise");
  const questions = exercise.questions.map((question) => {
    const itemKey = key[exerciseId][question.id];
    if (!itemKey) throw new Error("Invalid answer key");
    const raw = answers[question.id] ?? null;
    let selected: TestAnswer = null;
    let correct = false;
    let reason: TestText | undefined;
    if (question.kind === "multiple") {
      const expected = itemKey.answer;
      const count = question.selectionCount ?? 2;
      if (!Array.isArray(expected) || expected.length !== count || new Set(expected).size !== count || expected.some((value) => !question.options.includes(value))) throw new Error("Invalid answer key");
      if (raw !== null && (!Array.isArray(raw) || raw.length > count || new Set(raw).size !== raw.length || raw.some((value) => !question.options.includes(value)))) throw new Error("Invalid answer");
      selected = Array.isArray(raw) && raw.length ? question.options.filter((value) => raw.includes(value)) : null;
      correct = Array.isArray(selected) && selected.length === expected.length && selected.every((value) => expected.includes(value));
      const wrongOption = Array.isArray(selected) && selected.find((value) => !expected.includes(value));
      if (wrongOption) reason = itemKey.reasons[wrongOption];
    } else {
      if (typeof itemKey.answer !== "string" || question.kind !== "text" && !question.options.includes(itemKey.answer)) throw new Error("Invalid answer key");
      if (raw !== null && (typeof raw !== "string" || raw.length > 200)) throw new Error("Invalid answer");
      selected = typeof raw === "string" && raw.trim() ? raw.trim() : null;
      if (question.kind === "text") {
        correct = selected !== null && [itemKey.answer, ...(itemKey.acceptedAnswers ?? [])].some((value) => normalizeText(value) === normalizeText(selected as string));
      } else {
        if (selected !== null && !question.options.includes(selected)) throw new Error("Invalid answer");
        correct = selected === itemKey.answer;
      }
      if (selected !== null) reason = itemKey.reasons[selected];
    }
    const explanation = correct || selected === null ? itemKey.rule : reason ?? itemKey.rule;
    return { id: question.id, selected, answer: itemKey.answer, correct, explanation };
  });
  const correct = questions.filter((question) => question.correct).length;
  return { exerciseId, questions, correct, total: questions.length, percent: Math.round(correct * 100 / questions.length) };
}
