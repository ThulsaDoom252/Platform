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
  ["🧾", "split bill split the bill pay separately separate checks go dutch each pays their own разделить счет каждый платит за себя окремий рахунок кожен платить за себе"],
  ["🤬", "swear swearing profanity curse rude language bad word excuse my french ругательство брань грубое слово лайка матюки грубе слово"],
  ["🤷", "do not understand incomprehensible confusing gibberish greek to me over my head ничего не понимаю непонятно темный лес нічого не розумію незрозуміло темний ліс"],
  ["🌍", "local customs adapt fit in behave like locals when in rome местные обычаи поступать как местные чужой монастырь місцеві звичаї робити як місцеві чужий монастир"],
  ["🛠️", "versatile all purpose multipurpose multi tool swiss army knife jack of all trades universal універсальний на все руки многофункциональный багатофункціональний"],
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
  ["🤢", "stench stink stinkiness odor odour foul smell вонь зловоние смрад смердючий сморід"],
  ["🧭", "guidance guide direction mentorship наставление руководство настанова керівництво"],
  ["🍬", "indulgence indulge pamper spoil permissiveness потакание потворство потурання балувати"],
  ["🎯", "prey quarry target victim добыча жертва здобич жертва ціль"],
  ["✅", "allow permit permission authorize разрешать позволять разрешить дозволяти дозволити"],
  ["👑", "be in charge in charge boss lead responsible главный ответственный головний відповідальний керувати"],
  ["🕯️", "in remembrance of remembrance memorial memory of в память о в память на згадку памʼять"],
  ["🚫", "have no business here no business here not belong leave нечего делать здесь тебе здесь не место тобі тут нічого робити"],
  ["🧠", "ptsd post traumatic stress disorder posttraumatic птср посттравматический посттравматичний стресовий розлад"],
  ["😐", "sober sobriety serious clear headed трезвый серьезный тверезий серйозний"],
  ["💎", "genuine authentic sincere real настоящий искренний справжній щирий справжнє"],
  ["🧠", "internalize internalise absorb assimilate усвоить принять внутри засвоїти прийняти всередині себе"],
  ["📊", "evaluate evaluation assess assessment analyze analyse оценивать анализировать оцінювати аналізувати"],
  ["🔄", "something is going on something is happening going on happen happening occur occurring происходит происходить щось відбувається відбуватися"],
  ["🥵", "work my ass off working my ass off work extremely hard overwork toil пахать как проклятый пахати як проклятий важко працювати"],
  ["3️⃣", "a few few several small number несколько немного кілька декілька мала кількість"],
  ["⚖️", "accountability accountable answerability responsibility подотчетность ответственность підзвітність відповідальність"],
  ["🦠", "plague pestilence epidemic pandemic disease outbreak чума мор эпидемия лихо чума пошесть епідемія"],
  ["🙏", "the almighty almighty god divine deity всевышний всемогущий всевишній всемогутній бог"],
  ["🗣️", "throat larynx voice гортань горло голос"],
  ["⏳", "it caught up with me caught up with consequences finally reached наздогнало догнало последствия настигли наслідки наздогнали"],
  ["🙏", "for somebodys sake for your sake for gods sake for heavens sake ради кого то заради когось заради тебе та годі вже"],
  ["🛡️", "just in case precaution preventive safeguard про всяк случай на всякий случай про всяк випадок запобіжний захід"],
  ["📋", "duty obligation responsibility task обязанность долг обовязок борг обовʼязок"],
  ["🎯", "relevant pertinent applicable on topic to the point актуальный уместный относящийся доречний актуальний стосується справи"],
  ["💥", "tear apart rip apart tear to pieces rip to pieces destroy разорвать разнести на куски розривати рознести на шматки"],
  ["👀", "it seems to be seems to be appear appears apparently похоже кажется схоже здається"],
  ["1️⃣", "at least minimum no less than как минимум хотя бы принаймні хоча б щонайменше"],
  ["👄", "esophagus oesophagus gullet swallowing tube alimentary canal пищевод стравохід ковтання"],
  ["📦", "store storage stockpile save keep запасать хранить складировать зберігати запасати складувати"],
  ["🔌", "power up switch on turn on energize charge device включить запустить зарядить увімкнути запустити зарядити"],
  ["🤒", "feel ill feel unwell sick нездоровится плохо себя чувствовать погано себе почувати нездужати"],
  ["🛏️", "stay in bed sleep late лежать в постели валяться лежати в ліжку валятися"],
  ["💡", "invent conceive imagine idea выдумать придумать вигадувати придумати"],
  ["👁️", "sleepless awake insomnia бодрствовать без сна без сну"],
  ["😫", "knackered exhausted worn out drained измученный вымотанный виснажений знесилений"],
  ["🔮", "prophetic dream precognitive dream vision вещий сон віщий сон пророцтво"],
  ["🔁", "recurring dream repeating dream recurring nightmare повторяющийся сон сон що повторюється"],
  ["⏰", "snooze alarm postpone alarm sleep button отложить будильник відкласти будильник"],
  ["👎", "damage reputation discredit дурная слава испортить репутацию зіпсувати репутацію"],
  ["🏷️", "namesake eponym commemorative naming назван в честь названий на честь назвати на честь"],
  ["🤬", "insult verbal abuse обзывать обзываться обзивати когось лаяти"],
];

/** Очень короткие междометия теряются при отсечении служебных слов. */
const EXACT_PHRASE_OVERRIDES = new Map<string, string>([["oi", "👋"]]);

/**
 * Идиомы и фразовые глаголы нельзя надёжно понимать как мешок отдельных слов.
 * Правила охватывают варианты местоимений и слова внутри конструкции.
 */
const PHRASE_ICON_RULES: [RegExp, string][] = [
  [/\b(?:go|going|went) dutch\b|\bsplit(?:ting)? the bill\b/u, "🧾"],
  [/\b(?:excuse|pardon) my french\b/u, "🤬"],
  [/\b(?:its|it is|thats|that is) all greek to me\b/u, "🤷"],
  [/\bwhen in rome(?: do as the romans do)?\b/u, "🌍"],
  [/\bswiss army knife\b|\bjack of all trades\b/u, "🛠️"],
  [/\b(?:something|somethings|what) (?:is )?going on\b/u, "🔄"],
  [/\bwork(?:ed|ing)? (?:my|your|his|her|our|their) ass off\b/u, "🥵"],
  [
    /\b(?:it|this|that|stress|work|past|consequences)(?: \w+){0,3} caught up with (?:me|you|him|her|us|them)\b/u,
    "⏳",
  ],
  [
    /\bfor (?:somebody|someone|anybody|anyone|my|your|his|her|our|their|gods|heavens) sake\b/u,
    "🙏",
  ],
  [/\bjust in case\b/u, "🛡️"],
  [/\btear(?: \w+){0,4} apart\b/u, "💥"],
  [/\bseems? to be\b/u, "👀"],
  [/\bat least\b/u, "1️⃣"],
  [/\bpower(?: \w+){0,4} up\b/u, "🔌"],
  [/\bunder the weather\b/u, "🤒"],
  [/\b(?:break|breaks|breaking|broke) the ice\b/u, "🤝"],
  [/^(?:he|she|they|someone|somebody) promises? a lot$/u, "🤥"],
  [/^(?:to |have a )?lie in$/u, "🛏️"],
  [/\bdream(?:ed|t|ing)?(?: \w+){0,4} up\b/u, "💡"],
  [/\b(?:not|never|didnt|couldnt|wont) sleep(?: \w+){0,2} wink\b/u, "👁️"],
  [/\bgiv(?:e|es|ing|en)(?: \w+){0,5} bad name\b/u, "👎"],
  [/\byou name it\b/u, "📋"],
  [/\b(?:name|named) after\b/u, "🏷️"],
  [/\bcall(?:ed|s|ing)?(?: \w+){0,3} names\b/u, "🤬"],
];

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

/**
 * Не считаем слово похожим на его отрицание только из-за общей основы:
 * relevant ≠ irrelevant, appropriate ≠ inappropriate, доречний ≠ недоречний.
 */
function isNegatedFormPair(left: string, right: string): boolean {
  if (left === right) return false;
  const [longer, shorter] = left.length > right.length ? [left, right] : [right, left];
  if (shorter.length < 5) return false;
  return ["un", "in", "im", "ir", "il", "non", "dis", "не"].some(
    (prefix) => longer === `${prefix}${shorter}`,
  );
}

function termMatchScore(wanted: string, key: string): number {
  if (key === wanted) return 10;
  if (isNegatedFormPair(wanted, key)) return 0;
  if (
    wanted.length >= 4 &&
    key.length >= 4 &&
    (key.startsWith(wanted) || wanted.startsWith(key))
  ) {
    return 4;
  }
  return 0;
}

function containsWholePhrase(keywords: string, phrase: string): boolean {
  return ` ${keywords} `.includes(` ${phrase} `);
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

const conceptKeywordsByIcon = new Map<string, string[]>();
for (const [icon, keywords] of CONCEPT_ALIASES) {
  const list = conceptKeywordsByIcon.get(icon) ?? [];
  list.push(keywords);
  conceptKeywordsByIcon.set(icon, list);
}

const SUGGESTION_INDEX = [...merged].map(([icon, keywordLists]) => {
  const keywords = normalize(keywordLists.join(" "));
  const keyWords = words(keywords);
  const conceptKeywords = normalize((conceptKeywordsByIcon.get(icon) ?? []).join(" "));
  return {
    icon,
    keywords,
    keyStems: [...new Set(keyWords.map(stem).filter((key) => key.length >= 2))],
    conceptKeywords,
  };
});

type WeightedField = { text: string | null | undefined; weight: number };

function bestIcon(fields: WeightedField[], preferLearnedConcepts = false): string | null {
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
          tokenScore = Math.max(tokenScore, termMatchScore(wanted, key));
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
        containsWholePhrase(candidate.keywords, field.normalized)
      ) {
        score += 16 * field.weight;
        if (
          preferLearnedConcepts &&
          field.normalized.includes(" ") &&
          containsWholePhrase(candidate.conceptKeywords, field.normalized)
        ) {
          score += 8 * field.weight;
        }
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
  const normalizedPhrase = normalize(phrase);
  const exact = EXACT_PHRASE_OVERRIDES.get(normalizedPhrase);
  if (exact) return exact;
  const learnedPhrase = PHRASE_ICON_RULES.find(([pattern]) => pattern.test(normalizedPhrase));
  if (learnedPhrase) return learnedPhrase[1];

  // Для выражения из нескольких слов перевод и примеры надёжнее отдельных
  // буквальных токенов: French в идиоме не должен превращаться в круассан.
  const multiword = normalizedPhrase.includes(" ") && !!translation?.trim();

  return bestIcon([
    { text: phrase, weight: multiword ? 1.5 : 5 },
    { text: translation, weight: multiword ? 6 : 3 },
    { text: section, weight: 0.35 },
    {
      text: examples.map((example) => example.en).filter(Boolean).join(" "),
      weight: multiword ? 0.5 : 0.2,
    },
    {
      text: examples.map((example) => example.tr).filter(Boolean).join(" "),
      weight: multiword ? 1.2 : 0.2,
    },
  ], true);
}
