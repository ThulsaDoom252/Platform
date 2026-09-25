/**
 * Построчные словники без таблицы: заголовок, слово — перевод и два примера.
 * Покрывает три реальных исходника, в которых раньше терялись короткие примеры
 * и комментарий в скобках обрывал связь с записью.
 * Запуск: npx tsx scripts/test-parser-inline-lists.ts
 */
import assert from "node:assert/strict";
import { parseMaterial } from "../src/lib/materials-parser";

function check(
  name: string,
  sample: string,
  expected: string[],
  section: string,
) {
  const result = parseMaterial(sample, "vocabulary");
  const phrases = result.phrases.filter((item) => item.kind === "PHRASE");

  assert.deepEqual(result.warnings, [], `${name}: парсер не должен выдавать предупреждения`);
  assert.deepEqual(
    phrases.map((item) => item.phrase),
    expected,
    `${name}: неверный список записей`,
  );
  assert.ok(
    phrases.every((item) => item.examples.length === 2),
    `${name}: у каждой записи должно остаться два примера`,
  );
  assert.equal(phrases[0].section, section);
  return phrases;
}

const psychology = `🧠 Психологічні терміни (Psychological Terms)

📘 Іменники (Nouns)
concesness — свідомість
(залишаю написання як у тебе)
My concesness is clear. — Моя свідомість чиста.
I feel my concesness now. — Я відчуваю свою свідомість.
sub-concsness — підсвідомість
The sub-concsness is strong. — Підсвідомість сильна.
I trust my sub-concsness. — Я довіряю своїй підсвідомості.
struggles /ˈstrʌɡ.əlz/ — труднощі / боротьба
I have many struggles. — У мене багато труднощів.
These struggles are hard. — Ці труднощі складні.
urges /ɜːrdʒɪz/ — пориви / сильні бажання
I have strong urges. — У мене сильні пориви.
These urges come at night. — Ці пориви приходять вночі.

📘 Дієслова (Verbs)
to fall of the wagon — зірватися (повернутися до поганої звички)
Don’t fall of the wagon. — Не зривайся.
He may fall of the wagon again. — Він може знову зірватися.
to struggle /ˈstrʌɡ.əl/ — боротися / мати труднощі
I struggle sometimes. — Я інколи борюся.
They struggle a lot. — Вони багато борються.
to fulfill desires and dreams — виконувати бажання та мрії
I want to fulfill desires and dreams. — Я хочу виконувати бажання та мрії.
She tries to fulfill desires and dreams. — Вона намагається виконувати бажання та мрії.
to rehearse /rɪˈhɜːrs/ — репетирувати
I rehearse every day. — Я репетирую щодня.
We rehearse after school. — Ми репетируємо після школи.`;

const psychologyPhrases = check(
  "psychology",
  psychology,
  [
    "concesness",
    "sub-concsness",
    "struggles",
    "urges",
    "to fall of the wagon",
    "to struggle",
    "to fulfill desires and dreams",
    "to rehearse",
  ],
  "Іменники (Nouns)",
);
assert.equal(psychologyPhrases[0].icon, "🧠");
assert.equal(psychologyPhrases[1].icon, "🧠");
assert.equal(psychologyPhrases[4].section, "Дієслова (Verbs)");

const symptoms = `Nouns (Іменники)
backache /ˈbæk.eɪk/ — біль у спині
I have a backache. — У мене болить спина.
His backache is strong. — Його біль у спині сильний.
blister /ˈblɪs.tər/ — пухир
I have a blister on my foot. — У мене пухир на нозі.
The blister hurts. — Пухир болить.
bruise /bruːz/ — синець
I have a bruise on my arm. — У мене синець на руці.
The bruise is blue. — Синець синій.
cold /kəʊld/ — застуда
I have a cold. — У мене застуда.
The cold is mild. — Застуда легка.
cough /kɒf/ — кашель
I have a cough. — У мене кашель.
His cough is bad. — Його кашель сильний.
fatigue /fəˈtiːɡ/ — втома
I feel fatigue. — Я відчуваю втому.
Fatigue is common. — Втома — поширена.
fainting /ˈfeɪn.tɪŋ/ — непритомність
She had fainting. — У неї була непритомність.
Fainting is dangerous. — Непритомність небезпечна.
fever /ˈfiː.vər/ — жар / температура
I have a fever. — У мене температура.
The fever is high. — Температура висока.
flu /fluː/ — грип
He has the flu. — У нього грип.
The flu is serious. — Грип серйозний.
food poisoning — харчове отруєння
I have food poisoning. — У мене харчове отруєння.
Food poisoning is awful. — Харчове отруєння жахливе.
fracture /ˈfræk.tʃər/ — перелом
He has a fracture. — У нього перелом.
The fracture is small. — Перелом невеликий.
nausea /ˈnɔː.zi.ə/ — нудота
I feel nausea. — Мені нудить.
Nausea is common. — Нудота поширена.
rash /ræʃ/ — висип
She has a rash. — У неї висип.
The rash is red. — Висип червоний.
runny nose /ˈrʌn.i nəʊz/ — нежить
I have a runny nose. — У мене нежить.
His runny nose is bad. — Його нежить сильний.
sore throat /sɔːr θrəʊt/ — біль у горлі
I have a sore throat. — У мене болить горло.
Her sore throat is painful. — Її біль у горлі сильний.
stomach bug — шлункова інфекція
I caught a stomach bug. — Я підхопив шлункову інфекцію.
The stomach bug is nasty. — Шлункова інфекція неприємна.
sunburn /ˈsʌn.bɜːn/ — сонячний опік
I got sunburn. — Я отримав сонячний опік.
The sunburn hurts. — Сонячний опік болить.
symptom /ˈsɪmp.təm/ — симптом
This is a symptom. — Це симптом.
I have one symptom. — У мене є один симптом.
toothache /ˈtuːθ.eɪk/ — зубний біль
I have a toothache. — У мене зубний біль.
The toothache is strong. — Зубний біль сильний.
wound /wuːnd/ — рана
He has a wound. — У нього рана.
The wound is clean. — Рана чиста.`;

const symptomPhrases = check(
  "symptoms",
  symptoms,
  [
    "backache", "blister", "bruise", "cold", "cough", "fatigue", "fainting",
    "fever", "flu", "food poisoning", "fracture", "nausea", "rash", "runny nose",
    "sore throat", "stomach bug", "sunburn", "symptom", "toothache", "wound",
  ],
  "Nouns (Іменники)",
);
assert.deepEqual(symptomPhrases[1].examples[1], {
  en: "The blister hurts.",
  tr: "Пухир болить.",
});
assert.deepEqual(symptomPhrases[5].examples[0], {
  en: "I feel fatigue.",
  tr: "Я відчуваю втому.",
});

const treatment = `Nouns (Іменники)
a prescription — рецепт
The doctor gave me a prescription. — Лікар дав мені рецепт.
I need a prescription for this drug. — Мені потрібен рецепт на ці ліки.
examination /ɪɡˌzæm.ɪˈneɪ.ʃən/ — обстеження
I have an examination today. — Сьогодні в мене обстеження.
The examination was quick. — Обстеження було швидким.
first aid kit — аптечка
The first aid kit is here. — Аптечка тут.
Take the first aid kit with you. — Візьми аптечку з собою.
GP (General Practitioner) — сімейний лікар
I visit my GP. — Я відвідую свого сімейного лікаря.
The GP checked me. — Сімейний лікар мене оглянув.
ointment /ˈɔɪnt.mənt/ — мазь
Use this ointment. — Використовуй цю мазь.
The ointment helps. — Мазь допомагає.
painkillers — знеболювальні
I take painkillers. — Я приймаю знеболювальні.
Painkillers help me sleep. — Знеболювальні допомагають заснути.
sedatives — заспокійливі
The doctor prescribed sedatives. — Лікар призначив заспокійливі.
Sedatives calm me. — Заспокійливі мене заспокоюють.
side effect — побічний ефект
This drug has a side effect. — Ці ліки мають побічний ефект.
I noticed a side effect. — Я помітив побічний ефект.
surgery /ˈsɜː.dʒər.i/ — операція
She had surgery. — Їй зробили операцію.
The surgery was successful. — Операція пройшла успішно.
ultrasound diagnostic — ультразвукова діагностика
We need ultrasound diagnostic. — Потрібна ультразвукова діагностика.
Ultrasound diagnostic is safe. — УЗ-діагностика безпечна.
welfare — добробут
Health affects welfare. — Здоров’я впливає на добробут.
Social welfare is important. — Соціальний добробут важливий.
X-ray — рентген
I had an X-ray. — Мені зробили рентген.
The X-ray is clear. — Рентген чіткий.`;

const treatmentPhrases = check(
  "treatment",
  treatment,
  [
    "a prescription", "examination", "first aid kit", "GP (General Practitioner)",
    "ointment", "painkillers", "sedatives", "side effect", "surgery",
    "ultrasound diagnostic", "welfare", "X-ray",
  ],
  "Nouns (Іменники)",
);
assert.deepEqual(treatmentPhrases[4].examples, [
  { en: "Use this ointment.", tr: "Використовуй цю мазь." },
  { en: "The ointment helps.", tr: "Мазь допомагає." },
]);

console.log("Inline vocabulary parser: ok — 3 formats, 40 entries, 2 examples each.");
