/**
 * Семантический подбор emoji для папок, страниц и словарных записей.
 * Использует ручные подсказки проекта и полный CLDR-индекс Emoji на
 * английском, русском и украинском языках.
 */
import { ALL_ICONS } from "./icons-data";
import { SAFE_UNICODE_ICONS, UNICODE_SUGGEST_ICONS } from "./icons-unicode";

/** Украинские слова, которые на русскую или английскую основу не похожи. */
const UK_HINTS: Record<string, string> = {
  одяг: "одежда clothing",
  взуття: "обувь shoes",
  їжа: "еда food",
  напої: "напитки drinks",
  подорож: "путешествия travel",
  подорожі: "путешествия travel",
  тварини: "животные animals",
  птахи: "птица bird",
  робота: "работа work",
  гроші: "деньги money",
  здоров: "здоровье health",
  місто: "город city",
  будинок: "дом house",
  навчання: "учёба study",
  вправи: "практика exercise",
  дієслова: "глагол verb",
  іменники: "существительное noun",
  прикметники: "прилагательное adjective",
  прислівники: "наречие adverb",
};

/** Слова, которые обычно описывают тип материала, но не его тему. */
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "to",
  "be",
  "is",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "of",
  "in",
  "on",
  "at",
  "as",
  "from",
  "by",
  "this",
  "that",
  "these",
  "those",
  "vs",
  "или",
  "и",
  "для",
  "та",
  "і",
  "part",
  "часть",
  "частина",
  "basics",
  "основы",
  "основи",
  "vocabulary",
  "vocab",
  "word",
  "words",
  "phrase",
  "phrases",
  "rule",
  "rules",
  "словарь",
  "словник",
  "слово",
  "слова",
  "фраза",
  "фразы",
  "фрази",
  "правило",
  "правила",
  "material",
  "materials",
  "материал",
  "материалы",
  "матеріал",
  "матеріали",
  "file",
  "folder",
  "файл",
  "папка",
]);

/** Частые смысловые связи, которых нет в официальных названиях emoji. */
const CONCEPT_ALIASES: [string, string][] = [
  ["😈", "devil demon daemon hell hellraiser fiend evil черт чёрт демон дьявол бес диявол демон чорт дідько"],
  ["🤝", "deal agreement contract bargain negotiation сделка договор соглашение контракт угода домовленість згода"],
  ["💔", "adultery adulterer adulterers infidelity cheating betrayal affair прелюбодеяние прелюбодеи измена зрада перелюб невірність"],
  ["👷", "builder builders construction worker ark-builder ark-builders строитель строители будівельник будівельники"],
  ["🚪", "doorman porter gatekeeper doorway entrance привратник швейцар вахтер вахтёр воротар дверник"],
  ["⚖️", "judgment judgement justice verdict court law приговор суд правосудие вирок правосуддя"],
  ["🔨", "make making create build construction создавать делать робити створювати будувати"],
  ["🗑️", "obsolete outdated deprecated trash old-fashioned устаревший застарелый застарілий"],
  ["🚫", "irrelevant unrelated inappropriate нерелевантный недоречний неуместный"],
  ["🔊", "amplified loud volume sound усиленный усилить громкий підсилений посилений гучний"],
  ["✨", "pure clean innocent purity чистый чистота справжній чистий"],
  ["💼", "official officials officer civil servant чиновник чиновники посадовець посадовці офіційна особа"],
  ["📋", "scheme schemes plan plans program strategy схема схемы план программа схеми плани програми"],
  ["🌿", "weed weeds marijuana cannabis бурьян бурян буряни марихуана"],
  ["😩", "desperate desperation despair відчай відчайдушний отчаяние отчаянный"],
  ["🤝", "united unite unity together объединенный объединить обєднаний обєднати згуртований"],
  ["🤯", "outrageous outrageously shocking обурливо шокирующий шокуюче надзвичайно"],
  ["🚫", "abuse abusive misuse mistreat зловживати жестоко поводиться жорстоко поводитися"],
  ["🗳️", "elect elected election vote voting выбирать избранный выборы обирати обраний вибори"],
  ["✅", "verify verified verification confirm check проверять подтверждать перевіряти підтверджувати"],
  ["🔥", "avid passionate eager keen завзятый пристрастный завзятий пристрасний"],
  ["💪", "hard as nails tough resilient strong выносливый незламний витривалий"],
  ["😨", "white as a sheet pale frightened зблідла белый как полотно біла як полотно"],
  ["👥", "buddy buddies mate mates pal pals crew team товарищ приятель товарищи друзья товариш приятель екіпаж команда"],
  ["👋", "oi hey ey greeting attention эй гей привіт увага оклик"],
  ["🧪", "vial ampoule ampule flask флакон ампула пробирка колба"],
  ["🐹", "guinea pig cavy морская свинка морська свинка піддослідна тварина"],
  ["🎭", "alias pseudonym assumed name fake name псевдоним вымышленное имя псевдонім вигадане імя"],
  ["👟", "shoelace shoelaces shoe lace laces шнурок шнурки шнурівка"],
  ["🧬", "intestine intestines bowel bowels gut guts кишечник внутренности нутрощі кишківник"],
  ["🤪", "dumb stupid foolish unintelligent тупой глупый тупий нерозумний"],
  ["💯", "uber extremely exceedingly very надзвичайно дуже підсилювач"],
  ["🐑", "sacrificial sacrifice sacrificing жертвенный жертвовать жертовний жертвувати"],
  ["💎", "worth worthy valuable value коштувати стоить быть ценным бути вартим цінний"],
  ["📋", "supposed to expected to should meant to полагаться предполагаться мати бути передбачатися повинен бути"],
  ["💬", "mention mentions mentioned refer згадувати упоминать зазначати"],
  ["🔑", "rent rental lease hire арендовать аренда орендувати оренда"],
  ["❤️", "fancy like attracted симпатизировать нравиться подобатися симпатизувати вживається"],
  ["🔗", "tie tied bind connect завязывать связывать завязувати звязувати"],
  ["🛡️", "hold up withstand endure resist выдержать выдерживать відповідати витримувати перевірку"],
  ["💰", "sell out sold out продажа продать распродать продати зрадити принципи"],
  ["🧭", "go at go in go around go up go over directions movement идти двигаться іти рухатися напрямки"],
  ["✂️", "contraction contractions shortened short form сокращение скорочення them em"],
  ["🔗", "because cause reason потому что тому що причина"],
  ["🔮", "going to gonna future собираюсь збираюся майбутнє"],
  ["🤔", "in what way how каким образом яким чином у який спосіб"],
  ["2️⃣", "double twice twofold удвоить двойной вдвое подвійний подвоїти вдвічі"],
  ["🛠️", "needs doing need doing work required требуется сделать потребує роботи потрібно зробити"],
  ["👶", "brat spoiled child naughty child избалованный ребенок испорченный ребенок пустун зіпсована дитина"],
  ["🍑", "ass butt backside задница зад задниця дупа"],
  ["💩", "bullshit nonsense crap чушь дерьмо дурница нісенітниця лайно"],
  ["🤬", "twat insult rude idiot дурак мудак дурень образа грубо"],
  ["⚠️", "retard slur offensive insult оскорбление образливо уникати"],
  ["👴", "oldie old man elderly старик старый старе батько"],
];

/** Очень короткие междометия теряются при отсечении служебных слов. */
const EXACT_PHRASE_OVERRIDES = new Map<string, string>([["oi", "👋"]]);

const COMPATIBLE_CONCEPT_ICONS = new Set(CONCEPT_ALIASES.map(([icon]) => icon));
const CURATED_ICONS = new Set(ALL_ICONS.map(([icon]) => icon));

/** Не превратится ли автоматически выбранный символ в пустой квадрат. */
export function isSafeAutomaticIcon(icon: string | null | undefined): boolean {
  return !!icon && (
    SAFE_UNICODE_ICONS.has(icon) ||
    CURATED_ICONS.has(icon) ||
    COMPATIBLE_CONCEPT_ICONS.has(icon)
  );
}

/** Понятная безопасная иконка, когда точного образа для абстрактного слова нет. */
export function vocabularyFallbackIcon(section: string | null | undefined): string {
  const value = normalize(section ?? "");
  if (/phrasal|фразов/.test(value)) return "🔗";
  if (/contraction|скороч|сокращ/.test(value)) return "✂️";
  if (/slang|сленг|груб|лайка/.test(value)) return "⚠️";
  if (/verb|дієслов|глагол/.test(value)) return "⚡";
  if (/adverb|прислів|нареч/.test(value)) return "💫";
  if (/adjective|прикмет|прилаг/.test(value)) return "🎨";
  if (/noun|іменник|существ/.test(value)) return "🏷️";
  if (/phrase|фраз/.test(value)) return "💬";
  return "🔤";
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Основа слова: достаточно мягкая, чтобы не склеивать разные понятия. */
function stem(word: string): string {
  const clean = normalize(word).replaceAll(" ", "");
  if (clean.length <= 3) return clean;
  return clean
    .replace(/(иями|ями|ами|ого|ему|ому|ими|ыми|ах|ях|ов|ев|ей|ий|ый|ая|яя|ое|ее|ие|ые|у|ю|а|я|ы|и|е|і|ї)$/u, "")
    .replace(/(ingly|edly|ing|ied|ed|ers|er|ies|es|s)$/u, "");
}

function words(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

function expandedWords(text: string): string[] {
  return words(text).flatMap((word) => {
    const hint = Object.entries(UK_HINTS).find(([prefix]) => word.startsWith(prefix));
    return hint ? [word, ...words(hint[1])] : [word];
  });
}

/** Объединяем повторяющиеся записи: у одной emoji может быть много полезных тегов. */
const merged = new Map<string, string[]>();
for (const [icon, keywords] of [
  ...ALL_ICONS,
  ...UNICODE_SUGGEST_ICONS,
  ...CONCEPT_ALIASES,
]) {
  const list = merged.get(icon) ?? [];
  list.push(keywords);
  merged.set(icon, list);
}

const SUGGESTION_INDEX = [...merged].map(([icon, keywordLists]) => {
  const keywords = normalize(keywordLists.join(" "));
  const keyWords = words(keywords);
  return {
    icon,
    keywords,
    keyStems: [...new Set(keyWords.map(stem).filter((key) => key.length >= 2))],
  };
});

type WeightedField = { text: string | null | undefined; weight: number };

function bestIcon(fields: WeightedField[]): string | null {
  const prepared = fields
    .map((field) => ({
      ...field,
      normalized: normalize(field.text ?? ""),
      stems: expandedWords(field.text ?? "").map(stem).filter((value) => value.length >= 3),
    }))
    .filter((field) => field.stems.length > 0);
  if (prepared.length === 0) return null;

  let best: { icon: string; score: number; coverage: number } | null = null;

  for (const candidate of SUGGESTION_INDEX) {
    let score = 0;
    let coverage = 0;
    let matchedFields = 0;

    for (const field of prepared) {
      const matched = new Set<string>();

      for (const wanted of field.stems) {
        let tokenScore = 0;
        for (const key of candidate.keyStems) {
          if (key === wanted) tokenScore = Math.max(tokenScore, 10);
          else if (
            wanted.length >= 4 &&
            key.length >= 4 &&
            (key.startsWith(wanted) || wanted.startsWith(key))
          ) {
            tokenScore = Math.max(tokenScore, 4);
          }
        }
        if (tokenScore > 0) {
          const specificity = wanted.length >= 7 ? 1.25 : wanted.length <= 3 ? 0.8 : 1;
          score += tokenScore * field.weight * specificity;
          matched.add(wanted);
        }
      }

      // Полное словосочетание заметно сильнее случайного совпадения одного слова.
      if (
        field.normalized.length >= 4 &&
        candidate.keywords.includes(field.normalized)
      ) {
        score += 16 * field.weight;
      }

      coverage += matched.size;
      if (matched.size > 0) matchedFields++;
      if (matched.size > 1) score += matched.size * 3 * field.weight;
    }

    // Совпадение и по английскому слову, и по переводу намного надёжнее
    // одиночной ассоциации вроде mate → напиток или «гей» → радуга.
    if (matchedFields > 1) score += (matchedFields - 1) * 24;

    if (
      score > 0 &&
      (!best || score > best.score || (score === best.score && coverage > best.coverage))
    ) {
      best = { icon: candidate.icon, score, coverage };
    }
  }

  return best && best.score >= 18 ? best.icon : null;
}

/** Подбор для папки или файла — оценивается полное название целиком. */
export function suggestIcon(name: string): string | null {
  return bestIcon([{ text: name, weight: 4 }]);
}

/**
 * Подбор для словарной карточки. Слово важнее всего, затем перевод,
 * затем категория и примеры — так абстрактные фразы получают больше контекста.
 */
export function suggestVocabularyIcon(
  phrase: string,
  translation?: string | null,
  section?: string | null,
  examples: { en?: string; tr?: string }[] = [],
): string | null {
  const exact = EXACT_PHRASE_OVERRIDES.get(normalize(phrase));
  if (exact) return exact;

  return bestIcon([
    { text: phrase, weight: 5 },
    { text: translation, weight: 3 },
    { text: section, weight: 0.35 },
    { text: examples.map((example) => example.en).filter(Boolean).join(" "), weight: 0.2 },
    { text: examples.map((example) => example.tr).filter(Boolean).join(" "), weight: 0.2 },
  ]);
}
