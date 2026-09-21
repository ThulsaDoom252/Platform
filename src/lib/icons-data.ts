/**
 * База иконок для материалов.
 * Только эмодзи, которые надёжно рисуются в Segoe UI Emoji на Windows
 * (флаги и свежие символы вроде 🥸/🦤 исключены — они дают «тофу»).
 *
 * Формат записи: [эмодзи, ключевые слова для поиска]
 */
export type IconGroup = { label: string; icons: [string, string][] };

export const ICON_GROUPS: IconGroup[] = [
  {
    label: "Учёба",
    icons: [
      ["📚", "книги учёба vocabulary books study"],
      ["📖", "книга чтение reading open book"],
      ["📕", "учебник red book"],
      ["📗", "green book"],
      ["📘", "blue book"],
      ["📙", "orange book"],
      ["📝", "запись заметка note write"],
      ["✏️", "карандаш pencil"],
      ["🖊️", "ручка pen"],
      ["📄", "лист документ page"],
      ["📋", "список clipboard"],
      ["🗂️", "папки разделы folders"],
      ["📁", "папка folder"],
      ["🎓", "выпускной graduation"],
      ["🧑‍🏫", "учитель teacher"],
      ["🔤", "алфавит буквы letters abc"],
      ["🔡", "строчные lowercase"],
      ["🔠", "заглавные uppercase"],
    ],
  },
  {
    label: "Язык и речь",
    icons: [
      ["💬", "разговор реплика speech"],
      ["🗨️", "фраза quote"],
      ["🗣️", "произношение speaking"],
      ["👅", "язык tongue"],
      ["👂", "слушание listening"],
      ["🎧", "аудио наушники audio"],
      ["🎙️", "микрофон mic"],
      ["🔊", "звук sound"],
      ["📣", "объявление announce"],
      ["🈶", "иероглиф character"],
      ["🔣", "символы symbols"],
      ["💭", "мысль thought"],
    ],
  },
  {
    label: "Грамматика",
    icons: [
      ["✅", "правило верно rules correct"],
      ["❌", "ошибка wrong"],
      ["⚠️", "внимание исключение warning"],
      ["🧩", "конструкция pattern puzzle"],
      ["🧱", "основы basics"],
      ["🔗", "связь collocation link"],
      ["↔️", "условные conditionals"],
      ["✂️", "clefts cut"],
      ["🔀", "порядок shuffle"],
      ["⏱️", "времена tenses time"],
      ["🕰️", "past прошлое"],
      ["🔮", "артикли articles future"],
      ["🧐", "лексика lexic analysis"],
      ["🙃", "модальные modal"],
      ["🧠", "память mind brain"],
    ],
  },
  {
    label: "Темы",
    icons: [
      ["🏅", "спорт sport medal"],
      ["⚽", "футбол football"],
      ["🏀", "баскетбол basketball"],
      ["🎾", "теннис tennis"],
      ["🧒", "дети воспитание upbringing child"],
      ["👨‍👩‍👧", "семья family"],
      ["🏛️", "государство политика government"],
      ["🗳️", "выборы election"],
      ["💼", "работа бизнес work business"],
      ["🏢", "офис office"],
      ["💰", "деньги финансы money"],
      ["🛒", "покупки shopping"],
      ["🍲", "еда food"],
      ["✈️", "путешествия travel"],
      ["🚗", "транспорт transport car"],
      ["🏝️", "отдых природа island"],
      ["🌍", "мир страны world"],
      ["🏥", "здоровье health"],
      ["🎬", "кино movies"],
      ["🎵", "музыка music"],
      ["💻", "технологии tech"],
      ["🔬", "наука science"],
      ["🎨", "искусство art"],
      ["⛅", "погода weather"],
    ],
  },
  {
    label: "Игры и практика",
    icons: [
      ["🕹️", "активности игры activities"],
      ["🎮", "игра game"],
      ["🎲", "кубик настолка dice"],
      ["🃏", "карточки flashcards"],
      ["🎯", "цель практика target"],
      ["🏆", "награда trophy"],
      ["🥇", "первое место gold"],
      ["🎭", "ролевая игра roleplay"],
      ["🎰", "игра слов wordplay"],
      ["🧪", "микс эксперимент mix"],
      ["🧬", "микс mix dna"],
      ["➕", "бонусы дополнительно bonus"],
    ],
  },
  {
    label: "Животные и природа",
    icons: [
      ["🦜", "попугай фразовые parrot"],
      ["🐦", "птица bird"],
      ["🐠", "рыба fish"],
      ["🐶", "собака dog"],
      ["🐱", "кошка cat"],
      ["🦊", "лиса fox"],
      ["🐝", "пчела bee"],
      ["🌱", "рост росток growth"],
      ["🌳", "дерево tree"],
      ["🌸", "цветок flower"],
      ["⛰️", "горы mountains hills"],
      ["🌊", "море волна sea"],
      ["🔥", "огонь серия fire streak"],
      ["⚡", "энергия быстро energy"],
      ["❄️", "холод snow"],
    ],
  },
  {
    label: "Эмоции и люди",
    icons: [
      ["😎", "уровень круто cool c1"],
      ["🤪", "идиомы шутка idioms"],
      ["😱", "удивление shock"],
      ["😬", "напряжение tense"],
      ["🙂", "хорошо good"],
      ["😴", "сон sleep"],
      ["🤔", "вопрос думать think"],
      ["💪", "сила strong"],
      ["❤️", "любовь heart"],
      ["💔", "разрыв broken heart"],
      ["🤝", "договор handshake"],
      ["👏", "аплодисменты clap"],
      ["👀", "внимание eyes"],
    ],
  },
  {
    label: "Символы",
    icons: [
      ["⭐", "звезда важно star"],
      ["💡", "подсказка заметка idea tip"],
      ["🔍", "поиск search"],
      ["📌", "закрепить pin"],
      ["🏷️", "метка tag"],
      ["📊", "статистика chart"],
      ["📈", "рост up"],
      ["📉", "падение down"],
      ["🔒", "закрыто lock"],
      ["🔑", "ключ key"],
      ["🚀", "старт rocket"],
      ["🎁", "бонус подарок gift"],
      ["🛡️", "защита shield"],
      ["🧭", "направление compass"],
    ],
  },
];

/** Плоский список для поиска. */
export const ALL_ICONS: [string, string][] = ICON_GROUPS.flatMap((g) => g.icons);

export function searchIcons(query: string): [string, string][] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_ICONS.filter(([icon, kw]) => kw.includes(q) || icon === q);
}
