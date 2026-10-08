import type { Locale } from "@/lib/i18n";

const en = {
  tests: "Tests", exercise: "Exercise", questions: "questions", exercises: "exercises",
  open: "Open test", practice: "Teacher practice", practiceHint: "Try the test yourself. Your answers do not change any student's results.",
  assign: "Assign to a student", student: "Student", chooseStudent: "Choose a student", all: "Whole test", selected: "Selected exercises",
  available: "Only published exercises are included. New exercises are not added to existing homework automatically.",
  pending: "This exercise has not been added yet.", pendingHint: "Exercise 1 is ready. Exercises 2 and 3 will appear here when their tasks are added.",
  choose: "Choose an answer", check: "Check the answers", checking: "Checking…", correctAnswer: "Correct answer", noAnswer: "No answer",
  completed: "Test completed!", exerciseCompleted: "Exercise completed!", correctAnswers: "Correct answers", errors: "Mistakes & explanations",
  noErrors: "No mistakes. Well done!", overall: "Overall result", checked: "Exercises checked", unfinished: "Check the remaining exercises to complete the test.",
  retry: "Try again", saved: "Result saved", assigning: "Assigning…", assigned: "Test assigned. It is now in the student's Homework.",
  results: "Student results", history: "Attempt history", attempt: "Attempt", emptyHistory: "No attempts yet.",
  back: "Back to Homework", notStarted: "Not started", inProgress: "In progress", done: "Completed", review: "View results", assignedOn: "Assigned",
  loadMore: "Load older attempts", loading: "Loading…", noStudents: "No students found.", dismiss: "Close",
  error: "Couldn't save. Please try again — your answers are still here.", invalid: "Choose a student and at least one available exercise.", forbidden: "You do not have access to this test.",
};
export type TestLabels = typeof en;
const ru: TestLabels = {
  tests: "Тесты", exercise: "Упражнение", questions: "вопросов", exercises: "упражнений",
  open: "Открыть тест", practice: "Пройти самому", practiceHint: "Твои ответы не изменяют результаты учеников.",
  assign: "Назначить ученику", student: "Ученик", chooseStudent: "Выбери ученика", all: "Весь тест", selected: "Выбранные упражнения",
  available: "Включаются только готовые упражнения. Новые задания не добавляются в уже назначенную домашку автоматически.",
  pending: "Это упражнение ещё не добавлено.", pendingHint: "Упражнение 1 готово. Упражнения 2 и 3 появятся здесь после добавления заданий.",
  choose: "Выбери ответ", check: "Check the answers", checking: "Проверяем…", correctAnswer: "Правильный ответ", noAnswer: "No answer",
  completed: "Тест завершён!", exerciseCompleted: "Упражнение завершено!", correctAnswers: "Правильные ответы", errors: "Ошибки и объяснения",
  noErrors: "Без ошибок. Отличная работа!", overall: "Общий результат", checked: "Проверено упражнений", unfinished: "Проверь остальные упражнения, чтобы завершить тест.",
  retry: "Пройти заново", saved: "Результат сохранён", assigning: "Назначаем…", assigned: "Тест назначен и появился у ученика в Homework.",
  results: "Результаты ученика", history: "История попыток", attempt: "Попытка", emptyHistory: "Попыток пока нет.",
  back: "Назад к домашкам", notStarted: "Не начат", inProgress: "В процессе", done: "Завершён", review: "Посмотреть результаты", assignedOn: "Назначено",
  loadMore: "Загрузить прошлые попытки", loading: "Загрузка…", noStudents: "Ученики не найдены.", dismiss: "Закрыть",
  error: "Не удалось сохранить. Попробуй ещё раз — твои ответы остались на месте.", invalid: "Выбери ученика и хотя бы одно готовое упражнение.", forbidden: "Нет доступа к этому тесту.",
};
const uk: TestLabels = {
  tests: "Тести", exercise: "Вправа", questions: "запитань", exercises: "вправ",
  open: "Відкрити тест", practice: "Пройти самостійно", practiceHint: "Твої відповіді не змінюють результати учнів.",
  assign: "Призначити учню", student: "Учень", chooseStudent: "Вибери учня", all: "Увесь тест", selected: "Вибрані вправи",
  available: "Включаються лише готові вправи. Нові завдання не додаються до вже призначеної домашки автоматично.",
  pending: "Цю вправу ще не додано.", pendingHint: "Вправа 1 готова. Вправи 2 та 3 з'являться тут після додавання завдань.",
  choose: "Вибери відповідь", check: "Check the answers", checking: "Перевіряємо…", correctAnswer: "Правильна відповідь", noAnswer: "No answer",
  completed: "Тест завершено!", exerciseCompleted: "Вправу завершено!", correctAnswers: "Правильні відповіді", errors: "Помилки та пояснення",
  noErrors: "Без помилок. Чудова робота!", overall: "Загальний результат", checked: "Перевірено вправ", unfinished: "Перевір решту вправ, щоб завершити тест.",
  retry: "Пройти знову", saved: "Результат збережено", assigning: "Призначаємо…", assigned: "Тест призначено, він з'явився в учня в Homework.",
  results: "Результати учня", history: "Історія спроб", attempt: "Спроба", emptyHistory: "Спроб поки немає.",
  back: "Назад до домашок", notStarted: "Не розпочато", inProgress: "У процесі", done: "Завершено", review: "Переглянути результати", assignedOn: "Призначено",
  loadMore: "Завантажити минулі спроби", loading: "Завантаження…", noStudents: "Учнів не знайдено.", dismiss: "Закрити",
  error: "Не вдалося зберегти. Спробуй ще раз — твої відповіді залишилися на місці.", invalid: "Вибери учня та хоча б одну готову вправу.", forbidden: "Немає доступу до цього тесту.",
};
export const TEST_LABELS: Record<Locale, TestLabels> = { en, ru, uk };
