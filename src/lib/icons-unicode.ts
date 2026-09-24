import englishEmoji from "emojibase-data/en/compact.json";
import russianEmoji from "emojibase-data/ru/compact.json";
import ukrainianEmoji from "emojibase-data/uk/compact.json";
import type { IconGroup } from "./icons-extra";

type EmojiRecord = {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  tags?: string[];
};

const GROUP_META: Record<number, { label: string; keywords: string }> = {
  0: {
    label: "😊 Эмоции и лица",
    keywords:
      "эмоции эмоция емоции чувства настроение лица смайлы емоції емоція почуття настрій обличчя smileys emotion feelings faces mood",
  },
  1: {
    label: "👋 Люди и жесты",
    keywords:
      "люди человек тело части тела руки жесты профессии людина тіло частини тіла руки жести професії people body hands gestures profession",
  },
  3: {
    label: "🐾 Животные и природа",
    keywords:
      "животные растения природа птицы насекомые тварини рослини природа птахи комахи animals nature plants birds insects",
  },
  4: {
    label: "🍎 Еда и продукты",
    keywords:
      "еда продукты напитки кухня блюда фрукты овощи їжа продукти напої кухня страви фрукти овочі food drink products meals fruit vegetables",
  },
  5: {
    label: "🌍 Места и транспорт",
    keywords:
      "путешествия места транспорт здания страны города подорожі місця транспорт будівлі країни міста travel places transport buildings countries cities",
  },
  6: {
    label: "⚽ Спорт и занятия",
    keywords:
      "спорт игры занятия праздники награды ігри заняття свята нагороди activities sports games events awards",
  },
  7: {
    label: "💡 Предметы",
    keywords:
      "предметы вещи инструменты техника одежда музыка работа предмети речі інструменти техніка одяг музика objects tools technology clothing music work",
  },
  8: {
    label: "🔣 Знаки и символы",
    keywords:
      "знаки символы кнопки цифры стрелки цвета знаки символи кнопки цифри стрілки кольори symbols signs buttons numbers arrows colors",
  },
  9: {
    label: "🏳️ Флаги",
    keywords: "флаги страны регионы прапори країни регіони flags countries regions",
  },
};

/** Дополнительные тематические запросы, которых нет даже в CLDR-тегах. */
const TOPIC_KEYWORDS: Record<string, string> = {
  "😈": "devil demon daemon fiend evil дьявол демон черт чёрт бес диявол чорт дідько",
  "👿": "devil demon daemon imp fiend evil дьявол демон черт чёрт бес диявол чорт дідько",
  "🪖": "армия военный солдат каска військо військовий солдат армія",
  "🫡": "армия честь салют военный військо честь військовий армія",
  "🎖️": "армия военная медаль награда військова медаль армія",
  "⚔️": "армия оружие бой мечи військо зброя бій армія",
  "🛡️": "армия защита щит оборона військо захист армія",
  "💣": "армия оружие бомба військо зброя армія",
  "🔫": "армия оружие пистолет військо зброя армія",
  "🗡️": "армия оружие кинжал меч військо зброя армія",
  "🏹": "армия оружие лук стрела військо зброя армія",
  "🥾": "армия военный ботинок військовий армія",
  "🪂": "армия десант парашют військо десант армія",
  "🚁": "армия вертолет авиация військо гелікоптер армія",
  "🌍": "планета планеты космос земля планети космос",
  "🌎": "планета планеты космос земля планети космос",
  "🌏": "планета планеты космос земля планети космос",
  "🪐": "планета планеты космос сатурн планети космос",
  "🌑": "планета планеты космос луна месяц планети космос місяць",
  "🌒": "планета планеты космос луна месяц планети космос місяць",
  "🌓": "планета планеты космос луна месяц планети космос місяць",
  "🌔": "планета планеты космос луна месяц планети космос місяць",
  "🌕": "планета планеты космос луна месяц планети космос місяць",
  "🌖": "планета планеты космос луна месяц планети космос місяць",
  "🌗": "планета планеты космос луна месяц планети космос місяць",
  "🌘": "планета планеты космос луна месяц планети космос місяць",
  "🌙": "планета планеты космос луна месяц планети космос місяць",
  "☀️": "планета планеты космос солнце звезда планети космос сонце зірка",
  "⭐": "планета планеты космос звезда планети космос зірка",
  "🌟": "планета планеты космос звезда планети космос зірка",
  "🌌": "планета планеты космос галактика планети космос галактика",
  "☄️": "планета планеты космос комета планети космос комета",
  "🛰️": "планета планеты космос спутник планети космос супутник",
  "🚀": "планета планеты космос ракета планети космос ракета",
  "🧑‍🚀": "планета планеты космос космонавт планети космос космонавт",
};

const en = englishEmoji as EmojiRecord[];
const ruByCode = new Map(
  (russianEmoji as EmojiRecord[]).map((entry) => [entry.hexcode, entry]),
);
const ukByCode = new Map(
  (ukrainianEmoji as EmojiRecord[]).map((entry) => [entry.hexcode, entry]),
);

const supportedGroups = new Set(Object.keys(GROUP_META).map(Number));
const source = en.filter(
  (entry): entry is EmojiRecord & { group: number } =>
    typeof entry.group === "number" && supportedGroups.has(entry.group),
);

function localizedKeywords(entry: EmojiRecord): string {
  const localized = [entry, ruByCode.get(entry.hexcode), ukByCode.get(entry.hexcode)];
  return localized
    .flatMap((item) => (item ? [item.label, ...(item.tags ?? [])] : []))
    .join(" ")
    .toLowerCase();
}

/**
 * Индекс для умного автоматического подбора. В нём нет общих слов категории,
 * иначе слово «люди» одинаково подходило бы сразу к сотням значков.
 */
export const UNICODE_SUGGEST_ICONS: [string, string][] = source.map((entry) => [
  entry.unicode,
  `${localizedKeywords(entry)} ${TOPIC_KEYWORDS[entry.unicode] ?? ""}`.trim(),
]);

/** Полный актуальный каталог RGI Emoji с EN/RU/UK названиями и тегами. */
export const UNICODE_GROUPS: IconGroup[] = Object.entries(GROUP_META).map(
  ([groupId, meta]) => ({
    label: meta.label,
    icons: source
      .filter((entry) => entry.group === Number(groupId))
      .map((entry) => [
        entry.unicode,
        `${localizedKeywords(entry)} ${meta.keywords} ${TOPIC_KEYWORDS[entry.unicode] ?? ""}`.trim(),
      ]),
  }),
);

export const UNICODE_ICON_COUNT = source.length;
