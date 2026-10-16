import type { LessonWord } from "../lesson-unit";

type Seed = {
  word: string; category: string; icon: string; translation: string; description: string;
  note: string; examples: { en: string; tr: string }[]; question: string;
  pattern: string; accepted?: string[];
};

/** Reviewed native-language meanings; original definitions, examples and discussion prompts. */
export const TRANSPORT_VOCABULARY: Seed[] = [
  {
    word: "a traffic light", category: "Roads & street furniture", icon: "🚦", translation: "світлофор",
    description: "A signal with red, yellow and green lights that tells road users when to stop or move.",
    note: "Часто вживаємо множину: traffic lights; at the traffic lights — біля світлофора. Американське yellow light, британське також amber light.",
    examples: [{ en: "Turn left at the traffic lights.", tr: "Поверни ліворуч біля світлофора." }, { en: "The traffic light had turned red before we reached it.", tr: "Світлофор уже перемкнувся на червоний, перш ніж ми до нього під'їхали." }],
    question: "How could you explain a route using a traffic light as a landmark?", pattern: "traffic lights?", accepted: ["traffic lights", "a traffic light", "traffic light"],
  },
  {
    word: "a roundabout", category: "Roads & street furniture", icon: "🔄", translation: "кругове перехрестя; кільцева розв'язка",
    description: "A circular road junction where vehicles go around a central island before taking an exit.",
    note: "at the roundabout; take the second exit. Не плутай з crossroads — звичайним перехрестям.",
    examples: [{ en: "Take the second exit at the roundabout.", tr: "На кільці скористайся другим виїздом." }, { en: "We had passed the roundabout when we noticed the wrong address.", tr: "Ми вже проїхали кільце, коли помітили, що адреса неправильна." }],
    question: "Would you rather describe a route with roundabouts or street names? Why?", pattern: "roundabouts?",
  },
  {
    word: "a speed camera", category: "Roads & street furniture", icon: "📸", translation: "камера контролю швидкості",
    description: "A roadside device that records vehicles which are travelling faster than the permitted speed.",
    note: "speed — швидкість. На відміну від звичайної камери спостереження, speed camera контролює швидкість руху.",
    examples: [{ en: "There is a speed camera near the bridge.", tr: "Біля мосту є камера контролю швидкості." }, { en: "The driver had slowed down before we passed the speed camera.", tr: "Водій знизив швидкість ще до того, як ми проїхали камеру контролю швидкості." }],
    question: "Where do you think a speed camera would be especially useful?", pattern: "speed cameras?",
  },
  {
    word: "a bus stop", category: "Stops & routes", icon: "🚏", translation: "автобусна зупинка",
    description: "A marked place beside a road where local buses stop to let passengers get on or off.",
    note: "wait at a bus stop; a bus station — автостанція, а не окрема зупинка на вулиці.",
    examples: [{ en: "Let's meet at the bus stop outside the library.", tr: "Зустріньмося на автобусній зупинці біля бібліотеки." }, { en: "I missed the bus because I had waited at the wrong bus stop.", tr: "Я не встиг на автобус, бо чекав не на тій зупинці." }],
    question: "What information should every bus stop display?", pattern: "bus stops?",
  },
  {
    word: "it takes + time", category: "Travel actions & useful phrases", icon: "⏱️", translation: "це займає певний час; потрібно певний час",
    description: "The time expression used to say how long a journey or activity needs: ___ me twenty minutes to get there.",
    note: "It takes me 20 minutes to get there. Минулий час: It took us an hour. How long does it take? Тут тренуємо конструкцію з it; не плутай з I take the bus — я їжджу автобусом.",
    examples: [{ en: "It takes me twenty minutes to commute to college.", tr: "Дорога до коледжу займає в мене двадцять хвилин." }, { en: "It took us an hour because there had been an accident.", tr: "Дорога зайняла в нас годину, бо перед цим сталася аварія." }],
    question: "How long does it take you to get to a place you visit regularly?", pattern: "(?:it (?:takes?|took)(?: (?:me|you|him|her|us|them))?|(?:does|did) it take)", accepted: ["it takes", "it takes + time"],
  },
  {
    word: "to miss", category: "Travel actions & useful phrases", icon: "⌛", translation: "не встигнути на транспорт; пропустити",
    description: "To arrive too late to catch a bus, train or other scheduled service.",
    note: "miss the bus / a train / a flight. miss тут не «сумувати»: I missed the train — я не встиг на поїзд. miss → missed → missed.",
    examples: [{ en: "Leave now or you will miss the tram.", tr: "Виходь зараз, інакше не встигнеш на трамвай." }, { en: "We realised we had missed the last coach.", tr: "Ми зрозуміли, що не встигли на останній міжміський автобус." }],
    question: "If you missed the last bus or train, what alternative could you use?", pattern: "miss(?:es|ed|ing)?",
  },
  {
    word: "to commute", category: "Travel actions & useful phrases", icon: "🔁", translation: "регулярно їздити на роботу або навчання й назад",
    description: "To travel regularly between home and a place of work or study.",
    note: "(to work, to school, etc.) commute by train / bus. Це регулярний маршрут, а не будь-яка поїздка у відпустку.",
    examples: [{ en: "She commutes by tram three days a week.", tr: "Вона їздить на роботу трамваєм три дні на тиждень." }, { en: "He had commuted by car for years before he changed jobs.", tr: "Він роками їздив на роботу автомобілем, перш ніж змінив роботу." }],
    question: "Would you prefer to commute by public transport or another way? If you do not commute, imagine a regular journey.", pattern: "commut(?:e|es|ed|ing)",
  },
  {
    word: "to get on", category: "Travel actions & useful phrases", icon: "🚌", translation: "сідати в автобус, поїзд чи інший відповідний транспорт",
    description: "The everyday two-word expression for entering a bus, train, tram or ferry as a passenger.",
    note: "get on a bus / a train / a tram / a ferry; протилежне get off. get → got → got (UK), gotten (US). Також get on a bike; для машини get in.",
    examples: [{ en: "We got on the tram near the market.", tr: "Ми сіли в трамвай біля ринку." }, { en: "They had checked their tickets before they got on the train.", tr: "Вони перевірили квитки, перш ніж сіли в поїзд." }],
    question: "What do you usually check before you get on unfamiliar public transport?", pattern: "(?:get|gets|getting|got|gotten) on",
  },
  {
    word: "to get in", category: "Travel actions & useful phrases", icon: "🚕", translation: "сідати в автомобіль, таксі чи фургон",
    description: "The neutral two-word expression for entering a car, taxi or van and taking a seat inside.",
    note: "get in / get into a car; get out of a car. Без назви транспорту: Get in! На відміну від get on a bus.",
    examples: [{ en: "Please get in the taxi and fasten your seat belt.", tr: "Будь ласка, сідай у таксі й пристебни пасок безпеки." }, { en: "I got in the car after Sam had moved his bag.", tr: "Я сів у машину після того, як Сем переклав свою сумку." }],
    question: "What do you do first after you get in a car or taxi?", pattern: "(?:get|gets|getting|got|gotten) (?:in|into)", accepted: ["get in", "get into", "to get into"],
  },
  {
    word: "to jump in / to hop in", category: "Travel actions & useful phrases", icon: "👋", translation: "швидко сідати в машину; «застрибуй!»",
    description: "Two informal expressions used to invite somebody to get into a car quickly: ___! I'll give you a lift.",
    note: "Jump in! / Hop in! — дружнє «сідай!»; стрибати буквально не потрібно. jump → jumped; hop → hopped, hopping. Лише коли машина безпечно зупинилася.",
    examples: [{ en: "Hop in! We can take you to the station.", tr: "Сідай! Ми можемо підвезти тебе до вокзалу." }, { en: "Maya said, 'Jump in!' after she had stopped the car.", tr: "Мая сказала: «Сідай!», після того як зупинила машину." }],
    question: "A friend stops safely and says, 'Hop in!' Where would you like to go together?", pattern: "(?:jump(?:s|ed|ing)?|hop(?:s|ped|ping)?) in", accepted: ["to jump in", "jump in", "to hop in", "hop in", "jump in / hop in"],
  },
  {
    word: "a bus lane", category: "Roads & street furniture", icon: "🛣️", translation: "смуга для автобусів",
    description: "A marked part of a road reserved for buses and any other vehicles permitted by local rules.",
    note: "Правильно bus lane, не bust lane. lane — смуга; road — дорога. Правила для таксі чи велосипедів залежать від місцевих знаків.",
    examples: [{ en: "The bus moved faster in the bus lane.", tr: "Автобус рухався швидше смугою для автобусів." }, { en: "The driver had read the sign before entering the bus lane.", tr: "Водій прочитав знак, перш ніж в'їхати на смугу для автобусів." }],
    question: "How could a bus lane change people's daily journeys?", pattern: "bus lanes?",
  },
  {
    word: "a highway", category: "Roads & street furniture", icon: "🛣️", translation: "шосе; велика автомобільна дорога",
    description: "A main public road between places, especially in American English; it need not have motorway-style access restrictions.",
    note: "Часте в US English. highway — ширше поняття, ніж motorway; не кожне highway є дорогою з окремими в'їздами та виїздами.",
    examples: [{ en: "We followed the highway along the coast.", tr: "Ми їхали шосе вздовж узбережжя." }, { en: "The highway was quiet because most drivers had taken another route.", tr: "Шосе було тихим, бо більшість водіїв обрала інший маршрут." }],
    question: "Would you choose a direct highway or a slower scenic route for a holiday trip?", pattern: "highways?",
  },
  {
    word: "a platform", category: "Stops & routes", icon: "🚉", translation: "залізнична платформа; перон",
    description: "The raised area beside a railway track where passengers wait for a train and get on or off it.",
    note: "on the platform; platform three — без артикля перед номером. The train leaves from platform three.",
    examples: [{ en: "Our train leaves from platform four.", tr: "Наш поїзд відправляється з четвертої платформи." }, { en: "The train had left by the time we reached the platform.", tr: "Поїзд уже поїхав на той момент, коли ми дісталися платформи." }],
    question: "What would you do if the departure board and your ticket showed different platforms?", pattern: "platforms?",
  },
  {
    word: "a road", category: "Roads & street furniture", icon: "🛤️", translation: "дорога; автомобільний шлях",
    description: "A route built for vehicles to travel along, in a town or between places.",
    note: "on the road; cross the road; a main road. road — загальне слово; lane — смуга руху, path — зазвичай вужча стежка.",
    examples: [{ en: "This road leads to the station.", tr: "Ця дорога веде до вокзалу." }, { en: "The road reopened after workers had removed the fallen tree.", tr: "Дорогу знову відкрили після того, як працівники прибрали повалене дерево." }],
    question: "What makes a road comfortable for both drivers and people walking?", pattern: "roads?",
  },
  {
    word: "a path", category: "Stops & routes", icon: "🚶", translation: "стежка; доріжка",
    description: "A narrow route for walking or cycling, often through a park or countryside rather than for ordinary cars.",
    note: "a footpath — пішохідна стежка; a cycle path — велодоріжка. follow a path; walk along a path.",
    examples: [{ en: "We followed a path beside the river.", tr: "Ми йшли стежкою вздовж річки." }, { en: "Someone had marked the path, so we found the stop easily.", tr: "Хтось позначив стежку, тож ми легко знайшли зупинку." }],
    question: "Would you rather follow a quiet path or a busy street when you have time? Why?", pattern: "paths?",
  },
  {
    word: "a traffic jam", category: "Delays & problems", icon: "🚗", translation: "затор; дорожній корок",
    description: "A long line of vehicles moving very slowly or not moving because the road is crowded or blocked.",
    note: "be stuck in a traffic jam; heavy traffic — інтенсивний рух. traffic — незлічуване, але a traffic jam — злічуване.",
    examples: [{ en: "We were stuck in a traffic jam for forty minutes.", tr: "Ми простояли в заторі сорок хвилин." }, { en: "A traffic jam had formed before the coach reached the bridge.", tr: "Затор утворився ще до того, як автобус дістався мосту." }],
    question: "If you were stuck in a traffic jam as a passenger, how would you use the time?", pattern: "traffic jams?",
  },
  {
    word: "a road accident", category: "Delays & problems", icon: "⚠️", translation: "дорожньо-транспортна пригода; аварія на дорозі",
    description: "An unintended harmful event on a road involving a vehicle; it does not have to involve a car.",
    note: "Ширше за car accident: може стосуватися мотоцикла, автобуса, велосипеда тощо. a road accident; have an accident / be involved in an accident.",
    examples: [{ en: "A road accident delayed the morning buses.", tr: "Дорожня аварія затримала ранкові автобуси." }, { en: "There had been a road accident, so the police closed one lane.", tr: "Перед цим сталася дорожня аварія, тому поліція перекрила одну смугу." }],
    question: "How could a road accident affect people who are travelling by bus? You do not need to describe a personal experience.", pattern: "road accidents?",
  },
  {
    word: "a motorway", category: "Roads & street furniture", icon: "🛣️", translation: "автомагістраль",
    description: "In British English, a major divided road for fast long-distance traffic, with entry and exit at special junctions.",
    note: "Британське слово. US English: freeway / interstate (залежно від дороги). Не називай будь-яку широку міську вулицю motorway.",
    examples: [{ en: "We joined the motorway outside the city.", tr: "Ми виїхали на автомагістраль за містом." }, { en: "Dad had filled up before we joined the motorway.", tr: "Тато заправив машину до того, як ми виїхали на автомагістраль." }],
    question: "Why might someone choose a motorway rather than a small country road?", pattern: "motorways?",
  },
  {
    word: "a coach", category: "Vehicles", icon: "🚍", translation: "міжміський або туристичний автобус",
    description: "In British English, a comfortable bus used mainly for longer journeys or organised trips.",
    note: "a coach — транспорт у цьому уроці, не тренер. travel by coach; on the coach; get on / board a coach. US: intercity bus.",
    examples: [{ en: "We travelled to the coast by coach.", tr: "Ми поїхали на узбережжя міжміським автобусом." }, { en: "The coach had already left when we arrived.", tr: "Міжміський автобус уже поїхав, коли ми прибули." }],
    question: "What would make a long coach journey comfortable for you?", pattern: "coaches|coach",
  },
  {
    word: "a ferry", category: "Vehicles", icon: "⛴️", translation: "пором",
    description: "A boat or ship that carries passengers, and often vehicles, across water on a regular route.",
    note: "by ferry; on the ferry; board the ferry. Не всі пороми перевозять автомобілі; перевіряй конкретний маршрут.",
    examples: [{ en: "The ferry connects the island with the mainland.", tr: "Пором сполучає острів із материком." }, { en: "We had booked our tickets before we boarded the ferry.", tr: "Ми забронювали квитки до того, як сіли на пором." }],
    question: "Would you enjoy travelling on a ferry? What would you like or dislike about it?", pattern: "ferr(?:y|ies)",
  },
  {
    word: "a tram", category: "Vehicles", icon: "🚋", translation: "трамвай",
    description: "A passenger vehicle that runs on rails along streets in a town or city.",
    note: "on a tram; by tram; get on / get off a tram. Американське також streetcar.",
    examples: [{ en: "A tram goes straight to the museum.", tr: "Трамвай їде прямо до музею." }, { en: "I got on the tram after I had bought a ticket.", tr: "Я сів у трамвай після того, як купив квиток." }],
    question: "If a city has both buses and trams, which would you choose for a short journey?", pattern: "trams?",
  },
  {
    word: "a van", category: "Vehicles", icon: "🚐", translation: "фургон; мікроавтобус",
    description: "A road vehicle with an enclosed body, often used to carry goods, equipment or a small group of people.",
    note: "in a van; get in a van. delivery van — фургон доставки. Не будь-який великий вантажний автомобіль: для нього lorry / truck.",
    examples: [{ en: "The musicians put their instruments in a van.", tr: "Музиканти поклали інструменти у фургон." }, { en: "We got in the van after Leo had loaded the bags.", tr: "Ми сіли в мікроавтобус після того, як Лео завантажив сумки." }],
    question: "For what kind of trip would a van be more useful than a small car?", pattern: "vans?",
  },
  {
    word: "a lorry", category: "Vehicles", icon: "🚚", translation: "вантажівка",
    description: "In British English, a large heavy road vehicle used to carry goods.",
    note: "UK lorry = US truck. in the cab of a lorry — у кабіні вантажівки. lorry driver — водій вантажівки.",
    examples: [{ en: "A lorry delivered the stage equipment.", tr: "Вантажівка доставила обладнання для сцени." }, { en: "The lorry had left before the traffic jam started.", tr: "Вантажівка поїхала ще до того, як почався затор." }],
    question: "Which everyday things reach shops by lorry? Think of two examples.", pattern: "lorr(?:y|ies)", accepted: ["lorry", "a lorry", "truck", "a truck"],
  },
  {
    word: "a car accident / a car crash", category: "Delays & problems", icon: "🚘", translation: "автомобільна аварія; зіткнення за участю автомобіля",
    description: "An unintended incident involving a car; the alternative word crash especially suggests a collision.",
    note: "Обидва вирази можливі; crash особливо підкреслює зіткнення. Це конкретніше за road accident. Не обов'язково означає серйозні травми.",
    examples: [{ en: "A car crash blocked the bridge, but nobody was hurt.", tr: "Автомобільна аварія перекрила міст, але ніхто не постраждав." }, { en: "There had been a car accident, so we took another road.", tr: "Перед цим сталася автомобільна аварія, тому ми поїхали іншою дорогою." }],
    question: "What useful information could a travel alert give after a car accident? Keep your answer non-graphic.", pattern: "car (?:accidents?|crashes|crash)", accepted: ["a car accident", "car accident", "a car crash", "car crash", "car accident / car crash"],
  },
  {
    word: "to board", category: "Travel actions & useful phrases", icon: "🎫", translation: "сідати на транспорт; підніматися на борт",
    description: "The more formal single verb meaning to get onto a train, coach, plane or ship as a passenger.",
    note: "board the train / ferry / plane — без on після board. У транспортному значенні зазвичай не board a car. board → boarded → boarded.",
    examples: [{ en: "Passengers can board the ferry at nine.", tr: "Пасажири можуть сісти на пором о дев'ятій." }, { en: "We boarded the train after the staff had checked our tickets.", tr: "Ми сіли в поїзд після того, як працівники перевірили наші квитки." }],
    question: "What should you have ready before you board a train, coach or ferry?", pattern: "board(?:s|ed|ing)?",
  },
  {
    word: "to fill up", category: "Travel actions & useful phrases", icon: "⛽", translation: "заправляти повний бак",
    description: "To put fuel into a vehicle's tank until it is full.",
    note: "fill up the car / fill the car up; із займенником fill it up, не fill up it. fill up with petrol (UK) / gas (US). Для електромобіля зазвичай charge.",
    examples: [{ en: "Let's fill up before we leave the city.", tr: "Давай заправимо повний бак до виїзду з міста." }, { en: "She had filled up the car, so we did not need to stop.", tr: "Вона заправила повний бак, тож нам не потрібно було зупинятися." }],
    question: "Why is it useful to fill up before a long journey? If you do not drive, answer as a passenger planning the trip.", pattern: "fill(?:s|ed|ing)? (?:up|(?:the car|it|the van) up)",
  },
];

export const TRANSPORT_WORDS: Omit<LessonWord, "id">[] = TRANSPORT_VOCABULARY.map(({ word, category, icon, translation, description, note, examples }) => ({
  word, category, icon, translation, description, note, examples,
  translationLang: "UK", ipaUs: null, ipaUk: null, sectionColor: null, imageUrl: null,
}));

export function transportWordAnswers(seed: Seed): string[] {
  return [...new Set([seed.word, seed.word.replace(/^(?:to|a|an) /, ""), ...(seed.accepted ?? [])])];
}
