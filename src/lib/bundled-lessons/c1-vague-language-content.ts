import type { LessonWord } from "../lesson-unit";

export type VagueLanguageQuestion = { prompt: string; suggestedAnswer: string };
export type VagueLanguageTrueFalse = { prompt: string; answer: boolean; explanation: string };
export type VagueLanguageReading = {
  id: string;
  title: string;
  paragraphs: string[];
  questions: VagueLanguageQuestion[];
  trueFalse: VagueLanguageTrueFalse[];
};
export type VagueLanguageDialogue = {
  id: string;
  title: string;
  turns: { speaker: string; text: string }[];
  questions: VagueLanguageQuestion[];
  trueFalse: VagueLanguageTrueFalse[];
};

type WordContent = Omit<LessonWord, "id">;
function word(
  expression: string,
  translation: string,
  description: string,
  note: string,
  examples: WordContent["examples"],
  category: string,
  icon: string,
  sectionColor: string,
): WordContent {
  return { word: expression, translation, description, note, examples, category, icon, sectionColor,
    translationLang: "UK", ipaUs: null, ipaUk: null, imageUrl: null };
}

/** Original examples; null IPA avoids inventing an authoritative transcription for a variable phrase. */
export const VAGUE_LANGUAGE_NEW_WORDS: WordContent[] = [
  word("roughly", "приблизно; орієнтовно", "Approximately; close to a number or amount, but not exact.",
    "Before a number: roughly two hours. An estimate may be a little higher or lower; this is not a minimum.", [
      { en: "We had spent roughly two hours on the report before the director arrived.", tr: "Ми витратили приблизно дві години на звіт до того, як прийшов директор." },
      { en: "By Friday, we will have interviewed roughly thirty volunteers.", tr: "До п’ятниці ми опитаємо приблизно тридцять волонтерів." },
    ], "Approximate amounts", "≈", "#8b5cf6"),
  word("somewhere around", "десь близько; приблизно", "In an approximate area, time or numerical range.",
    "Before the figure: somewhere around fifty, not fifty somewhere around. Common in conversation.", [
      { en: "Somewhere around fifty people had registered before we advertised the event.", tr: "Десь близько п’ятдесяти людей зареєструвалися ще до того, як ми розрекламували захід." },
      { en: "By the end of the month, I will have saved somewhere around six hundred euros.", tr: "До кінця місяця я заощаджу десь близько шестисот євро." },
    ], "Approximate amounts", "🎯", "#8b5cf6"),
  word("in the region of", "у межах приблизно; близько", "Approximately a stated amount, especially a cost or quantity.",
    "Before the number: in the region of £500. Relatively neutral/formal; not a strict upper or lower limit.", [
      { en: "The repairs had cost in the region of a thousand pounds before we replaced the windows.", tr: "Ремонт обійшовся приблизно в тисячу фунтів ще до того, як ми замінили вікна." },
      { en: "By June, the charity will have raised in the region of twenty thousand pounds.", tr: "До червня благодійна організація збере близько двадцяти тисяч фунтів." },
    ], "Approximate amounts", "💷", "#8b5cf6"),
  word("on the order of", "порядку; приблизно", "Of approximately a stated size or magnitude.",
    "Often used for scale or large quantities. On the order of is particularly common in American English; British English also uses of the order of. Not an exact amount.", [
      { en: "The outage had affected on the order of ten thousand users before service returned.", tr: "Збій зачепив порядку десяти тисяч користувачів до відновлення роботи сервісу." },
      { en: "By December, the system will have processed on the order of a million requests.", tr: "До грудня система обробить приблизно мільйон запитів." },
    ], "Approximate amounts", "📊", "#8b5cf6"),
  word("a ballpark figure", "приблизна оцінка; орієнтовна цифра", "A rough numerical estimate rather than a confirmed total.",
    "A noun phrase: give me a ballpark figure; a ballpark figure of £200. Not a substitute for roughly directly before a number without of.", [
      { en: "I had given her a ballpark figure of two hundred euros before the invoices arrived.", tr: "Я назвав їй орієнтовну суму у двісті євро до того, як надійшли рахунки." },
      { en: "By tomorrow, we will have checked the receipts instead of relying on a ballpark figure.", tr: "До завтра ми перевіримо чеки й більше не покладатимемося на приблизну оцінку." },
    ], "Approximate amounts", "🧮", "#8b5cf6"),
  word("or so", "чи близько того; приблизно", "Approximately the amount just mentioned.",
    "After the quantity: ten minutes or so. Not or so ten minutes. Conversational.", [
      { en: "We had waited for twenty minutes or so when the organiser finally called.", tr: "Ми чекали хвилин двадцять, коли організатор нарешті зателефонував." },
      { en: "By lunchtime, I will have answered a dozen emails or so.", tr: "До обіду я відповім приблизно на дюжину листів." },
    ], "After the quantity", "⌛", "#0ea5e9"),
  word("or thereabouts", "або близько того; приблизно стільки", "Approximately the number, time or place just mentioned.",
    "After the figure: fifty or thereabouts. Bare thereabouts is also possible after a figure: fifty thereabouts. Do not put it before fifty.", [
      { en: "Sixty people or thereabouts had arrived by the time the doors officially opened.", tr: "Близько шістдесяти людей прийшли до офіційного відкриття дверей." },
      { en: "By nine or thereabouts, we will have finished the debrief.", tr: "Приблизно до дев’ятої ми завершимо підсумкове обговорення." },
    ], "After the quantity", "🕘", "#0ea5e9"),
  word("give or take", "плюс-мінус; з похибкою", "Allowing a small difference above or below an estimate.",
    "Usually after the estimate: fifty, give or take; fifty, give or take five. A stated margin makes the tolerance clearer. Not an absolute minimum.", [
      { en: "We had raised five hundred pounds, give or take twenty, before the final count.", tr: "До остаточного підрахунку ми зібрали п’ятсот фунтів, плюс-мінус двадцять." },
      { en: "By six, we will have travelled a hundred kilometres, give or take.", tr: "До шостої ми подолаємо приблизно сто кілометрів." },
    ], "After the quantity", "↔️", "#0ea5e9"),
  word("-odd", "із лишком; трохи більше за кругле число", "Used after a round number to suggest an unspecified, usually small, amount more.",
    "Informal: twenty-odd guests. The number is over twenty; -odd does not mean below twenty. Often hyphenated before a noun. Do not use it for clock time. This is a suffix, not the adjective meaning strange.", [
      { en: "Twenty-odd guests had arrived before we discovered the missing chairs.", tr: "Двадцять із лишком гостей прийшли до того, як ми помітили, що бракує стільців." },
      { en: "By Saturday, she will have spoken to thirty-odd applicants.", tr: "До суботи вона поговорить із тридцятьма з лишком кандидатами." },
    ], "Flexible number endings", "➕", "#14b8a6"),
  word("-something", "якийсь у межах десятка; із чимось", "Used with a decade number when the final digit is not specified.",
    "Informal: twenty-something means in the twenties (20–29); thirty-something means in the thirties. In He is a twenty-something, it describes age. Use a decade, not an arbitrary number such as twenty-three-something.", [
      { en: "She had met twenty-something clients before she found the right partner.", tr: "Вона зустрілася з двадцятьма з чимось клієнтами, перш ніж знайшла відповідного партнера." },
      { en: "By July, I will have recorded thirty-something short interviews.", tr: "До липня я запишу тридцять із чимось коротких інтерв’ю." },
    ], "Flexible number endings", "🔢", "#14b8a6"),
  word("just over", "трохи більше ніж", "A little more than the stated amount.",
    "Before the figure: just over an hour. The amount is above the figure, not below or exactly equal to it.", [
      { en: "The meeting had lasted just over an hour when the alarm went off.", tr: "Нарада тривала трохи більше години, коли спрацювала сигналізація." },
      { en: "By Friday, the team will have collected just over two hundred responses.", tr: "До п’ятниці команда збере трохи більше двохсот відповідей." },
    ], "More or less: limits", "⬆️", "#f59e0b"),
  word("in excess of", "понад; більше ніж", "More than a stated amount, without specifying exactly how much more.",
    "Formal, before a number: in excess of £500. A strict lower threshold, not approximately £500; it does not say how much more.", [
      { en: "The appeal had raised in excess of five thousand pounds before the concert began.", tr: "Збір приніс понад п’ять тисяч фунтів ще до початку концерту." },
      { en: "By the end of the year, the centre will have welcomed in excess of a thousand visitors.", tr: "До кінця року центр прийме понад тисячу відвідувачів." },
    ], "More or less: limits", "📈", "#f59e0b"),
  word("at least", "щонайменше; не менше ніж", "Not less than a stated amount; the real amount may be higher.",
    "An inclusive minimum: at least ten allows exactly ten or more. It is not the same as roughly ten.", [
      { en: "At least ten people had complained before the manager noticed the problem.", tr: "Щонайменше десятеро людей поскаржилися до того, як менеджер помітив проблему." },
      { en: "By the deadline, we will have checked at least fifty applications.", tr: "До кінцевого терміну ми перевіримо щонайменше п’ятдесят заявок." },
    ], "More or less: limits", "≥", "#f59e0b"),
  word("no less than", "не менше ніж; аж", "At least a stated amount, often emphasising that it is surprisingly large.",
    "An emphatic inclusive lower bound; no fewer than is often preferred with countable plural nouns in careful writing. Do not confuse with no more than.", [
      { en: "We had spent no less than three thousand pounds before opening night.", tr: "До прем’єри ми витратили аж три тисячі фунтів." },
      { en: "By June, she will have devoted no less than a hundred hours to the project.", tr: "До червня вона присвятить проєкту не менше ста годин." },
    ], "More or less: limits", "‼️", "#f59e0b"),
  word("at most", "щонайбільше; не більше ніж", "Not more than a stated amount; that number is the maximum allowed.",
    "An inclusive maximum: at most ten allows exactly ten or fewer. It does not mean about ten.", [
      { en: "At most twenty guests had entered when we paused admission.", tr: "Щонайбільше двадцятеро гостей зайшли, коли ми призупинили вхід." },
      { en: "By noon, we will have used at most half of the budget.", tr: "До полудня ми використаємо щонайбільше половину бюджету." },
    ], "More or less: limits", "≤", "#f59e0b"),
  word("no more than", "не більше ніж; лише", "At most a stated amount, sometimes emphasising how small it is.",
    "An inclusive upper bound: no more than twenty can be exactly twenty. Compare no less than: the direction of the limit reverses.", [
      { en: "She had received no more than three replies when she decided to call instead.", tr: "Вона отримала не більше трьох відповідей, коли вирішила натомість зателефонувати." },
      { en: "By the end of the trial, I will have spent no more than thirty pounds.", tr: "До кінця пробного періоду я витрачу не більше тридцяти фунтів." },
    ], "More or less: limits", "🧱", "#f59e0b"),
  word("in the low ...", "у нижній частині діапазону; трохи за…", "In the lower part of a numerical range, especially a decade.",
    "Use the plural decade: in the low thirties / in the low 30s, not in the low 30. It suggests the first few numbers in that decade, not an exact universally fixed range. Celsius/Fahrenheit must come from context.", [
      { en: "The temperature had stayed in the low thirties all morning, so we moved the workshop indoors.", tr: "Усю першу половину дня температура трималася трохи вище тридцяти градусів, тож ми перенесли заняття в приміщення." },
      { en: "By Friday, temperatures will have remained in the low twenties for a week.", tr: "До п’ятниці температура триматиметься трохи вище двадцяти градусів уже цілий тиждень." },
    ], "Flexible ranges", "🌡️", "#ec4899"),
  word("broadly speaking", "загалом кажучи; у загальних рисах", "Giving a general picture without covering every detail or exception.",
    "Often at the start, followed by a comma. It generalises a statement; it does not directly modify a number like roughly.", [
      { en: "Broadly speaking, the team had solved the serious problems before the launch.", tr: "Загалом кажучи, команда розв’язала серйозні проблеми ще до запуску." },
      { en: "Broadly speaking, we will have met our main objectives by June.", tr: "Загалом кажучи, до червня ми досягнемо основних цілей." },
    ], "Generalising and softening", "🗺️", "#ec4899"),
  word("to some extent", "певною мірою; частково", "Partly, or in some respects, but not completely.",
    "To an extent is also possible. This limits the degree of a claim: I agree to some extent. It is not an estimate of a number.", [
      { en: "The rehearsal had reduced my anxiety to some extent, but I was still on edge.", tr: "Репетиція певною мірою зменшила мою тривогу, але я все ще був на нервах." },
      { en: "By our next meeting, we will have addressed those concerns to some extent.", tr: "До наступної зустрічі ми певною мірою розв’яжемо ці питання." },
    ], "Generalising and softening", "◐", "#ec4899"),
  word("kind of / sort of", "ніби; трохи; певною мірою", "Informal expressions that make a description less definite or direct.",
    "Often before an adjective or verb: kind of nervous; sort of understand. Here they soften a claim, unlike a kind of music, which means a type. Avoid them when precision is essential.", [
      { en: "I had felt kind of overwhelmed before you offered to help.", tr: "Я почувався трохи розгубленим від навантаження до того, як ти запропонував допомогу." },
      { en: "By tomorrow, I will have sorted out the practical details, although I may still feel sort of nervous.", tr: "До завтра я владнаю практичні деталі, хоча, можливо, все ще трохи нервуватиму." },
    ], "Generalising and softening", "💬", "#ec4899"),
];

export const VAGUE_LANGUAGE_READINGS: VagueLanguageReading[] = [
  {
    id: "vague-reading-1", title: "The number we put on the poster",
    paragraphs: [
      "After my memorable investor pitch to Margaret Hale, I wanted a quieter challenge: helping Ben organise a community photography evening. By the time it opened, I had checked the booking list three times. Somewhere around fifty people had registered, so I had ordered sixty chairs. That was a ballpark figure, not a promise about attendance. Unfortunately, our poster said ‘at least sixty guests’. I was taken aback: somebody had turned my estimate into a minimum.",
      "I had been on edge all afternoon, and the mistake nearly made me freak out. When the first visitors arrived, I went red and felt flustered. I was mortified that I had approved the poster without reading the final version. Ben did not lose his temper. He simply changed the online wording to ‘fifty guests or thereabouts’ and brought ten spare chairs from upstairs.",
      "By seven, just over forty people had arrived. One photographer felt gutted because she had expected a packed room, but nobody had actually guaranteed one. I objected to people treating a rough estimate as a confirmed booking. When a sponsor asked for exact sales figures, however, I clammed up: I had left the receipts at home.",
      "We finished with forty-seven visitors and raised £684. Broadly speaking, the evening was a success, though my preparation had been weak to some extent. In the debrief, Ben separated estimates from facts. By Friday, we will have checked every receipt and published the exact total. By our next event, we will have added a second approval step. Friendly, flexible language is useful; quietly changing ‘roughly’ into ‘at least’ is not.",
    ],
    questions: [
      { prompt: "Why was ‘at least sixty guests’ misleading?", suggestedAnswer: "The organiser had estimated attendance; at least sixty turned that estimate into a minimum or guarantee." },
      { prompt: "What had the narrator failed to do before approving the poster?", suggestedAnswer: "The narrator had failed to read the final version carefully." },
      { prompt: "Why did the narrator clam up when the sponsor asked about sales?", suggestedAnswer: "The narrator had left the receipts at home and could not provide exact sales figures." },
      { prompt: "What will the team have done by Friday and by its next event?", suggestedAnswer: "By Friday, it will have checked every receipt and published the exact total; by the next event, it will have added a second approval step." },
    ],
    trueFalse: [
      { prompt: "The booking list contained an exact total of sixty registered guests.", answer: false, explanation: "Somewhere around fifty people had registered; sixty was the number of chairs ordered." },
      { prompt: "The narrator had approved the poster before noticing its misleading wording.", answer: true, explanation: "The narrator says that they had approved the poster without reading the final version." },
      { prompt: "Ben lost his temper when the visitors arrived.", answer: false, explanation: "The text explicitly says that Ben did not lose his temper; he corrected the wording and found chairs." },
      { prompt: "At the end of the event, the visitor total was a fact rather than an estimate.", answer: true, explanation: "The final count is forty-seven visitors, contrasted with earlier approximate numbers." },
    ],
  },
  {
    id: "vague-reading-2", title: "A forecast with room for doubt",
    paragraphs: [
      "When the city asked me to organise a free rooftop film night, I was thrilled to bits. I had watched other organisers run similar events and assumed ours would be simple. By our first planning meeting, however, twenty-odd volunteers had offered help, and I was already overwhelmed by the messages. Most were twenty-something students with exams approaching, so their availability was uncertain.",
      "Our technician gave us a ballpark figure of £900 for equipment. She said the final bill would probably be in the region of that amount, give or take £100. The council approved a firm ceiling of £1,100: we could spend no more than that. A local company had already donated in excess of £600 before we launched our public appeal, which gave us some breathing room.",
      "The forecast predicted temperatures in the low thirties Celsius. One volunteer said we should start ‘at eight or so’, but the caretaker needed a precise time to unlock the roof. We agreed on 8 p.m. I cringed when I remembered that I had called his earlier questions ‘kind of unnecessary’. His caution had protected us from a genuine access problem.",
      "At the rehearsal, a volunteer projected my enormous desktop selfie instead of the film. We burst out laughing; even the caretaker cracked up. I laughed my head off once the initial embarrassment had passed. Later, I was moved by everyone staying to help. By opening night, we will have tested the projector twice and confirmed every volunteer’s shift. By 10 p.m., we will have welcomed at most eighty guests to our single screening: safety rules allow only eighty tickets. Estimates can stay flexible; access arrangements, spending limits and safety rules cannot.",
    ],
    questions: [
      { prompt: "Why was the volunteer situation less straightforward than the organiser had expected?", suggestedAnswer: "Twenty-odd volunteers had offered help, but most were students with exams and uncertain availability; the organiser was overwhelmed by their messages." },
      { prompt: "How did the technician’s estimate differ from the council’s ceiling?", suggestedAnswer: "£900, give or take £100, was an approximate estimate; £1,100 was a firm maximum that they could not exceed." },
      { prompt: "Why did ‘at eight or so’ become an exact time?", suggestedAnswer: "The caretaker needed a precise time to unlock the roof, so they agreed on 8 p.m." },
      { prompt: "Which tasks will have been completed before opening night?", suggestedAnswer: "They will have tested the projector twice and confirmed every volunteer’s shift." },
    ],
    trueFalse: [
      { prompt: "Twenty-odd volunteers means an unspecified number below twenty.", answer: false, explanation: "Twenty-odd means a little more than twenty, not fewer than twenty." },
      { prompt: "The company donated more than £600 before the public appeal began.", answer: true, explanation: "It had donated in excess of £600 before the appeal; in excess of means more than." },
      { prompt: "The organiser eventually recognised the value of the caretaker’s questions.", answer: true, explanation: "The organiser says that his caution had protected them from a genuine access problem." },
      { prompt: "The team plans to exceed eighty guests if the weather is good.", answer: false, explanation: "Only eighty tickets are available for the single screening, so at most eighty guests can attend." },
    ],
  },
];

export const VAGUE_LANGUAGE_DIALOGUES: VagueLanguageDialogue[] = [
  {
    id: "vague-dialogue-1", title: "After the scope-creep argument",
    turns: [
      { speaker: "Emma", text: "Jack, after last month’s argument about bugs and changing requirements, we agreed to make estimates clearer. Before you sent yesterday’s update, had you checked the supplier’s final quote?" },
      { speaker: "Jack", text: "No. She had only given me a ballpark figure of £2,000 for the new integration, so I wrote ‘somewhere around £2,000’." },
      { speaker: "Emma", text: "That explains why I was taken aback by the client’s reply. He thinks £2,000 is a maximum." },
      { speaker: "Jack", text: "I was kind of flustered when he called. I had not realised he was treating an estimate as a ceiling." },
      { speaker: "Emma", text: "I don’t mind you giving early estimates. I mind you leaving out the uncertainty when it affects a decision." },
      { speaker: "Jack", text: "Fair point. The written quote arrived this morning: £2,140. That is just over £2,000, but it is not ‘no more than £2,000’." },
      { speaker: "Emma", text: "Exactly. If the budget allows at most £2,000, even a small extra amount needs approval." },
      { speaker: "Jack", text: "He said he had spent no less than £500 on the platform before contacting us. I think he was emphasising how expensive it had been." },
      { speaker: "Emma", text: "Probably. Broadly speaking, he wants a clear total, not a lesson in vague language. What have you promised him?" },
      { speaker: "Jack", text: "By three this afternoon, we will have confirmed the total and listed every extra charge. I haven’t promised a lower price." },
      { speaker: "Emma", text: "Good. And by tomorrow’s call, we will have prepared a cheaper alternative. That should reduce the tension to some extent." },
      { speaker: "Jack", text: "I feel gutted about the misunderstanding, but I’m glad we caught it. I had been on edge since his message." },
      { speaker: "Emma", text: "No need to freak out. Explain what the estimate meant, acknowledge the confusion and ask which budget limit is firm." },
      { speaker: "Jack", text: "Right. Next time I’ll say ‘roughly £2,000, subject to the final quote’. And I’ll put any actual maximum in a separate sentence." },
    ],
    questions: [
      { prompt: "What had Jack not checked before sending yesterday’s update?", suggestedAnswer: "He had not checked the supplier’s final quote; he only had a ballpark figure." },
      { prompt: "Why is £2,140 incompatible with ‘no more than £2,000’?", suggestedAnswer: "No more than £2,000 sets a maximum; £2,140 exceeds that maximum." },
      { prompt: "What will they have done by three, and by tomorrow’s call?", suggestedAnswer: "By three, they will have confirmed the total and listed all extra charges; by tomorrow’s call, they will have prepared a cheaper alternative." },
      { prompt: "What is Emma’s practical advice for the next estimate?", suggestedAnswer: "Make the uncertainty explicit, distinguish the estimate from a firm budget limit, and confirm the client’s actual maximum." },
    ],
    trueFalse: [
      { prompt: "The supplier had confirmed £2,000 as the final price before Jack wrote the update.", answer: false, explanation: "The supplier had only given a ballpark figure; the written quote arrived the following morning." },
      { prompt: "The actual quote is higher than £2,000.", answer: true, explanation: "The written quote is £2,140, described as just over £2,000." },
      { prompt: "Jack has promised to negotiate a lower price by three.", answer: false, explanation: "He promised to confirm the total and list charges; he explicitly says he has not promised a lower price." },
      { prompt: "Emma accepts early estimates if their uncertainty is made clear.", answer: true, explanation: "She does not mind early estimates; she objects to leaving out uncertainty when it affects a decision." },
    ],
  },
  {
    id: "vague-dialogue-2", title: "What can we safely announce?",
    turns: [
      { speaker: "Jules", text: "By the time the school assembly started yesterday, had the fundraising page reached a thousand pounds?" },
      { speaker: "Sam", text: "Not quite. We had raised £970. I told the students ‘a thousand or thereabouts’, then showed the exact total on screen." },
      { speaker: "Jules", text: "That sounds reasonable. I was mortified because I had announced ‘in excess of a thousand’ in the staff room." },
      { speaker: "Sam", text: "Then we should correct it. In excess of means above a thousand, and we hadn’t reached that point." },
      { speaker: "Jules", text: "I know. I went red when Alex pointed it out. He didn’t lose his temper, but I clammed up instead of admitting the mistake." },
      { speaker: "Sam", text: "I used to cringe at myself making mistakes too. People usually appreciate a straightforward correction." },
      { speaker: "Jules", text: "How many donations had come in before the assembly? I remember twenty-something, but not the precise number." },
      { speaker: "Sam", text: "Twenty-seven. By Friday lunchtime, we will have checked the new payments and published an exact update, not just an estimate." },
      { speaker: "Jules", text: "And the publicity report says our campaign had reached on the order of ten thousand people before the assembly. Is that an exact count?" },
      { speaker: "Sam", text: "No, it gives the scale. The platform estimates reach; it does not identify ten thousand individual people we can count ourselves." },
      { speaker: "Jules", text: "Broadly speaking, the students are thrilled to bits. I was moved by them donating their own savings, although I felt overwhelmed by the messages." },
      { speaker: "Sam", text: "Me too. I sort of expected a quiet week. Then Mia’s fundraising video made everyone burst out laughing. Even the head teacher cracked up." },
      { speaker: "Jules", text: "I laughed my head off at the dancing mascot! By the next assembly, we will have thanked every donor. Can we promise a final total by then?" },
      { speaker: "Sam", text: "No. Donations remain open until Sunday. By the next assembly on Saturday, we will have prepared a progress update; by Monday afternoon, we will have verified the final total." },
    ],
    questions: [
      { prompt: "Why can ‘a thousand or thereabouts’ describe £970, but ‘in excess of a thousand’ cannot?", suggestedAnswer: "Or thereabouts is approximate and can allow a figure below £1,000; in excess of requires more than £1,000." },
      { prompt: "How did Jules respond when Alex noticed the mistake?", suggestedAnswer: "Jules went red and clammed up instead of admitting it; Alex did not lose his temper." },
      { prompt: "What does ‘on the order of ten thousand’ communicate here?", suggestedAnswer: "It communicates approximate scale, not an exact count of individually identified people." },
      { prompt: "Why will Saturday’s assembly have only a progress update?", suggestedAnswer: "Donations remain open until Sunday, so the team will not have verified the final total until Monday afternoon." },
    ],
    trueFalse: [
      { prompt: "The page had raised more than £1,000 before yesterday’s assembly.", answer: false, explanation: "The total was £970, which is below £1,000." },
      { prompt: "Twenty-seven donations had arrived before the assembly.", answer: true, explanation: "Sam supplies the exact number, twenty-seven, after Jules remembers only twenty-something." },
      { prompt: "Sam considers the publicity reach figure an exact count of identified individuals.", answer: false, explanation: "Sam says it is an estimate of scale and not a count of individually identified people." },
      { prompt: "The final verified total is due after donations have closed.", answer: true, explanation: "Donations close on Sunday and the verified final total is planned for Monday afternoon." },
    ],
  },
];
