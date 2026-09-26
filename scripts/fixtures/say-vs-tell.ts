/**
 * Шпаргалка SAY vs TELL.
 *
 * Особенность: таблицы «англійська / переклад» приезжают склеенными в
 * одну строку, причём первая колонка — целое английское предложение,
 * а не одно слово. Граница между строками проходит там, где кончается
 * украинский перевод и начинается следующее английское предложение.
 */
const T = "\t";

export const sayVsTell = [
  `SAY  vs  TELL say something  vs  tell somebody something`,
  `SAY${T}TELL`,
  `say + ЩО особу НЕ вказуємо (або say to) say something${T}tell + КОМУ + ЩО особа ОБОВ'ЯЗКОВА tell somebody something`,
  `SAY  —  говоримо ЩО. Особа не вказується.`,
  `АНГЛІЙСЬКА${T}ПЕРЕКЛАД She said hello.${T}Вона привіталась. He said that he was tired.${T}Він сказав, що втомився. "I'm ready," she said.${T}«Я готова», — сказала вона. What did he say?${T}Що він сказав?`,
  `SAY TO — якщо все ж хочемо вказати особу після say, треба прийменник to. Це = tell, але рідше. She said to me that she was tired.  ≈  She told me she was tired.`,
  `TELL  —  говоримо КОМУ + ЩО. Особа ОБОВ'ЯЗКОВА!`,
  `АНГЛІЙСЬКА${T}ПЕРЕКЛАД She told me the truth.${T}Вона сказала мені правду. He told her that he was tired.${T}Він сказав їй, що втомився. Tell me your name.${T}Скажи мені своє ім'я. Can you tell me the way to the station?${T}Ви не підкажете дорогу до станції?`,
  `ВИРАЗ${T}ПЕРЕКЛАД`,
  `tell the truth${T}казати правду`,
  `tell a lie${T}казати неправду / брехати`,
  `tell a story${T}розповідати історію`,
  `tell a joke${T}розповідати жарт`,
  `tell the time${T}говорити котра година`,
  `tell the difference${T}розрізнити / бачити різницю`,
  `✗  tell без особи She told that she was tired.${T}✓  tell + особа обов'язкова She told me she was tired.`,
  `✗  say + особа без to She said me hello.${T}✓  say to / або tell She said hello to me. / She told me hello.`,
  `💡 ЗАПАМ'ЯТАЙ SAY + що (без особи).  SAY TO + особа (рідко). TELL + особа + що.  Без особи — помилка! She said she was tired.  =  She told me she was tired.`,
].join("\n");
