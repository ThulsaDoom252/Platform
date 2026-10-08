import type { LessonWord } from "../lesson-unit";

type WordContent = Omit<LessonWord, "id">;

const plain = (html: string) => html
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
  .replace(/\s+/g, " ").trim();

/** Read the existing vocabulary, not a replacement lesson or exercise template. */
export function vegetablesCardsFromHtml(html: string): WordContent[] {
  return [...html.matchAll(/<div\b[^>]*class="vcard"[^>]*>([\s\S]*?)(?=<div\b[^>]*class="(?:vcard|tip)"|$)/gi)].map((match) => {
    const body = match[1];
    const head = body.match(/<div\b[^>]*class="vhead"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const word = plain(head.match(/<b>([\s\S]*?)<\/b>/i)?.[1] ?? "")
      .replace(/\s*(?:→|✓)[\s\S]*$/, "").trim();
    const span = (name: string) => plain(head.match(new RegExp(`<span\\b[^>]*class="${name}"[^>]*>([\\s\\S]*?)<\\/span>`, "i"))?.[1] ?? "");
    return {
      category: "Nouns", word, icon: span("em"), ipaUs: null,
      ipaUk: span("tr").split("→")[0].trim(), translation: span("ua"),
      description: null, imageUrl: null, sectionColor: null,
      note: plain(body.match(/<div\b[^>]*class="note"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "") || null,
      examples: [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => ({ en: plain(item[1]), tr: "" })),
    };
  }).filter((word) => word.word);
}

const details: Record<string, { ipaUs: string; description: string; note: string }> = {
  meat: { ipaUs: "/miːt/", description: "Food that comes from animals, such as beef, pork or chicken.", note: "Зазвичай незлічуване: some meat / a lot of meat. Одна порція: a piece of meat. Це вже знайоме слово з попереднього уроку." },
  vegetables: { ipaUs: "/ˈvedʒ.tə.bəlz/", description: "Plants or parts of plants that we eat, such as carrots and potatoes.", note: "a vegetable → vegetables. Розмовний варіант: veggies. У вимові vegetable зазвичай три склади." },
  "a potato": { ipaUs: "/pəˈteɪ.t̬oʊ/", description: "A round vegetable that grows underground and is often boiled or fried.", note: "Множина з -es: a potato → potatoes. fried potatoes — смажена картопля; mashed potatoes — картопляне пюре." },
  "a tomato": { ipaUs: "/təˈmeɪ.t̬oʊ/", description: "A soft red fruit that we usually eat as a vegetable in salads and sauces.", note: "a tomato → tomatoes (додаємо -es). US: /təˈmeɪ.t̬oʊ/, UK: /təˈmɑː.təʊ/. У кулінарії це овоч, ботанічно — плід." },
  "a cucumber": { ipaUs: "/ˈkjuː.kʌm.bɚ/", description: "A long green vegetable with pale flesh, often eaten raw in salads.", note: "a cucumber → cucumbers. Злічуване: How many cucumbers? Свіжий огірок — a cucumber; маринований — a pickled cucumber." },
  "a carrot": { ipaUs: "/ˈker.ət/", description: "A long orange vegetable that grows underground.", note: "a carrot → carrots. raw carrots — сира морква; boiled carrots — варена морква. Злічуване: two carrots." },
  "an onion": { ipaUs: "/ˈʌn.jən/", description: "A round vegetable with layers and a strong smell that can make you cry when you cut it.", note: "an onion, не a onion: слово починається з голосного звука. Множина: onions. to cut an onion — різати цибулину." },
  garlic: { ipaUs: "/ˈɡɑːr.lɪk/", description: "A plant with small white parts and a strong smell, used to flavour food.", note: "Незлічуване: some garlic / How much garlic? Окрема часточка — a clove of garlic; ціла головка — a head of garlic." },
  "a pea": { ipaUs: "/piː/", description: "A small round green seed that we eat as a vegetable.", note: "a pea → peas. У розмові про їжу зазвичай вживаємо множину: some peas. How many peas?" },
  salad: { ipaUs: "/ˈsæl.əd/", description: "A dish made from vegetables, often served cold.", note: "salad — готова страва, lettuce — листя салату. a salad — одна страва; some salad — певна кількість." },
  lettuce: { ipaUs: "/ˈlet̬.ɪs/", description: "A plant with large green leaves that we often use in salads.", note: "lettuce — рослина / листя 🥬, salad — страва 🥗. Зазвичай незлічуване: some lettuce / How much lettuce? Ціла рослина: a head of lettuce." },
  pepper: { ipaUs: "/ˈpep.ɚ/", description: "A green, red or yellow vegetable; also a spicy seasoning used in cooking.", note: "a pepper / a bell pepper — болгарський перець (злічуване). black pepper — мелений чорний перець (незлічуване). How many peppers? / How much pepper?" },
  mushrooms: { ipaUs: "/ˈmʌʃ.ruːmz/", description: "Fungi with a stem and a round top; some kinds are used in cooking.", note: "a mushroom → mushrooms. fried mushrooms — смажені гриби. Mushrooms — гриби, а не рослини; слово в кулінарному словнику поруч з овочами." },
};

type SupportSeed = [string, string, string, string, string, string, string];
const support: SupportSeed[] = [
  ["a kitchen", "кухня", "Nouns", "🍳", "/ˈkɪtʃ.ən/", "У кімнаті: in the kitchen. a kitchen → kitchens.", "I was cooking in the kitchen."],
  ["a garden", "сад / город", "Nouns", "🌱", "/ˈɡɑːr.dən/", "in the garden — у саду / на городі. to grow vegetables — вирощувати овочі.", "My grandma grows carrots in her garden."],
  ["a shop", "магазин", "Nouns", "🏪", "/ʃɑːp/", "a shop — магазин (частіше UK); a store — поширений US-варіант.", "I bought fresh tomatoes at the shop."],
  ["a market", "ринок", "Nouns", "🛒", "/ˈmɑːr.kɪt/", "at the market — на ринку. a market → markets.", "We buy vegetables at the market."],
  ["soup", "суп", "Nouns", "🍲", "/suːp/", "Зазвичай незлічуване: some soup. Порція — a bowl of soup.", "There are carrots and potatoes in this soup."],
  ["fresh", "свіжий", "Adjectives", "🌿", "/freʃ/", "Прикметник перед іменником: fresh vegetables. fresh ↔ stale (про їжу).", "These cucumbers are fresh."],
  ["to grow", "вирощувати; рости", "Verbs", "🌱", "/ɡroʊ/", "grow → grew → grown. I grow tomatoes — я вирощую помідори; tomatoes grow — помідори ростуть.", "My parents grow potatoes in their garden."],
  ["to cut", "різати", "Verbs", "🔪", "/kʌt/", "cut → cut → cut: усі три форми однакові. cutting — подвоюємо t.", "I was cutting an onion when you called."],
  ["to wash", "мити", "Verbs", "🚿", "/wɑːʃ/", "wash → washed. wash the vegetables — мити овочі; wash your hands — мити руки.", "Please wash the lettuce before you make a salad."],
  ["to call", "дзвонити", "Verbs", "📞", "/kɑːl/", "call somebody — дзвонити комусь (без to). call → called.", "She called me while I was cooking."],
  ["to cry", "плакати", "Verbs", "😢", "/kraɪ/", "cry → cried; crying — y залишається перед -ing.", "I cry when I cut onions."],
  ["French fries", "картопля фрі", "Phrases", "🍟", "/ˌfrentʃ ˈfraɪz/", "US: French fries / fries. UK: chips. Зазвичай множина: some French fries.", "I like French fries with a burger."],
  ["all evening", "весь вечір", "Phrases", "🌆", "/ɔːl ˈiːv.nɪŋ/", "Без прийменника: all evening, не during all evening. Добре підходить для тривалої дії.", "We were cooking all evening."],
  ["all morning", "весь ранок", "Phrases", "🌅", "/ɔːl ˈmɔːr.nɪŋ/", "Без прийменника: all morning. all morning / all evening — тривалість дії.", "She was working in the garden all morning."],
  ["while", "поки; у той час як", "Conjunctions", "⏳", "/waɪl/", "while + тривала дія: While I was cooking, he called. Не плутай з when — коли.", "I was washing tomatoes while she was cutting carrots."],
];

export function vegetablesVocabulary(html: string): WordContent[] {
  const cards = vegetablesCardsFromHtml(html);
  if (cards.length !== 13 || cards.some((card) => !details[card.word])) {
    throw new Error("Unexpected Vegetables vocabulary; refusing to replace existing content");
  }
  return [
    ...cards.map((card) => ({ ...card, ...details[card.word] })),
    ...support.map(([word, translation, category, icon, ipaUs, note, en]) => ({
      word, translation, category: `Support · ${category}`, icon, ipaUs, ipaUk: null,
      description: null, note, examples: [{ en, tr: "" }], sectionColor: null, imageUrl: null,
    })),
  ];
}
