import type { InteractiveHomeworkPlan } from "../lesson-homework";

export type TransportPracticeItem = { prompt: string; answer: string; accepted?: string[]; explanation: string };
export type TransportPracticeGroup = { id: string; title: string; instruction: string; items: TransportPracticeItem[] };

export const TRANSPORT_COLLOCATIONS: TransportPracticeItem[] = [
  { prompt: "The queue of cars is not moving. We are stuck in a ___. Use a two-word phrase.", answer: "traffic jam", explanation: "Be stuck in a traffic jam; traffic itself is uncountable, but a jam is countable." },
  { prompt: "Please check the departure board: the train now leaves from ___ four.", answer: "platform", explanation: "Platform four names the numbered railway boarding area; no article before the number." },
  { prompt: "I leave home at eight and arrive at eight thirty. It ___ me thirty minutes to get there.", answer: "takes", explanation: "It takes + person + time + to-infinitive; it is a third-person singular subject." },
  { prompt: "We need petrol. Let's ___ before we join the motorway. Use a two-word phrasal verb.", answer: "fill up", explanation: "Fill up means put fuel into the tank until it is full." },
  { prompt: "The bus is leaving! Hurry, or we will ___ it.", answer: "miss", explanation: "Miss a service means arrive too late to catch it. After will, use the base verb." },
  { prompt: "The car has stopped safely. '___!' says your friend. Use one informal two-word invitation from the lesson.", answer: "Hop in", accepted: ["Jump in"], explanation: "Hop in! and Jump in! are friendly invitations to get into a car, not instructions to jump into a moving vehicle." },
];

export const TRANSPORT_PREPOSITION_PRACTICE: TransportPracticeGroup = {
  id: "transport-prepositions", title: "On, in or by?", instruction: "Write only the missing preposition. Describe the usual way we talk about travelling, not standing on a vehicle's roof.",
  items: [
    { prompt: "We found two seats ___ the coach.", answer: "on", explanation: "For a passenger journey, say on a coach." },
    { prompt: "Maya is waiting ___ her car outside the station.", answer: "in", explanation: "A person sitting inside a car is in the car, not on it." },
    { prompt: "I usually commute ___ tram. There is no article before tram.", answer: "by", explanation: "By + vehicle without an article names the method: by tram." },
    { prompt: "The children were excited to travel ___ the ferry.", answer: "on", explanation: "We normally describe passengers as being on a ferry." },
    { prompt: "Please put your bag beside you ___ the van.", answer: "in", explanation: "For a van used in the ordinary way, say in the van." },
    { prompt: "We got ___ the train after checking the platform number.", answer: "on", explanation: "Get on / get off a train." },
    { prompt: "He got ___ the taxi and closed the door. Use the shorter option.", answer: "in", accepted: ["into"], explanation: "Get in a taxi and get into a taxi are both correct. The shorter option is in." },
    { prompt: "We travelled ___ coach because it was cheaper. There is no article.", answer: "by", explanation: "By coach names the method; on the coach describes being aboard a particular coach." },
    { prompt: "She likes reading ___ the bus on the way home.", answer: "on", explanation: "A passenger is normally on a bus, even when sitting inside it." },
    { prompt: "We went to the harbour ___ foot.", answer: "on", explanation: "The fixed phrase is on foot, not by foot." },
    { prompt: "The lorry driver was sitting ___ the cab, checking his route.", answer: "in", explanation: "In the cab means inside the driver's compartment." },
    { prompt: "Our bags stayed ___ the car while we bought coffee.", answer: "in", explanation: "The bags were inside the car: in the car." },
  ],
};

export const TRANSPORT_TENSE_PRACTICE: TransportPracticeGroup = {
  id: "transport-past", title: "The journey and the earlier story",
  instruction: "Complete each gap with Past Simple for the main story or Past Perfect for an earlier event viewed from a past moment. In this exercise, explicitly mark the earlier background with had + past participle. Write only the missing words; do not add the verb in brackets again.",
  items: [
    { prompt: "We reached the platform at 8:10, but the train ___ (already / leave) at eight.", answer: "had already left", accepted: ["had left already"], explanation: "The departure happened before reaching the platform: had already left. Leave → left → left." },
    { prompt: "First we checked the board. Then we ___ (get) on the train. Continue the main story.", answer: "got", explanation: "This is the next event in an ordered narrative, not a jump further back in time." },
    { prompt: "The tank was full when I collected the car because Sam ___ (fill) it up the night before.", answer: "had filled", explanation: "Filling up explains the full tank at a later past moment. Up is already printed after the object." },
    { prompt: "Last Saturday we ___ (travel) to the coast by coach. This sentence starts the story.", answer: "travelled", accepted: ["traveled"], explanation: "A finished event introduces the main past story. Both British travelled and American traveled are accepted." },
    { prompt: "At the ticket gate, I realised I ___ (not / download) my ticket earlier.", answer: "had not downloaded", accepted: ["hadn't downloaded"], explanation: "The missing download belongs to the period before the realisation." },
    { prompt: "___ your tickets before you left home? (you / book; ask about the earlier action)", answer: "Had you booked", explanation: "A Past Perfect question is Had + subject + past participle. No did is needed." },
    { prompt: "We missed the ferry, so we ___ (take) a bus back to town. Continue the main story.", answer: "took", explanation: "Taking the bus is the next action after missing the ferry: Past Simple." },
    { prompt: "By the time the coach reached the bridge, a traffic jam ___ (form).", answer: "had formed", explanation: "The queue already existed at the past moment when the coach reached the bridge." },
    { prompt: "Yesterday I ___ (not / commute) by car; I walked instead.", answer: "did not commute", accepted: ["didn't commute"], explanation: "A finished action yesterday uses didn't + base verb. There is no earlier past reference here." },
    { prompt: "I recognised the station because I ___ (be) there on an earlier trip.", answer: "had been", explanation: "The earlier visit explains recognising the station. Be → was/were → been." },
    { prompt: "What time ___ yesterday? (the ferry / arrive; ask about the main past event)", answer: "did the ferry arrive", explanation: "Past Simple question: did + subject + base verb, not did … arrived." },
    { prompt: "The driver stopped at the traffic light and ___ (wait) for green. Continue the main story.", answer: "waited", explanation: "Stopped and waited are two successive main-story actions." },
  ],
};

export const TRANSPORT_REPAIR: TransportPracticeItem[] = [
  { prompt: "Correct the whole sentence: We were on my car when you called.", answer: "We were in my car when you called.", explanation: "For people inside a car, use in, including with my." },
  { prompt: "Correct the whole sentence: Did you boarded the ferry yesterday?", answer: "Did you board the ferry yesterday?", explanation: "After did, use the base verb board; board takes no on before its object." },
  { prompt: "Correct the whole sentence: The train had went before we arrived.", answer: "The train had gone before we arrived.", explanation: "Past Perfect takes the past participle gone, not the Past Simple went." },
  { prompt: "Correct the whole sentence: It take me an hour to commute.", answer: "It takes me an hour to commute.", explanation: "It takes, with -s, agrees with it." },
  { prompt: "Correct the whole sentence: I missed the coach because it had leave early.", answer: "I missed the coach because it had left early.", explanation: "The departure is earlier background: had left." },
  { prompt: "Correct the whole sentence: The tank is empty; let's fill up it.", answer: "The tank is empty; let's fill it up.", accepted: ["The tank is empty. Let's fill it up."], explanation: "The pronoun must go between fill and up: fill it up." },
];

export const TRANSPORT_TRANSLATIONS: TransportPracticeItem[] = [
  { prompt: "Дорога до вокзалу займає в мене двадцять хвилин. Use It takes.", answer: "It takes me twenty minutes to get to the station.", accepted: ["It takes me twenty minutes to reach the station."], explanation: "It takes + person + time + to-infinitive." },
  { prompt: "Коли ми дісталися платформи, поїзд уже поїхав. Use Past Simple + Past Perfect.", answer: "When we reached the platform, the train had already left.", accepted: ["When we got to the platform, the train had already left.", "The train had already left when we reached the platform."], explanation: "Reached is the main past reference; had left is earlier." },
  { prompt: "Вона сіла в таксі після того, як забронювала квитки. Use got in + had booked.", answer: "She got in the taxi after she had booked the tickets.", accepted: ["She got into the taxi after she had booked the tickets.", "After she had booked the tickets, she got in the taxi."], explanation: "Get in/into a taxi. Booking happened before getting in." },
  { prompt: "Ми сіли в трамвай біля автобусної зупинки. Use Past Simple.", answer: "We got on the tram near the bus stop.", accepted: ["We boarded the tram near the bus stop."], explanation: "Get on a tram; board is also acceptable without on." },
  { prompt: "Перед цим сталася дорожня аварія, тому ми поїхали іншою дорогою. Start with There had been.", answer: "There had been a road accident, so we took another road.", accepted: ["There had been a road accident, so we took a different road."], explanation: "The accident is the earlier cause; took advances the story." },
  { prompt: "Він заправив повний бак до того, як ми виїхали на автомагістраль. Use had filled up + joined.", answer: "He had filled up before we joined the motorway.", accepted: ["He had filled up the car before we joined the motorway.", "He had filled the car up before we joined the motorway."], explanation: "Had filled up marks the earlier preparation; joined is the later event." },
];

export const TRANSPORT_CREATIVE = {
  title: "Mission: save the journey",
  instruction: "You and your teacher are a travel rescue team. Invent a fictional route to an island event starting at 12:00. You have a maximum travel budget of £35 per person. The teacher introduces one surprise after you make your plan.",
  prompts: [
    "Choose two or three kinds of transport. Invent reasonable departure times and prices, then check that your arrival time and total cost fit the mission.",
    "Choose a surprise: a missed train, a traffic jam, a changed platform or a ferry that had already left. Explain what happened earlier with two Past Perfect sentences and what you did next with three Past Simple sentences.",
    "Use at least eight lesson expressions and both on + transport and in + transport. Include one It takes / It took sentence. You may change your original route, but explain why it still works.",
    "Role-play a 60–90-second call with your teacher. Ask two practical questions, agree on a Plan B, and finish with a short travel tip for future passengers.",
  ],
  teacherNotes: "There is no single correct route. Check times, costs, logical order and natural transport prepositions. Introduce a manageable problem, not a frightening accident scenario. Let students who do not travel use invented people. Look for eight target expressions, two clear earlier events, three main-story events and a workable alternative. Give feedback on communication as well as accuracy.",
};

export const TRANSPORT_HOMEWORK: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1", title: "Transport and the way of travelling · Homework",
  intro: "A light 20–25-minute review: transport words, on/in/by and the story behind a journey. Short answers are enough. Your teacher can add any lesson exercise if you want more practice.",
  exercises: [
    { id: "tr-hw-recall", title: "1 · Name it", kind: "definition", optional: false,
      instruction: "Recall the lesson expression from its description. You can include or omit a/an/to. No word bank: try to remember the expression yourself.", items: [
        { id: "tr-hw-recall-1", prompt: "A marked strip of road reserved for buses and other permitted vehicles.", answer: "a bus lane", accepted: ["bus lane"] },
        { id: "tr-hw-recall-2", prompt: "A ship carrying passengers and often vehicles across water on a regular route.", answer: "a ferry", accepted: ["ferry"] },
        { id: "tr-hw-recall-3", prompt: "The railway area where you wait beside the track before getting on a train.", answer: "a platform", accepted: ["platform"] },
        { id: "tr-hw-recall-4", prompt: "The two-word phrasal verb meaning to put fuel into a tank until it is full.", answer: "to fill up", accepted: ["fill up"] },
      ] },
    { id: "tr-hw-describe", title: "2 · Explain without saying the word", kind: "describe", optional: false,
      instruction: "Write one or two simple English sentences for each word. Do not use the word itself. Mention what it does, where it is or how it differs from a similar thing.", items: [
        { id: "tr-hw-describe-1", prompt: "Help someone guess this road feature without naming it.", word: "a roundabout" },
        { id: "tr-hw-describe-2", prompt: "Help someone guess this vehicle without naming it. You may compare it with a small car.", word: "a lorry" },
      ] },
    { id: "tr-hw-gaps", title: "3 · Small gaps, useful grammar", kind: "fill", optional: false,
      instruction: "Write only the missing word or words. For the earlier background in 4 and 6 use Past Perfect; for the next main-story event in 5 use Past Simple.", items: [
        { id: "tr-hw-gaps-1", prompt: "We found seats ___ the coach.", answer: "on" },
        { id: "tr-hw-gaps-2", prompt: "She left her bag ___ the van.", answer: "in" },
        { id: "tr-hw-gaps-3", prompt: "I commute ___ tram; there is no article before tram.", answer: "by" },
        { id: "tr-hw-gaps-4", prompt: "At the station I realised the train ___ (already / leave).", answer: "had already left", accepted: ["had left already"] },
        { id: "tr-hw-gaps-5", prompt: "First we checked our tickets. Then we ___ (board) the ferry.", answer: "boarded" },
        { id: "tr-hw-gaps-6", prompt: "The tank was full because Dad ___ (fill) it up earlier.", answer: "had filled" },
      ] },
    { id: "tr-hw-translate", title: "4 · Say it in English", kind: "translate", optional: false,
      instruction: "Translate these three short messages. Use It takes in 1, Past Perfect for the earlier event in 2, and get in / hop in / jump in in 3.", translationDirection: "to-english", translationLanguage: "UK", items: [
        { id: "tr-hw-translate-1", prompt: "Дорога до автобусної зупинки займає в мене п'ять хвилин.", answer: "It takes me five minutes to get to the bus stop.", accepted: ["It takes me five minutes to reach the bus stop."] },
        { id: "tr-hw-translate-2", prompt: "Ми не встигли на поїзд, бо не перевірили платформу.", answer: "We missed the train because we had not checked the platform.", accepted: ["We missed the train because we hadn't checked the platform.", "We missed the train because we had not checked the platform number.", "We missed the train because we hadn't checked the platform number."] },
        { id: "tr-hw-translate-3", prompt: "Сідай у машину! Ми можемо підвезти тебе до вокзалу.", answer: "Get in the car! We can take you to the station.", accepted: ["Hop in! We can take you to the station.", "Jump in! We can take you to the station.", "Get into the car! We can take you to the station.", "Hop in the car! We can take you to the station.", "Get in the car! We can give you a lift to the station."] },
      ] },
    { id: "tr-hw-write", title: "5 · A tiny travel story", kind: "question-text", optional: false,
      instruction: "Write four or five short sentences overall. You can invent everything; no private travel details are needed.", items: [
        { id: "tr-hw-write-1", prompt: "Tell a short journey story using traffic jam or miss. Include one earlier event with had + past participle and two main events in Past Simple. Include on + transport or in + transport." },
        { id: "tr-hw-write-2", prompt: "Ask your teacher one original travel question using How long does it take …? or Had you ever … before …? Include commute, coach, tram or ferry." },
      ] },
    { id: "tr-hw-speak", title: "6 · Your Plan B", kind: "question-audio", optional: false,
      instruction: "Record one relaxed 40–60-second answer. Notes are fine; you do not need to write a script.", items: [
        { id: "tr-hw-speak-1", prompt: "Imagine you reached the station, but your train had already left. Explain your original plan and a reasonable alternative. Use at least four lesson expressions, a Past Perfect sentence and two Past Simple sentences. Use on and in with suitable transport. Finish by asking your teacher one travel question." },
      ] },
    { id: "tr-hw-bonus", title: "7 · Optional: the impossible travel app", kind: "question-text", optional: true,
      instruction: "Optional creative finish: two or three sentences are enough.", items: [
        { id: "tr-hw-bonus-1", prompt: "Invent a silly travel app that makes one useful prediction, for example that a ferry had already left or that a traffic jam had disappeared. Give it a name and explain how a traveller used it. Include speed camera, path or bus lane." },
      ] },
  ],
};
